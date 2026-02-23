from sqlalchemy import Boolean, Column, Integer, String, DateTime
from datetime import datetime

from .database import Base


class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True)
    width = Column(Integer)
    height = Column(Integer)
    is_sample = Column(Boolean, default=False, server_default="0")
    ocr_status = Column(String, default="pending", server_default="pending")
    is_annotated = Column(Boolean, default=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
