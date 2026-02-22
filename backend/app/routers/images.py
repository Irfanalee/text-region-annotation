from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from PIL import Image
from typing import List
import os
import shutil
import uuid

from ..config import settings
from ..schemas import ImageListItem, SetSampleRequest, UploadResponse
from ..database import SessionLocal
from ..models import ImageRecord

router = APIRouter(prefix="/api/images", tags=["images"])


def get_image_dimensions(filepath: Path) -> tuple[int, int]:
    """Get image dimensions using PIL."""
    with Image.open(filepath) as img:
        return img.size


def is_valid_image(filename: str) -> bool:
    """Check if file has valid image extension."""
    ext = Path(filename).suffix.lower()
    return ext in settings.allowed_extensions


@router.get("/", response_model=list[ImageListItem])
async def list_images():
    """List all images with annotation counts."""
    images_dir = Path(settings.images_dir)
    if not images_dir.exists():
        images_dir.mkdir(parents=True, exist_ok=True)
        return []

    db = SessionLocal()
    try:
        result = []
        for filename in sorted(os.listdir(images_dir)):
            if not is_valid_image(filename):
                continue

            filepath = images_dir / filename
            if not filepath.is_file():
                continue

            # Get or create image record
            image_record = db.query(ImageRecord).filter(
                ImageRecord.filename == filename
            ).first()

            if image_record:
                width = image_record.width
                height = image_record.height
                annotation_count = len(image_record.annotations)
                is_sample = image_record.is_sample or False
            else:
                # New image - get dimensions and create record
                try:
                    width, height = get_image_dimensions(filepath)
                    image_record = ImageRecord(
                        filename=filename,
                        width=width,
                        height=height
                    )
                    db.add(image_record)
                    db.commit()
                    annotation_count = 0
                    is_sample = False
                except Exception:
                    continue

            result.append(ImageListItem(
                filename=filename,
                width=width,
                height=height,
                annotation_count=annotation_count,
                is_sample=is_sample,
            ))

        return result
    finally:
        db.close()


@router.get("/{filename}")
async def get_image(filename: str):
    """Serve image file."""
    filepath = Path(settings.images_dir) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    if not is_valid_image(filename):
        raise HTTPException(status_code=400, detail="Invalid image type")
    return FileResponse(filepath)


@router.post("/upload", response_model=UploadResponse)
async def upload_images(files: List[UploadFile] = File(...)):
    """Upload one or more image files."""
    images_dir = Path(settings.images_dir)
    images_dir.mkdir(parents=True, exist_ok=True)

    uploaded = []
    failed = []

    for file in files:
        if not file.filename:
            continue

        # Validate extension
        if not is_valid_image(file.filename):
            failed.append({"filename": file.filename, "error": "Invalid image type"})
            continue

        # Generate unique filename if file exists
        original_name = Path(file.filename).stem
        extension = Path(file.filename).suffix.lower()
        filename = f"{original_name}{extension}"
        filepath = images_dir / filename

        # Add suffix if file already exists
        counter = 1
        while filepath.exists():
            filename = f"{original_name}_{counter}{extension}"
            filepath = images_dir / filename
            counter += 1

        try:
            # Save the file
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Validate it's a real image and get dimensions
            try:
                width, height = get_image_dimensions(filepath)
            except Exception:
                # Not a valid image, delete and report error
                filepath.unlink()
                failed.append({"filename": file.filename, "error": "Invalid image file"})
                continue

            # Create database record
            db = SessionLocal()
            try:
                image_record = ImageRecord(
                    filename=filename,
                    width=width,
                    height=height
                )
                db.add(image_record)
                db.commit()
            finally:
                db.close()

            uploaded.append({
                "filename": filename,
                "width": width,
                "height": height
            })

        except Exception as e:
            failed.append({"filename": file.filename, "error": str(e)})

    return UploadResponse(
        uploaded=uploaded,
        failed=failed,
        total_uploaded=len(uploaded),
        total_failed=len(failed)
    )


@router.patch("/{filename}/sample")
async def set_sample_status(filename: str, body: SetSampleRequest):
    """Mark or unmark an image as a sample for few-shot annotation."""
    db = SessionLocal()
    try:
        image_record = db.query(ImageRecord).filter(
            ImageRecord.filename == filename
        ).first()
        if not image_record:
            raise HTTPException(status_code=404, detail="Image not found")
        image_record.is_sample = body.is_sample
        db.commit()
        return {"filename": filename, "is_sample": body.is_sample}
    finally:
        db.close()


@router.delete("/{filename}")
async def delete_image(filename: str):
    """Delete an image and its annotations."""
    filepath = Path(settings.images_dir) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    # Delete from database (cascades to annotations)
    db = SessionLocal()
    try:
        image_record = db.query(ImageRecord).filter(
            ImageRecord.filename == filename
        ).first()
        if image_record:
            db.delete(image_record)
            db.commit()
    finally:
        db.close()

    # Delete file
    filepath.unlink()

    return {"status": "deleted", "filename": filename}
