from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from PIL import Image
import os

from ..config import settings
from ..schemas import ImageListItem
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
                except Exception:
                    continue

            result.append(ImageListItem(
                filename=filename,
                width=width,
                height=height,
                annotation_count=annotation_count
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
