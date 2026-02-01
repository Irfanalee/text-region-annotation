from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path
from PIL import Image
from datetime import datetime
import json
import os
import shutil

from ..database import get_db
from ..models import ImageRecord
from ..schemas import ExportRequest, ExportResponse
from ..config import settings

router = APIRouter(prefix="/api/export", tags=["export"])


def get_all_images_with_annotations(db: Session, include_empty: bool = False):
    """Get all images with their annotations."""
    query = db.query(ImageRecord)
    images = query.all()
    if not include_empty:
        images = [img for img in images if len(img.annotations) > 0]
    return images


@router.post("/yolo", response_model=ExportResponse)
async def export_yolo(
    request: ExportRequest, db: Session = Depends(get_db)
):
    """
    Export annotations in YOLO format.
    Format: <class_id> <x_center> <y_center> <width> <height>
    All values normalized to 0-1.
    """
    output_dir = Path(settings.exports_dir) / "yolo"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = get_all_images_with_annotations(db, request.include_empty)

    # Create classes.txt
    with open(output_dir / "classes.txt", "w") as f:
        f.write("text\n")

    total_annotations = 0
    file_count = 0

    for img in images:
        txt_path = output_dir / f"{Path(img.filename).stem}.txt"
        with open(txt_path, "w") as f:
            for ann in img.annotations:
                # Convert to normalized center coordinates
                x_center = (ann.x + ann.width / 2) / img.width
                y_center = (ann.y + ann.height / 2) / img.height
                w_norm = ann.width / img.width
                h_norm = ann.height / img.height
                f.write(
                    f"{ann.class_id} {x_center:.6f} {y_center:.6f} {w_norm:.6f} {h_norm:.6f}\n"
                )
                total_annotations += 1
        file_count += 1

    return ExportResponse(
        path=str(output_dir),
        format="yolo",
        file_count=file_count,
        annotation_count=total_annotations,
    )


@router.post("/coco", response_model=ExportResponse)
async def export_coco(
    request: ExportRequest, db: Session = Depends(get_db)
):
    """
    Export annotations in COCO JSON format.
    Structure: { info, licenses, images, annotations, categories }
    """
    output_dir = Path(settings.exports_dir) / "coco"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    images = get_all_images_with_annotations(db, request.include_empty)

    coco_data = {
        "info": {
            "description": "OCR Annotation Dataset",
            "version": "1.0",
            "year": datetime.now().year,
            "date_created": datetime.now().isoformat(),
        },
        "licenses": [],
        "images": [],
        "annotations": [],
        "categories": [{"id": 0, "name": "text", "supercategory": "text"}],
    }

    annotation_id = 1
    total_annotations = 0

    for img_id, img in enumerate(images, start=1):
        coco_data["images"].append(
            {
                "id": img_id,
                "file_name": img.filename,
                "width": img.width,
                "height": img.height,
            }
        )

        for ann in img.annotations:
            coco_data["annotations"].append(
                {
                    "id": annotation_id,
                    "image_id": img_id,
                    "category_id": ann.class_id,
                    "bbox": [ann.x, ann.y, ann.width, ann.height],
                    "area": ann.width * ann.height,
                    "iscrowd": 0,
                    "attributes": {"transcription": ann.transcription},
                }
            )
            annotation_id += 1
            total_annotations += 1

    output_path = output_dir / "annotations.json"
    with open(output_path, "w") as f:
        json.dump(coco_data, f, indent=2)

    return ExportResponse(
        path=str(output_path),
        format="coco",
        file_count=len(images),
        annotation_count=total_annotations,
    )


@router.post("/trocr", response_model=ExportResponse)
async def export_trocr(
    request: ExportRequest, db: Session = Depends(get_db)
):
    """
    Export annotations in TrOCR format with cropped images.
    Structure: metadata.json with image_path -> transcription mapping.
    """
    output_dir = Path(settings.exports_dir) / "trocr"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    crops_dir = output_dir / "crops"
    crops_dir.mkdir(parents=True, exist_ok=True)

    images = get_all_images_with_annotations(db, request.include_empty)

    metadata = []
    total_annotations = 0

    for img in images:
        img_path = Path(settings.images_dir) / img.filename
        if not img_path.exists():
            continue

        try:
            pil_img = Image.open(img_path)
        except Exception:
            continue

        for idx, ann in enumerate(img.annotations):
            # Crop the region
            crop_box = (
                max(0, int(ann.x)),
                max(0, int(ann.y)),
                min(pil_img.width, int(ann.x + ann.width)),
                min(pil_img.height, int(ann.y + ann.height)),
            )

            # Skip invalid crops
            if crop_box[2] <= crop_box[0] or crop_box[3] <= crop_box[1]:
                continue

            crop = pil_img.crop(crop_box)

            # Save crop
            crop_filename = f"{Path(img.filename).stem}_{idx:03d}.png"
            crop_path = crops_dir / crop_filename
            crop.save(crop_path)

            metadata.append(
                {
                    "image_path": f"crops/{crop_filename}",
                    "text": ann.transcription,
                    "source_image": img.filename,
                    "bbox": [ann.x, ann.y, ann.width, ann.height],
                }
            )
            total_annotations += 1

        pil_img.close()

    output_path = output_dir / "metadata.json"
    with open(output_path, "w") as f:
        json.dump(metadata, f, indent=2)

    return ExportResponse(
        path=str(output_path),
        format="trocr",
        file_count=len(images),
        annotation_count=total_annotations,
    )


@router.get("/download/{format_type}/{filename}")
async def download_export(format_type: str, filename: str):
    """Download exported file."""
    if format_type not in ["yolo", "coco", "trocr"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid export format")

    path = Path(settings.exports_dir) / format_type / filename
    if not path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Export file not found")

    return FileResponse(path, filename=filename)
