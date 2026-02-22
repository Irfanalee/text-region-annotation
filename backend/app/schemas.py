from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnnotationBase(BaseModel):
    x: float
    y: float
    width: float
    height: float
    transcription: str = ""
    class_id: int = 0


class AnnotationCreate(AnnotationBase):
    pass


class AnnotationUpdate(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    transcription: Optional[str] = None
    class_id: Optional[int] = None


class AnnotationResponse(AnnotationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ImageListItem(BaseModel):
    filename: str
    width: int
    height: int
    annotation_count: int
    is_sample: bool = False


class ImageAnnotations(BaseModel):
    filename: str
    width: int
    height: int
    annotations: list[AnnotationResponse]


class ExportRequest(BaseModel):
    include_empty: bool = False


class ExportResponse(BaseModel):
    path: str
    format: str
    file_count: int = 0
    annotation_count: int = 0


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


class ClaudeAnnotateRequest(BaseModel):
    overwrite_existing: bool = False


class ClaudeAnnotateResult(BaseModel):
    filename: str
    status: str  # "success", "skipped", "error"
    annotations_added: int = 0
    message: str = ""


class ClaudeAnnotateResponse(BaseModel):
    results: list[ClaudeAnnotateResult]
    total_annotated: int
    total_skipped: int
    total_errors: int
