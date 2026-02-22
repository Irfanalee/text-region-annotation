import base64
import io
import json
import re
from pathlib import Path

import anthropic
from fastapi import APIRouter, HTTPException, Depends
from PIL import Image as PILImage
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Annotation, ImageRecord
from ..schemas import (
    ClaudeAnnotateRequest,
    ClaudeAnnotateResponse,
    ClaudeAnnotateResult,
)

router = APIRouter(prefix="/api/claude", tags=["claude"])

MAX_IMAGE_DIMENSION = 1568  # Claude's recommended max dimension


def encode_image_to_base64(filepath: Path) -> tuple[str, str]:
    """Load image, resize if needed, and return base64 string + media type."""
    with PILImage.open(filepath) as img:
        # Convert to RGB if needed (handles RGBA, palette, etc.)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Resize if too large for Claude
        w, h = img.size
        if max(w, h) > MAX_IMAGE_DIMENSION:
            scale = MAX_IMAGE_DIMENSION / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), PILImage.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        buf.seek(0)
        return base64.standard_b64encode(buf.read()).decode("utf-8"), "image/jpeg"


def build_annotation_description(annotations: list) -> str:
    """Convert annotation ORM objects to a readable JSON description."""
    items = []
    for ann in annotations:
        items.append({
            "x": round(ann.x),
            "y": round(ann.y),
            "width": round(ann.width),
            "height": round(ann.height),
            "transcription": ann.transcription,
        })
    return json.dumps(items, indent=2)


def parse_claude_response(text: str) -> list[dict]:
    """Extract JSON array of annotations from Claude's response text."""
    # Try to find a JSON array in the response
    match = re.search(r"\[[\s\S]*\]", text)
    if not match:
        raise ValueError("No JSON array found in Claude response")

    data = json.loads(match.group(0))
    if not isinstance(data, list):
        raise ValueError("Claude response is not a JSON array")

    results = []
    for item in data:
        results.append({
            "x": float(item.get("x", 0)),
            "y": float(item.get("y", 0)),
            "width": float(item.get("width", 0)),
            "height": float(item.get("height", 0)),
            "transcription": str(item.get("transcription", item.get("label", ""))),
        })
    return results


@router.post("/annotate", response_model=ClaudeAnnotateResponse)
async def auto_annotate(
    request: ClaudeAnnotateRequest,
    db: Session = Depends(get_db),
):
    """
    Use sample images as few-shot examples to automatically annotate remaining images.

    Requires ANTHROPIC_API_KEY to be set in .env or environment.
    """
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY is not configured. Add it to backend/.env",
        )

    images_dir = Path(settings.images_dir)

    # Load sample images that have annotations
    sample_records = (
        db.query(ImageRecord)
        .filter(ImageRecord.is_sample == True)  # noqa: E712
        .all()
    )
    samples_with_annotations = [r for r in sample_records if r.annotations]

    if not samples_with_annotations:
        raise HTTPException(
            status_code=400,
            detail=(
                "No annotated sample images found. "
                "Mark at least one image as a sample and annotate it first."
            ),
        )

    # Load target images (non-sample)
    target_records = (
        db.query(ImageRecord)
        .filter(ImageRecord.is_sample == False)  # noqa: E712
        .all()
    )

    if not request.overwrite_existing:
        target_records = [r for r in target_records if not r.annotations]

    if not target_records:
        return ClaudeAnnotateResponse(
            results=[],
            total_annotated=0,
            total_skipped=0,
            total_errors=0,
        )

    # Prepare few-shot message content (samples)
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    system_prompt = (
        "You are an expert image annotation assistant. "
        "Your job is to identify and annotate text regions in images following the exact "
        "same labeling pattern shown in the sample images. "
        "Always respond with ONLY a valid JSON array — no explanation, no markdown fences."
    )

    # Build the sample portion of the user message
    sample_content: list = []
    for i, sample in enumerate(samples_with_annotations, start=1):
        filepath = images_dir / sample.filename
        if not filepath.exists():
            continue
        try:
            img_b64, media_type = encode_image_to_base64(filepath)
        except Exception:
            continue

        ann_desc = build_annotation_description(sample.annotations)
        sample_content.append({
            "type": "text",
            "text": f"Sample image {i} ({sample.filename}) — {sample.width}×{sample.height}px:",
        })
        sample_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": img_b64},
        })
        sample_content.append({
            "type": "text",
            "text": (
                f"Annotations for sample {i} (pixel coordinates, origin top-left):\n"
                f"{ann_desc}\n"
            ),
        })

    # Process each target image
    results: list[ClaudeAnnotateResult] = []
    total_annotated = 0
    total_skipped = 0
    total_errors = 0

    for target in target_records:
        filepath = images_dir / target.filename
        if not filepath.exists():
            results.append(ClaudeAnnotateResult(
                filename=target.filename,
                status="error",
                message="Image file not found on disk",
            ))
            total_errors += 1
            continue

        try:
            img_b64, media_type = encode_image_to_base64(filepath)
        except Exception as e:
            results.append(ClaudeAnnotateResult(
                filename=target.filename,
                status="error",
                message=f"Failed to encode image: {e}",
            ))
            total_errors += 1
            continue

        # Build full message: samples + target
        user_content = list(sample_content)
        user_content.append({
            "type": "text",
            "text": (
                f"Now annotate this new image ({target.filename} — "
                f"{target.width}×{target.height}px) following the exact same labeling pattern.\n"
                "Identify all regions of the same types shown in the samples.\n"
                "Respond with ONLY a JSON array:\n"
                '[{"x": <int>, "y": <int>, "width": <int>, "height": <int>, '
                '"transcription": "<label>"}]'
            ),
        })
        user_content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": img_b64},
        })

        try:
            response = client.messages.create(
                model=settings.claude_model,
                max_tokens=4096,
                system=system_prompt,
                messages=[{"role": "user", "content": user_content}],
            )
            raw_text = response.content[0].text
            parsed = parse_claude_response(raw_text)
        except Exception as e:
            results.append(ClaudeAnnotateResult(
                filename=target.filename,
                status="error",
                message=f"Claude API error: {e}",
            ))
            total_errors += 1
            continue

        # Save annotations (replace existing if overwrite_existing)
        try:
            if request.overwrite_existing:
                db.query(Annotation).filter(
                    Annotation.image_id == target.id
                ).delete()

            new_annotations = []
            for ann in parsed:
                db_ann = Annotation(
                    image_id=target.id,
                    x=ann["x"],
                    y=ann["y"],
                    width=ann["width"],
                    height=ann["height"],
                    transcription=ann["transcription"],
                    class_id=0,
                )
                db.add(db_ann)
                new_annotations.append(db_ann)

            db.commit()
            results.append(ClaudeAnnotateResult(
                filename=target.filename,
                status="success",
                annotations_added=len(new_annotations),
            ))
            total_annotated += 1
        except Exception as e:
            db.rollback()
            results.append(ClaudeAnnotateResult(
                filename=target.filename,
                status="error",
                message=f"Failed to save annotations: {e}",
            ))
            total_errors += 1

    return ClaudeAnnotateResponse(
        results=results,
        total_annotated=total_annotated,
        total_skipped=total_skipped,
        total_errors=total_errors,
    )
