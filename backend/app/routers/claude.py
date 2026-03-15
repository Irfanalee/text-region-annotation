from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pathlib import Path
from pydantic import BaseModel
import json
import base64
import re
import asyncio

from ..config import settings
from ..schemas import OcrBox, InvoiceField, LineItem, InvoiceAnnotation
from ..database import SessionLocal
from ..models import ImageRecord

router = APIRouter(prefix="/api/claude", tags=["claude"])

# Prevent concurrent auto-annotate runs to avoid runaway API costs
_annotate_lock = asyncio.Lock()

# ── Prompt ──────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an invoice field extraction assistant.

You will receive an invoice image together with the OCR-detected text regions. Each region has an ID, the detected text, and bounding box coordinates [x1, y1, x2, y2].

Your task: assign each OCR region to the correct invoice field type.

FIELD TYPES:
  Header (once per document):
    invoice_number  — unique document ID, e.g. "22862792", "INV-2024-001"
    invoice_date    — date of issue, e.g. "2024-01-15"
    vendor_name     — seller / supplier name
    total_gross     — final total including tax

  Line item (repeats per product row):
    description     — product or service name
    quantity        — number of units
    unit_measure    — unit type, e.g. "pcs", "hours", "kg"
    net_price       — price per unit before tax
    net_worth       — row total before tax
    vat             — tax rate or tax amount for the row
    gross_worth     — row total after tax

  unassigned — static label text ("Invoice No:", "Date:", column headers) or irrelevant text

RULES:
1. Annotate VALUES only. "Invoice No:" → unassigned. "22862792" → invoice_number.
2. For line item fields, set line_item_id (1, 2, 3 …) to group fields that belong to the same table row. Use the y-coordinates to determine rows — boxes with similar vertical position belong to the same row.
3. Only include fields you are confident about. Leave anything ambiguous as unassigned.
4. Return ONLY a valid JSON array, no explanation or markdown.

OUTPUT FORMAT:
[
  {"ocr_id": "ocr_1", "field_type": "invoice_number", "line_item_id": null},
  {"ocr_id": "ocr_5", "field_type": "description", "line_item_id": 1},
  {"ocr_id": "ocr_6", "field_type": "quantity", "line_item_id": 1},
  ...
]
"""


def _format_ocr_for_prompt(ocr_boxes: list[OcrBox]) -> str:
    lines = []
    for b in ocr_boxes:
        lines.append(f"  {b.ocr_id}: \"{b.text}\"  bbox={b.bbox}")
    return "\n".join(lines)


def _format_example(annotation: dict, ocr_boxes: list[OcrBox]) -> str:
    """Format a single annotated example as text for the few-shot prompt."""
    ocr_text = _format_ocr_for_prompt(ocr_boxes)

    # Build assignment list from saved annotation
    assignments = []
    for ft, field in annotation.get("header_fields", {}).items():
        if field.get("ocr_id"):
            assignments.append(f'  {{"ocr_id": "{field["ocr_id"]}", "field_type": "{ft}", "line_item_id": null}}')

    for li in annotation.get("line_items", []):
        for ft, field in li.get("fields", {}).items():
            if field.get("ocr_id"):
                assignments.append(
                    f'  {{"ocr_id": "{field["ocr_id"]}", "field_type": "{ft}", "line_item_id": {li["line_item_id"]}}}'
                )

    return f"OCR regions:\n{ocr_text}\n\nCorrect assignments:\n[\n{chr(10).join(assignments)}\n]"


def _build_messages(
    target_image_bytes: bytes,
    target_media_type: str,
    target_ocr: list[OcrBox],
    examples: list[tuple[dict, list[OcrBox]]],  # (annotation, ocr_boxes)
) -> list[dict]:
    """Build the Claude messages list with few-shot examples then the target."""
    content = []

    # Few-shot examples (text only — no images, keeps cost low)
    if examples:
        example_text = "Here are annotated examples to guide you:\n\n"
        for i, (ann, ocr) in enumerate(examples, 1):
            example_text += f"--- EXAMPLE {i} ---\n{_format_example(ann, ocr)}\n\n"
        content.append({"type": "text", "text": example_text})

    # Target invoice image
    content.append({
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": target_media_type,
            "data": base64.standard_b64encode(target_image_bytes).decode("utf-8"),
        },
    })

    # Target OCR regions
    content.append({
        "type": "text",
        "text": (
            f"Now annotate this invoice.\n\nOCR regions:\n"
            f"{_format_ocr_for_prompt(target_ocr)}\n\n"
            "Return ONLY the JSON array of assignments."
        ),
    })

    return [{"role": "user", "content": content}]


def _assignments_to_invoice(
    filename: str,
    assignments: list[dict],
    ocr_boxes: list[OcrBox],
) -> InvoiceAnnotation:
    """Convert Claude's assignment list to an InvoiceAnnotation."""
    ocr_map = {b.ocr_id: b for b in ocr_boxes}
    header_fields: dict[str, InvoiceField] = {}
    line_item_map: dict[int, dict[str, InvoiceField]] = {}

    HEADER_TYPES = {"invoice_number", "invoice_date", "vendor_name", "total_gross"}
    LINE_ITEM_TYPES = {"description", "quantity", "unit_measure", "net_price", "net_worth", "vat", "gross_worth"}

    for a in assignments:
        ocr_id = a.get("ocr_id")
        field_type = a.get("field_type", "unassigned")
        line_item_id = a.get("line_item_id")

        if field_type == "unassigned" or ocr_id not in ocr_map:
            continue

        box = ocr_map[ocr_id]
        field = InvoiceField(text=box.text, bbox=box.bbox, ocr_id=ocr_id)

        if field_type in HEADER_TYPES:
            header_fields[field_type] = field
        elif field_type in LINE_ITEM_TYPES and line_item_id is not None:
            line_item_map.setdefault(line_item_id, {})[field_type] = field

    line_items = [
        LineItem(line_item_id=lid, fields=fields)
        for lid, fields in sorted(line_item_map.items())
    ]

    stem = Path(filename).stem
    return InvoiceAnnotation(
        document_id=stem,
        image_path=f"images/{filename}",
        ocr_raw=ocr_boxes,
        line_items=line_items,
        header_fields=header_fields,
    )


# ── Request / Response schemas ───────────────────────────────────────────────

class AutoAnnotateRequest(BaseModel):
    max_examples: int = 3          # how many annotated docs to use as few-shot
    overwrite_existing: bool = False


class AutoAnnotateResult(BaseModel):
    filename: str
    status: str          # "annotated" | "skipped" | "error"
    fields_found: int = 0
    message: str = ""


class AutoAnnotateResponse(BaseModel):
    results: list[AutoAnnotateResult]
    total_annotated: int
    total_skipped: int
    total_errors: int


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("/auto-annotate")
async def auto_annotate(body: AutoAnnotateRequest):
    """
    Stream auto-annotation progress via Server-Sent Events.

    Each SSE event is JSON:
      {"type": "start",    "total": N}
      {"type": "progress", "current": N, "total": N, "filename": "...", "status": "annotated"|"skipped"|"error", "fields_found": N, "message": "..."}
      {"type": "done",     "total_annotated": N, "total_skipped": N, "total_errors": N}
      {"type": "error",    "message": "..."}   ← fatal setup error
    """
    if _annotate_lock.locked():
        raise HTTPException(
            status_code=429,
            detail="Auto-annotation already in progress. Wait for it to finish.",
        )

    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY is not set. Add it to backend/.env",
        )

    from anthropic import Anthropic
    client = Anthropic(api_key=settings.anthropic_api_key)

    images_dir = Path(settings.images_dir)
    ocr_dir = Path(settings.ocr_dir)
    ann_dir = Path(settings.annotations_dir)

    # ── Collect annotated examples ──────────────────────────────────────────
    examples: list[tuple[dict, list[OcrBox]]] = []
    db = SessionLocal()
    try:
        for record in (
            db.query(ImageRecord)
            .filter(ImageRecord.is_annotated == True)
            .limit(body.max_examples)
            .all()
        ):
            ann_path = ann_dir / f"{Path(record.filename).stem}.json"
            ocr_path = ocr_dir / f"{Path(record.filename).stem}.json"
            if not ann_path.exists() or not ocr_path.exists():
                continue
            with open(ann_path) as f:
                ann = json.load(f)
            with open(ocr_path) as f:
                ocr_raw = [OcrBox(**b) for b in json.load(f)]
            examples.append((ann, ocr_raw))
    finally:
        db.close()

    if not examples:
        raise HTTPException(
            status_code=400,
            detail="No annotated invoices found. Annotate and save at least one invoice first.",
        )

    # ── Find targets ────────────────────────────────────────────────────────
    db = SessionLocal()
    try:
        query = db.query(ImageRecord)
        if not body.overwrite_existing:
            query = query.filter(ImageRecord.is_annotated == False)
        targets = query.all()
    finally:
        db.close()

    media_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".bmp": "image/bmp", ".webp": "image/webp",
    }

    def _sse(data: dict) -> str:
        return f"data: {json.dumps(data)}\n\n"

    async def generate():
        async with _annotate_lock:
            total = len(targets)
            yield _sse({"type": "start", "total": total})

            counts = {"annotated": 0, "skipped": 0, "error": 0}

            for i, record in enumerate(targets):
                filename = record.filename
                image_path = images_dir / filename
                ocr_path = ocr_dir / f"{Path(filename).stem}.json"

                # Yield a "working on it" ping so the client knows we're alive
                yield _sse({"type": "working", "current": i + 1, "total": total, "filename": filename})
                await asyncio.sleep(0)  # let the event loop flush

                if not ocr_path.exists():
                    counts["skipped"] += 1
                    yield _sse({"type": "progress", "current": i + 1, "total": total,
                                 "filename": filename, "status": "skipped",
                                 "fields_found": 0, "message": "OCR not run yet — open in UI first"})
                    continue

                if not image_path.exists():
                    counts["error"] += 1
                    yield _sse({"type": "progress", "current": i + 1, "total": total,
                                 "filename": filename, "status": "error",
                                 "fields_found": 0, "message": "Image file missing"})
                    continue

                try:
                    with open(image_path, "rb") as f:
                        image_bytes = f.read()
                    with open(ocr_path) as f:
                        ocr_boxes = [OcrBox(**b) for b in json.load(f)]

                    suffix = Path(filename).suffix.lower()
                    media_type = media_type_map.get(suffix, "image/jpeg")
                    messages = _build_messages(image_bytes, media_type, ocr_boxes, examples)

                    response = client.messages.create(
                        model=settings.claude_model,
                        max_tokens=4096,
                        system=SYSTEM_PROMPT,
                        messages=messages,
                    )

                    raw = response.content[0].text.strip()
                    json_match = re.search(r'\[.*\]', raw, re.DOTALL)
                    if not json_match:
                        raise ValueError(f"No JSON array in response: {raw[:200]}")

                    assignments = json.loads(json_match.group())
                    annotation = _assignments_to_invoice(filename, assignments, ocr_boxes)

                    ann_path = ann_dir / f"{Path(filename).stem}.json"
                    ann_dir.mkdir(parents=True, exist_ok=True)
                    with open(ann_path, "w") as f:
                        json.dump(annotation.model_dump(), f, indent=2)

                    db2 = SessionLocal()
                    try:
                        rec = db2.query(ImageRecord).filter(ImageRecord.filename == filename).first()
                        if rec:
                            rec.is_annotated = True
                            db2.commit()
                    finally:
                        db2.close()

                    fields_found = len(annotation.header_fields) + sum(len(li.fields) for li in annotation.line_items)
                    counts["annotated"] += 1
                    yield _sse({"type": "progress", "current": i + 1, "total": total,
                                 "filename": filename, "status": "annotated",
                                 "fields_found": fields_found, "message": ""})

                except Exception as e:
                    counts["error"] += 1
                    yield _sse({"type": "progress", "current": i + 1, "total": total,
                                 "filename": filename, "status": "error",
                                 "fields_found": 0, "message": str(e)})

                await asyncio.sleep(0)

            yield _sse({"type": "done",
                        "total_annotated": counts["annotated"],
                        "total_skipped":   counts["skipped"],
                        "total_errors":    counts["error"]})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
