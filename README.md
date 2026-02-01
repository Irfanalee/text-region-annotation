# OCR Text Region Annotation Tool

A full-stack annotation tool for creating OCR training datasets from whiteboard/document images. Draw bounding boxes around text regions and transcribe the text within each region.

## Features

- **Image Management**: Load images from a configurable directory with thumbnail previews
- **Annotation Canvas**: Draw bounding boxes with zoom/pan support
- **Box Editing**: Resize and move boxes after creation with 8-point handles
- **Transcription**: Add text transcriptions to each bounding box
- **Keyboard Shortcuts**: Efficient workflow with keyboard navigation
- **Export Formats**: YOLO, COCO JSON, and TrOCR formats

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS + Zustand
- **Backend**: FastAPI (Python) + SQLAlchemy
- **Storage**: SQLite for annotations, filesystem for images

## Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
python run.py
```

The API will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev
```

The UI will be available at `http://localhost:5173`

### 3. Add Images

Place your images in the `dataset/images/` folder. Supported formats:
- JPG/JPEG
- PNG
- BMP
- TIFF
- WebP

## Usage

### Keyboard Shortcuts

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

### Workflow

1. **Draw boxes**: Press `D` to enter draw mode, click and drag to create boxes
2. **Add transcriptions**: Click on a box in the right panel and enter the text
3. **Edit boxes**: Press `S` for select mode, click a box to select, drag handles to resize
4. **Navigate**: Use arrow keys or sidebar to switch between images
5. **Save**: Press `Ctrl+S` or click Save button (auto-saves on image change)
6. **Export**: Click YOLO, COCO, or TrOCR button to export annotations

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
│   │   ├── config.py         # Configuration
│   │   ├── database.py       # SQLite setup
│   │   ├── models.py         # ORM models
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── routers/          # API endpoints
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── store/            # Zustand stores
│   │   ├── api/              # API client
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
| GET | `/api/images/` | List all images |
| GET | `/api/images/{filename}` | Serve image file |
| GET | `/api/annotations/{filename}` | Get annotations for image |
| POST | `/api/annotations/{filename}` | Create annotation |
| PUT | `/api/annotations/{filename}/{id}` | Update annotation |
| DELETE | `/api/annotations/{filename}/{id}` | Delete annotation |
| POST | `/api/annotations/{filename}/bulk` | Save all annotations |
| POST | `/api/export/yolo` | Export YOLO format |
| POST | `/api/export/coco` | Export COCO format |
| POST | `/api/export/trocr` | Export TrOCR format |

## License

MIT
