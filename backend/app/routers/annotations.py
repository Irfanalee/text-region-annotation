from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pathlib import Path

from ..database import get_db
from ..models import ImageRecord, Annotation
from ..schemas import (
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    ImageAnnotations,
)
from ..config import settings

router = APIRouter(prefix="/api/annotations", tags=["annotations"])


def get_or_create_image(db: Session, filename: str) -> ImageRecord:
    """Get existing image record or create new one."""
    image = db.query(ImageRecord).filter(ImageRecord.filename == filename).first()
    if image:
        return image

    # Check if file exists
    filepath = Path(settings.images_dir) / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Get dimensions
    from PIL import Image as PILImage
    with PILImage.open(filepath) as img:
        width, height = img.size

    image = ImageRecord(filename=filename, width=width, height=height)
    db.add(image)
    db.commit()
    db.refresh(image)
    return image


@router.get("/{filename}", response_model=ImageAnnotations)
async def get_annotations(filename: str, db: Session = Depends(get_db)):
    """Get all annotations for an image."""
    image = db.query(ImageRecord).filter(ImageRecord.filename == filename).first()

    if not image:
        # Check if file exists, create record if so
        filepath = Path(settings.images_dir) / filename
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Image not found")
        image = get_or_create_image(db, filename)

    annotations = [
        AnnotationResponse(
            id=ann.id,
            x=ann.x,
            y=ann.y,
            width=ann.width,
            height=ann.height,
            transcription=ann.transcription,
            class_id=ann.class_id,
            created_at=ann.created_at,
            updated_at=ann.updated_at,
        )
        for ann in image.annotations
    ]

    return ImageAnnotations(
        filename=image.filename,
        width=image.width,
        height=image.height,
        annotations=annotations,
    )


@router.post("/{filename}", response_model=AnnotationResponse)
async def create_annotation(
    filename: str, annotation: AnnotationCreate, db: Session = Depends(get_db)
):
    """Create a new annotation."""
    image = get_or_create_image(db, filename)

    db_annotation = Annotation(
        image_id=image.id,
        x=annotation.x,
        y=annotation.y,
        width=annotation.width,
        height=annotation.height,
        transcription=annotation.transcription,
        class_id=annotation.class_id,
    )
    db.add(db_annotation)
    db.commit()
    db.refresh(db_annotation)

    return AnnotationResponse(
        id=db_annotation.id,
        x=db_annotation.x,
        y=db_annotation.y,
        width=db_annotation.width,
        height=db_annotation.height,
        transcription=db_annotation.transcription,
        class_id=db_annotation.class_id,
        created_at=db_annotation.created_at,
        updated_at=db_annotation.updated_at,
    )


@router.put("/{filename}/{annotation_id}", response_model=AnnotationResponse)
async def update_annotation(
    filename: str,
    annotation_id: int,
    annotation: AnnotationUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing annotation."""
    db_annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not db_annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    update_data = annotation.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_annotation, field, value)

    db.commit()
    db.refresh(db_annotation)

    return AnnotationResponse(
        id=db_annotation.id,
        x=db_annotation.x,
        y=db_annotation.y,
        width=db_annotation.width,
        height=db_annotation.height,
        transcription=db_annotation.transcription,
        class_id=db_annotation.class_id,
        created_at=db_annotation.created_at,
        updated_at=db_annotation.updated_at,
    )


@router.delete("/{filename}/{annotation_id}")
async def delete_annotation(
    filename: str, annotation_id: int, db: Session = Depends(get_db)
):
    """Delete an annotation."""
    db_annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not db_annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    db.delete(db_annotation)
    db.commit()
    return {"status": "deleted", "id": annotation_id}


@router.post("/{filename}/bulk", response_model=ImageAnnotations)
async def save_all_annotations(
    filename: str, annotations: list[AnnotationCreate], db: Session = Depends(get_db)
):
    """Save all annotations for an image (replaces existing)."""
    image = get_or_create_image(db, filename)

    # Delete existing annotations
    db.query(Annotation).filter(Annotation.image_id == image.id).delete()

    # Create new annotations
    new_annotations = []
    for ann in annotations:
        db_annotation = Annotation(
            image_id=image.id,
            x=ann.x,
            y=ann.y,
            width=ann.width,
            height=ann.height,
            transcription=ann.transcription,
            class_id=ann.class_id,
        )
        db.add(db_annotation)
        new_annotations.append(db_annotation)

    db.commit()

    # Refresh to get IDs
    for ann in new_annotations:
        db.refresh(ann)

    return ImageAnnotations(
        filename=image.filename,
        width=image.width,
        height=image.height,
        annotations=[
            AnnotationResponse(
                id=ann.id,
                x=ann.x,
                y=ann.y,
                width=ann.width,
                height=ann.height,
                transcription=ann.transcription,
                class_id=ann.class_id,
                created_at=ann.created_at,
                updated_at=ann.updated_at,
            )
            for ann in new_annotations
        ],
    )
