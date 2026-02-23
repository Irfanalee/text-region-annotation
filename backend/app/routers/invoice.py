from fastapi import APIRouter, HTTPException
from pathlib import Path
import json

from ..config import settings
from ..schemas import InvoiceAnnotation, SaveInvoiceRequest, OcrBox
from ..database import SessionLocal
from ..models import ImageRecord

router = APIRouter(prefix="/api/invoice", tags=["invoice"])


def _annotation_path(filename: str) -> Path:
    stem = Path(filename).stem
    return Path(settings.annotations_dir) / f"{stem}.json"


def _ocr_cache_path(filename: str) -> Path:
    stem = Path(filename).stem
    return Path(settings.ocr_dir) / f"{stem}.json"


def _set_annotated(filename: str, value: bool):
    db = SessionLocal()
    try:
        record = db.query(ImageRecord).filter(ImageRecord.filename == filename).first()
        if record:
            record.is_annotated = value
            db.commit()
    finally:
        db.close()


def _count_labeled_fields(annotation: dict) -> int:
    count = 0
    for li in annotation.get("line_items", []):
        count += len(li.get("fields", {}))
    count += len(annotation.get("header_fields", {}))
    return count


@router.get("/{filename}", response_model=InvoiceAnnotation)
async def get_invoice(filename: str):
    """Load saved invoice annotation. Returns empty structure if missing."""
    ann_path = _annotation_path(filename)
    stem = Path(filename).stem

    if ann_path.exists():
        with open(ann_path) as f:
            data = json.load(f)
        return InvoiceAnnotation(**data)

    # Return empty structure
    ocr_raw: list[OcrBox] = []
    ocr_path = _ocr_cache_path(filename)
    if ocr_path.exists():
        with open(ocr_path) as f:
            raw = json.load(f)
        ocr_raw = [OcrBox(**b) for b in raw]

    return InvoiceAnnotation(
        document_id=stem,
        image_path=f"images/{filename}",
        ocr_raw=ocr_raw,
        line_items=[],
        header_fields={},
    )


@router.post("/{filename}", response_model=InvoiceAnnotation)
async def save_invoice(filename: str, body: SaveInvoiceRequest):
    """Save invoice annotation JSON."""
    image_path = Path(settings.images_dir) / filename
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    stem = Path(filename).stem

    # Load cached OCR raw
    ocr_raw: list[OcrBox] = []
    ocr_path = _ocr_cache_path(filename)
    if ocr_path.exists():
        with open(ocr_path) as f:
            raw = json.load(f)
        ocr_raw = [OcrBox(**b) for b in raw]

    annotation = InvoiceAnnotation(
        document_id=stem,
        image_path=f"images/{filename}",
        ocr_raw=ocr_raw,
        line_items=body.line_items,
        header_fields=body.header_fields,
    )

    ann_path = _annotation_path(filename)
    ann_path.parent.mkdir(parents=True, exist_ok=True)
    with open(ann_path, "w") as f:
        json.dump(annotation.model_dump(), f, indent=2)

    _set_annotated(filename, True)
    return annotation


@router.delete("/{filename}")
async def delete_invoice(filename: str):
    """Remove annotation file and mark image as unannotated."""
    ann_path = _annotation_path(filename)
    if ann_path.exists():
        ann_path.unlink()
    _set_annotated(filename, False)
    return {"status": "deleted", "filename": filename}
