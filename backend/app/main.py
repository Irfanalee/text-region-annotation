from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routers import images, ocr, invoice, claude, export_dataset

app = FastAPI(
    title="Invoice Annotation Tool API",
    description="API for annotating invoice documents with field labels",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type"],
)

app.include_router(images.router)
app.include_router(ocr.router)
app.include_router(invoice.router)
app.include_router(claude.router)
app.include_router(export_dataset.router)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/")
async def root():
    return {"message": "Invoice Annotation Tool API", "docs": "/docs"}


@app.get("/api/health")
async def health():
    return {"status": "healthy"}
