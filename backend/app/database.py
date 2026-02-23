from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from .config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False}  # Needed for SQLite
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from . import models  # noqa: F401
    Base.metadata.create_all(bind=engine)
    # Migrations for existing databases
    with engine.connect() as conn:
        for sql in [
            "ALTER TABLE images ADD COLUMN is_sample BOOLEAN DEFAULT 0",
            "ALTER TABLE images ADD COLUMN ocr_status TEXT DEFAULT 'pending'",
            "ALTER TABLE images ADD COLUMN is_annotated BOOLEAN DEFAULT 0",
        ]:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists
