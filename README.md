# OCR Text Region Annotation Tool

A full-stack annotation tool for creating OCR training datasets from whiteboard/document images. Draw bounding boxes around text regions, label them, and use a few annotated samples to automatically annotate the rest with Claude AI.

## Features

- **Image Upload**: Upload images directly via the UI or place in folder
- **Image Management**: Load images from a configurable directory with thumbnail previews
- **Annotation Canvas**: Draw bounding boxes with zoom/pan support
- **Box Editing**: Resize and move boxes after creation with 8-point handles
- **Transcription / Labels**: Add a text label to each bounding box (e.g. `header`, `date`, `signature`)
- **Few-Shot Auto-Annotation**: Mark a few images as samples, annotate them manually, then let Claude AI annotate the rest automatically
- **Keyboard Shortcuts**: Efficient workflow with keyboard navigation
- **Export Formats**: YOLO, COCO JSON, and TrOCR formats

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Zustand
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Storage**: SQLite for annotations, filesystem for images
- **AI**: Anthropic Claude (vision) for few-shot auto-annotation

## Quick Start

### 1. Backend Setup

```bash
cd backend

python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt

python run.py
```

The API will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

The UI will be available at `http://localhost:5173`

### 3. Add Images

Place your images in the `dataset/images/` folder, or upload via the sidebar. Supported formats: JPG, PNG, BMP, TIFF, WebP.

## Claude Auto-Annotation Setup

To use the **Auto-Annotate** feature, create a `.env` file in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Then edit it and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

You can get an API key at [console.anthropic.com](https://console.anthropic.com).

## Workflow

### Manual Annotation

1. **Draw boxes**: Press `D` to enter draw mode, click and drag to create boxes
2. **Add labels**: Click a box in the right panel and type a label (e.g. `header`, `signature`)
3. **Edit boxes**: Press `S` for select mode, drag handles to resize
4. **Navigate**: Use arrow keys or the sidebar to switch between images
5. **Save**: Press `Ctrl+S` or click Save (auto-saves on image change)
6. **Export**: Click YOLO, COCO, or TrOCR to export

### Few-Shot Auto-Annotation with Claude

1. **Mark samples**: Click the **☆** star button on 2–3 images in the sidebar to mark them as samples (turns green **★**)
2. **Annotate the samples**: Draw bounding boxes on those images and enter label names in the transcription field (e.g. `header`, `date`, `paragraph`, `signature`)
3. **Auto-annotate**: Click the **✦ Auto-Annotate** button in the toolbar — Claude will use your labeled samples as few-shot examples to automatically detect and label the same region types in all remaining images
4. **Review**: Check the auto-generated annotations on the canvas, correct if needed, then export

> **Tip**: The more descriptive and consistent your sample labels are, the better Claude's annotations will be. Using 2–5 samples typically gives good results.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `D` | Switch to Draw mode |
| `S` | Switch to Select mode |
| `Delete` / `Backspace` | Delete selected annotation |
| `Left Arrow` | Previous image |
| `Right Arrow` | Next image |
| `Ctrl+S` | Save annotations |
| `Escape` | Clear selection |
| `Mouse Wheel` | Zoom in/out |
| `Middle Mouse` | Pan canvas |

## Export Formats

### YOLO Format
```
# class x_center y_center width height (normalized 0-1)
0 0.450000 0.300000 0.200000 0.150000
```
Output: `dataset/exports/yolo/`

### COCO Format
```json
{
  "images": [{"id": 1, "file_name": "img.jpg", "width": 800, "height": 600}],
  "annotations": [{"id": 1, "image_id": 1, "category_id": 0, "bbox": [x, y, w, h]}],
  "categories": [{"id": 0, "name": "text"}]
}
```
Output: `dataset/exports/coco/annotations.json`

### TrOCR Format
```json
[
  {
    "image_path": "crops/img_001.png",
    "text": "Meeting Notes",
    "source_image": "img.jpg",
    "bbox": [x, y, width, height]
  }
]
```
Output: `dataset/exports/trocr/` (includes cropped images)

## Project Structure

```
text-region-annotation/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Configuration (reads .env)
│   │   ├── database.py       # SQLite setup + migrations
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── routers/
│   │       ├── images.py     # Image management endpoints
│   │       ├── annotations.py# Annotation CRUD endpoints
│   │       ├── export.py     # Export endpoints
│   │       └── claude.py     # Claude auto-annotation endpoint
│   ├── .env.example          # API key template
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── store/            # Zustand stores
│   │   ├── api/              # API client (images, annotations, claude)
│   │   ├── hooks/            # Custom hooks
│   │   └── types/            # TypeScript types
│   └── package.json
├── dataset/
│   ├── images/               # Source images
│   ├── annotations/          # JSON per image
│   └── exports/              # Export outputs
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images/` | List all images (includes `is_sample` flag) |
| GET | `/api/images/{filename}` | Serve image file |
| POST | `/api/images/upload` | Upload image files |
| PATCH | `/api/images/{filename}/sample` | Mark/unmark image as a sample |
| DELETE | `/api/images/{filename}` | Delete image and annotations |
| GET | `/api/annotations/{filename}` | Get annotations for image |
| POST | `/api/annotations/{filename}` | Create annotation |
| PUT | `/api/annotations/{filename}/{id}` | Update annotation |
| DELETE | `/api/annotations/{filename}/{id}` | Delete annotation |
| POST | `/api/annotations/{filename}/bulk` | Save all annotations |
| POST | `/api/claude/annotate` | Auto-annotate using Claude + sample images |
| POST | `/api/export/yolo` | Export YOLO format |
| POST | `/api/export/coco` | Export COCO format |
| POST | `/api/export/trocr` | Export TrOCR format |

## Future Improvements

- [ ] **Streaming progress**: Show per-image progress during Claude auto-annotation
- [ ] **Overwrite mode**: Option to re-annotate already-annotated images with Claude
- [ ] **Cloud Storage Integration**: Import images from Google Drive, OneDrive, Dropbox
- [ ] **Undo/Redo**: History stack for annotation actions
- [ ] **Crop Preview**: Show cropped region preview when box selected
- [ ] **Progress Tracking**: Mark images as "complete" when all boxes transcribed
- [ ] **Validation Warnings**: Warn on empty transcriptions before export
- [ ] **Batch Operations**: Select and delete multiple annotations
- [ ] **Custom Classes**: Support multiple annotation categories beyond "text"
- [ ] **Import Annotations**: Import existing YOLO/COCO annotations

## License

MIT
