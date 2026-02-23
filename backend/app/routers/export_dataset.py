from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
import json
import base64
import zipfile
import tempfile
import os

from ..config import settings

router = APIRouter(prefix="/api/export", tags=["export"])

EXTRACTION_PROMPT = "Extract all invoice fields as structured JSON. Return only valid JSON with no explanation."


def _load_all_annotations() -> list[dict]:
    """Load all saved annotation JSONs."""
    ann_dir = Path(settings.annotations_dir)
    if not ann_dir.exists():
        return []
    results = []
    for path in sorted(ann_dir.glob("*.json")):
        try:
            with open(path) as f:
                results.append(json.load(f))
        except Exception:
            continue
    return results


def _image_to_base64(filename: str) -> tuple[str, str]:
    """Return (base64_data, media_type) for an image file."""
    path = Path(settings.images_dir) / filename
    suffix = path.suffix.lower()
    media_type_map = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".bmp": "image/bmp", ".webp": "image/webp",
    }
    media_type = media_type_map.get(suffix, "image/jpeg")
    with open(path, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return data, media_type


def _build_assistant_response(annotation: dict) -> str:
    """Build the clean assistant JSON response for fine-tuning."""
    return json.dumps({
        "header_fields": annotation.get("header_fields", {}),
        "line_items": annotation.get("line_items", []),
    }, ensure_ascii=False)


# ── Response schemas ──────────────────────────────────────────────────────────

class ExportStats(BaseModel):
    total_documents: int
    output_path: str
    format: str


# ── JSONL export (Claude fine-tuning format) ──────────────────────────────────

@router.post("/jsonl", response_model=ExportStats)
async def export_jsonl():
    """
    Export all annotations as JSONL for Claude fine-tuning.

    Each line is a training example:
    {"messages": [{"role": "user", "content": [<image>, <prompt>]}, {"role": "assistant", "content": "<json>"}]}

    Output: dataset/exports/claude_finetune.jsonl
    """
    annotations = _load_all_annotations()
    if not annotations:
        raise HTTPException(status_code=404, detail="No annotations found.")

    exports_dir = Path(settings.exports_dir)
    exports_dir.mkdir(parents=True, exist_ok=True)
    output_path = exports_dir / "claude_finetune.jsonl"

    written = 0
    with open(output_path, "w", encoding="utf-8") as out:
        for ann in annotations:
            image_path_rel = ann.get("image_path", "")
            filename = Path(image_path_rel).name

            full_image_path = Path(settings.images_dir) / filename
            if not full_image_path.exists():
                continue

            try:
                b64_data, media_type = _image_to_base64(filename)
            except Exception:
                continue

            example = {
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": b64_data,
                                },
                            },
                            {"type": "text", "text": EXTRACTION_PROMPT},
                        ],
                    },
                    {
                        "role": "assistant",
                        "content": _build_assistant_response(ann),
                    },
                ]
            }
            out.write(json.dumps(example, ensure_ascii=False) + "\n")
            written += 1

    return ExportStats(
        total_documents=written,
        output_path=str(output_path),
        format="jsonl_claude_finetune",
    )


# ── HuggingFace dataset export ────────────────────────────────────────────────

@router.post("/huggingface", response_model=ExportStats)
async def export_huggingface():
    """
    Export all annotations in HuggingFace dataset format.

    Produces a ZIP containing:
      - dataset.json       — metadata + annotations for all documents
      - images/            — copies of all annotated images

    The dataset.json follows the standard document-understanding structure
    compatible with LayoutLM, Donut, and similar models.

    Output: dataset/exports/huggingface_dataset.zip
    """
    annotations = _load_all_annotations()
    if not annotations:
        raise HTTPException(status_code=404, detail="No annotations found.")

    exports_dir = Path(settings.exports_dir)
    exports_dir.mkdir(parents=True, exist_ok=True)

    dataset_records = []
    image_files: list[tuple[str, Path]] = []  # (arcname, real_path)

    for ann in annotations:
        image_path_rel = ann.get("image_path", "")
        filename = Path(image_path_rel).name
        full_image_path = Path(settings.images_dir) / filename
        if not full_image_path.exists():
            continue

        record = {
            "id": ann.get("document_id", Path(filename).stem),
            "file_name": f"images/{filename}",
            "header_fields": ann.get("header_fields", {}),
            "line_items": ann.get("line_items", []),
            "ocr_tokens": [
                {
                    "id": b["ocr_id"],
                    "text": b["text"],
                    "bbox": b["bbox"],
                    "confidence": b.get("confidence", 1.0),
                }
                for b in ann.get("ocr_raw", [])
            ],
        }
        dataset_records.append(record)
        image_files.append((f"images/{filename}", full_image_path))

    if not dataset_records:
        raise HTTPException(status_code=404, detail="No images found for annotated documents.")

    # Write ZIP
    zip_path = exports_dir / "huggingface_dataset.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        # dataset.json
        zf.writestr(
            "dataset.json",
            json.dumps({"version": "1.0", "documents": dataset_records}, indent=2, ensure_ascii=False),
        )
        # README
        zf.writestr("README.md", _hf_readme(len(dataset_records)))
        # Images
        for arcname, real_path in image_files:
            zf.write(real_path, arcname)

    return ExportStats(
        total_documents=len(dataset_records),
        output_path=str(zip_path),
        format="huggingface_zip",
    )


# ── Download endpoints ────────────────────────────────────────────────────────

@router.get("/download/jsonl")
async def download_jsonl():
    """Download the generated claude_finetune.jsonl file."""
    path = Path(settings.exports_dir) / "claude_finetune.jsonl"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run /api/export/jsonl first.")
    return FileResponse(path, filename="claude_finetune.jsonl", media_type="application/jsonlines")


@router.get("/download/huggingface")
async def download_huggingface():
    """Download the generated huggingface_dataset.zip file."""
    path = Path(settings.exports_dir) / "huggingface_dataset.zip"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Run /api/export/huggingface first.")
    return FileResponse(path, filename="huggingface_dataset.zip", media_type="application/zip")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hf_readme(n: int) -> str:
    return f"""# Invoice Annotation Dataset

Generated by the Invoice Annotation Tool.

## Contents

- `dataset.json` — {n} annotated invoice documents
- `images/` — source invoice images

## Schema

Each document in `dataset.json` has:
```json
{{
  "id": "invoice_001",
  "file_name": "images/invoice_001.jpg",
  "header_fields": {{
    "invoice_number": {{"text": "...", "bbox": [x1,y1,x2,y2], "ocr_id": "..."}},
    "invoice_date":   {{"text": "...", "bbox": [x1,y1,x2,y2], "ocr_id": "..."}},
    "vendor_name":    {{"text": "...", "bbox": [x1,y1,x2,y2], "ocr_id": "..."}},
    "total_gross":    {{"text": "...", "bbox": [x1,y1,x2,y2], "ocr_id": "..."}}
  }},
  "line_items": [
    {{
      "line_item_id": 1,
      "fields": {{
        "description": {{"text": "...", "bbox": [x1,y1,x2,y2]}},
        "quantity":    {{"text": "...", "bbox": [x1,y1,x2,y2]}},
        ...
      }}
    }}
  ],
  "ocr_tokens": [
    {{"id": "ocr_0", "text": "...", "bbox": [x1,y1,x2,y2], "confidence": 0.98}}
  ]
}}
```

## Usage with HuggingFace Datasets

```python
from datasets import load_dataset
ds = load_dataset("json", data_files="dataset.json", field="documents")
```
"""
