from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from PIL import Image
from typing import List
import os
import shutil
import json

from ..config import settings
from ..schemas import ImageListItem, SetSampleRequest, UploadResponse
from ..database import SessionLocal
from ..models import ImageRecord

router = APIRouter(prefix="/api/images", tags=["images"])


def get_image_dimensions(filepath: Path) -> tuple[int, int]:
    with Image.open(filepath) as img:
        return img.size


def is_valid_image(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    return ext in settings.allowed_extensions


def _count_labeled_fields(filename: str) -> int:
    stem = Path(filename).stem
    ann_path = Path(settings.annotations_dir) / f"{stem}.json"
    if not ann_path.exists():
        return 0
    try:
        with open(ann_path) as f:
            data = json.load(f)
        count = 0
        for li in data.get("line_items", []):
            count += len(li.get("fields", {}))
        count += len(data.get("header_fields", {}))
        return count
    except Exception:
        return 0


@router.get("/", response_model=list[ImageListItem])
async def list_images():
    """List all images with annotation counts and OCR status."""
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

            image_record = db.query(ImageRecord).filter(
                ImageRecord.filename == filename
            ).first()

            if image_record:
                width = image_record.width
                height = image_record.height
                is_sample = image_record.is_sample or False
                ocr_status = image_record.ocr_status or "pending"
                is_annotated = image_record.is_annotated or False
            else:
                try:
                    width, height = get_image_dimensions(filepath)
                    image_record = ImageRecord(
                        filename=filename,
                        width=width,
                        height=height,
                    )
                    db.add(image_record)
                    db.commit()
                    is_sample = False
                    ocr_status = "pending"
                    is_annotated = False
                except Exception:
                    continue

            annotation_count = _count_labeled_fields(filename)

            result.append(ImageListItem(
                filename=filename,
                width=width,
                height=height,
                annotation_count=annotation_count,
                is_sample=is_sample,
                ocr_status=ocr_status,
                is_annotated=is_annotated,
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

        if not is_valid_image(file.filename):
            failed.append({"filename": file.filename, "error": "Invalid image type"})
            continue

        original_name = Path(file.filename).stem
        extension = Path(file.filename).suffix.lower()
        filename = f"{original_name}{extension}"
        filepath = images_dir / filename

        counter = 1
        while filepath.exists():
            filename = f"{original_name}_{counter}{extension}"
            filepath = images_dir / filename
            counter += 1

        try:
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            try:
                width, height = get_image_dimensions(filepath)
            except Exception:
                filepath.unlink()
                failed.append({"filename": file.filename, "error": "Invalid image file"})
                continue

            db = SessionLocal()
            try:
                image_record = ImageRecord(filename=filename, width=width, height=height)
                db.add(image_record)
                db.commit()
            finally:
                db.close()

            uploaded.append({"filename": filename, "width": width, "height": height})

        except Exception as e:
            failed.append({"filename": file.filename, "error": str(e)})

    return UploadResponse(
        uploaded=uploaded,
        failed=failed,
        total_uploaded=len(uploaded),
        total_failed=len(failed),
    )


@router.patch("/{filename}/sample")
async def set_sample_status(filename: str, body: SetSampleRequest):
    """Mark or unmark an image as a sample."""
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
    """Delete an image and all associated data."""
    filepath = Path(settings.images_dir) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    stem = Path(filename).stem

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

    filepath.unlink()

    # Delete associated OCR cache and annotation JSON
    for extra_path in [
        Path(settings.ocr_dir) / f"{stem}.json",
        Path(settings.annotations_dir) / f"{stem}.json",
    ]:
        if extra_path.exists():
            extra_path.unlink()

    return {"status": "deleted", "filename": filename}
