from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    app_name: str = "Invoice Annotation Tool"
    images_dir: Path = Path("../dataset/images")
    annotations_dir: Path = Path("../dataset/annotations")
    ocr_dir: Path = Path("../dataset/ocr")
    database_url: str = "sqlite:///./annotations.db"
    allowed_extensions: list[str] = [".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp"]
    thumbnail_size: tuple[int, int] = (150, 150)

    class Config:
        env_file = ".env"


settings = Settings()
