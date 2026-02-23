from pydantic import BaseModel
from typing import Optional


class ImageListItem(BaseModel):
    filename: str
    width: int
    height: int
    annotation_count: int
    is_sample: bool = False
    ocr_status: str = "pending"
    is_annotated: bool = False


class UploadedImage(BaseModel):
    filename: str
    width: int
    height: int


class UploadError(BaseModel):
    filename: str
    error: str


class UploadResponse(BaseModel):
    uploaded: list[UploadedImage]
    failed: list[UploadError]
    total_uploaded: int
    total_failed: int


class SetSampleRequest(BaseModel):
    is_sample: bool


class OcrBox(BaseModel):
    ocr_id: str
    text: str
    bbox: list[int]
    confidence: float


class OcrResult(BaseModel):
    filename: str
    ocr_boxes: list[OcrBox]


class InvoiceField(BaseModel):
    text: str
    bbox: list[int]
    ocr_id: Optional[str] = None


class LineItem(BaseModel):
    line_item_id: int
    fields: dict[str, InvoiceField]


class InvoiceAnnotation(BaseModel):
    document_id: str
    image_path: str
    ocr_raw: list[OcrBox]
    line_items: list[LineItem]
    header_fields: dict[str, InvoiceField]


class SaveInvoiceRequest(BaseModel):
    line_items: list[LineItem]
    header_fields: dict[str, InvoiceField]
