from fastapi import APIRouter, HTTPException
from pathlib import Path
import json

from ..config import settings
from ..schemas import OcrResult, OcrBox
from ..database import SessionLocal
from ..models import ImageRecord

router = APIRouter(prefix="/api/ocr", tags=["ocr"])

# Lazy EasyOCR reader — initialized once per server session
_reader = None


def get_reader():
    global _reader
    if _reader is None:
        import easyocr
        _reader = easyocr.Reader(["en"], gpu=False)
    return _reader


def _ocr_cache_path(filename: str) -> Path:
    stem = Path(filename).stem
    return Path(settings.ocr_dir) / f"{stem}.json"


def _set_ocr_status(filename: str, status: str):
    db = SessionLocal()
    try:
        record = db.query(ImageRecord).filter(ImageRecord.filename == filename).first()
        if record:
            record.ocr_status = status
            db.commit()
    finally:
        db.close()


@router.get("/{filename}", response_model=OcrResult)
async def get_ocr_cache(filename: str):
    """Return cached OCR results. 404 if not yet run."""
    cache_path = _ocr_cache_path(filename)
    if not cache_path.exists():
        raise HTTPException(status_code=404, detail="OCR not yet run for this image")
    with open(cache_path) as f:
        data = json.load(f)
    return OcrResult(filename=filename, ocr_boxes=[OcrBox(**b) for b in data])


@router.post("/{filename}", response_model=OcrResult)
async def run_ocr(filename: str):
    """Run EasyOCR on the image (or return cache if exists)."""
    image_path = Path(settings.images_dir) / filename
    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")

    cache_path = _ocr_cache_path(filename)

    # Return cache if available
    if cache_path.exists():
        with open(cache_path) as f:
            data = json.load(f)
        return OcrResult(filename=filename, ocr_boxes=[OcrBox(**b) for b in data])

    _set_ocr_status(filename, "running")
    try:
        reader = get_reader()
        results = reader.readtext(str(image_path))

        ocr_boxes = []
        for i, (polygon, text, confidence) in enumerate(results):
            # polygon is [[x,y],[x,y],[x,y],[x,y]] — convert to [x1,y1,x2,y2]
            xs = [int(p[0]) for p in polygon]
            ys = [int(p[1]) for p in polygon]
            bbox = [min(xs), min(ys), max(xs), max(ys)]
            ocr_boxes.append(OcrBox(
                ocr_id=f"ocr_{i}",
                text=text,
                bbox=bbox,
                confidence=round(float(confidence), 4),
            ))

        # Save cache
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w") as f:
            json.dump([b.model_dump() for b in ocr_boxes], f, indent=2)

        _set_ocr_status(filename, "done")
        return OcrResult(filename=filename, ocr_boxes=ocr_boxes)

    except Exception as e:
        _set_ocr_status(filename, "error")
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
