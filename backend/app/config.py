from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "OCR Annotation Tool"
    images_dir: Path = Path("../dataset/images")
    annotations_dir: Path = Path("../dataset/annotations")
    exports_dir: Path = Path("../dataset/exports")
    database_url: str = "sqlite:///./annotations.db"
    allowed_extensions: list[str] = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
    thumbnail_size: tuple[int, int] = (150, 150)
    anthropic_api_key: Optional[str] = None
    claude_model: str = "claude-sonnet-4-6"

    class Config:
        env_file = ".env"


settings = Settings()
