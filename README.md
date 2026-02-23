# Invoice Annotation Tool

A full-stack tool for annotating invoice documents with structured field labels. EasyOCR automatically detects text regions on load — annotators click boxes to assign field types, group rows into line items, and export structured JSON ready for model training.

## Features

- **Auto OCR**: EasyOCR runs automatically on each document and overlays detected text regions as colored bounding boxes
- **Field Labeling**: Click any box to assign it a field type (invoice number, description, quantity, etc.) via a dropdown
- **Line Item Grouping**: Shift+click multiple boxes in a table row, then press `G` to group them as a line item
- **Manual Boxes**: Draw additional boxes for text OCR missed using Draw mode
- **Structured JSON Output**: Each document saves as `dataset/annotations/{name}.json` with `ocr_raw`, `line_items`, and `header_fields`
- **OCR Caching**: OCR results cached in `dataset/ocr/` — revisiting an image is instant
- **Progress Tracking**: Sidebar shows OCR status (pending / running / done / error) and annotated count per image
- **Zoom / Pan / Scrollbars**: Full canvas navigation with scroll-to-pan and Ctrl+scroll-to-zoom

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: FastAPI (Python) + SQLAlchemy + SQLite
- **OCR**: EasyOCR (local, GPU optional, no API key needed)

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

> **Note:** First `pip install` downloads EasyOCR + PyTorch (~800 MB). First OCR run per server session takes 5–15 seconds to load the model; subsequent runs are 1–3 seconds.

API available at `http://localhost:8000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

UI available at `http://localhost:5173`

### 3. Add Images

Upload invoice images via the **Upload Images** button in the sidebar, or place them directly in `dataset/images/`. Supported formats: JPG, PNG, BMP, TIFF, WebP.

---

## Annotation Flow

Here is the complete end-to-end flow for annotating an invoice document.

### Step 1 — Upload

Click **Upload Images** in the left sidebar and select one or more invoice images. Each image appears in the sidebar with a gray dot (●) indicating OCR has not yet run.

```
Sidebar status indicators:
  ○  gray   = OCR pending
  ◌  yellow = OCR running
  ●  blue   = OCR done
  ✗  red    = OCR error
  ✓  green  = annotation saved
```

---

### Step 2 — OCR Runs Automatically

When you click an image, the tool:
1. Loads any existing saved annotation for that image.
2. Checks the OCR cache (`dataset/ocr/{name}.json`).
3. If no cache exists, calls EasyOCR and shows **"OCR: Running…"** in the toolbar.
4. Once done, colored bounding boxes appear over every detected text region — all initially gray (unassigned).

OCR only runs once per image. Revisiting an image loads from cache instantly.

---

### Step 3 — Assign Field Labels

**Rule: always annotate the value, never the label text.**

| Text on invoice | Action |
|---|---|
| `"Invoice no:"` | Leave as unassigned (it's a static label) |
| `"22862792"` | Click → assign `invoice_number` |
| `"Date of issue:"` | Leave as unassigned |
| `"2024-01-15"` | Click → assign `invoice_date` |
| `"Acme Corp"` | Click → assign `vendor_name` |

**How to assign:**
1. Make sure you are in **Select** mode (`S`).
2. Click a box — a dropdown appears showing all field types.
3. Optionally edit the OCR text in the input at the top of the dropdown (to correct typos).
4. Click the desired field type button. The box immediately changes color.

---

### Step 4 — Understand Header vs Line Item Fields

#### Header Fields — appear **once** per invoice

| Field | What it captures | Example |
|---|---|---|
| `invoice_number` | Unique document identifier | `INV-2024-001`, `22862792` |
| `invoice_date` | Date of issue | `2024-01-15`, `15/01/2024` |
| `vendor_name` | Seller / supplier name | `Acme Corp` |
| `total_gross` | Final total including tax | `$1,250.00` |

Header fields are stored directly in `header_fields` in the output JSON. There is one value per field per document.

#### Line Item Fields — **repeat** for each product/service row

| Field | What it captures | Example |
|---|---|---|
| `description` | Product or service name | `Web Design Services` |
| `quantity` | How many units | `5` |
| `unit_measure` | Unit type | `hours`, `pcs`, `kg` |
| `net_price` | Price per unit (before tax) | `$150.00` |
| `net_worth` | Total before tax (`qty × net_price`) | `$750.00` |
| `vat` | Tax rate or amount | `23%`, `$172.50` |
| `gross_worth` | Total after tax | `$922.50` |

Line item fields must be **grouped into rows** (see Step 5). A single invoice can have many line items.

---

### Step 5 — Group Line Items

Each row in the invoice table is one line item. After labeling the fields in a row:

1. **Shift+click** each box in that row to multi-select them (they get dashed outlines).
2. Press **`G`** — or click **Create Line Item** in the right panel.
3. The row appears in the **Line Items** tab of the right panel.
4. Repeat for each row in the table.

> **Requirement:** All selected boxes must have line item field types (not header types). Mixed selections are rejected silently.

---

### Step 6 — Handle Missed Text

If OCR missed a region (e.g. a faint number or rotated text):

1. Press **`D`** to switch to Draw mode (cursor becomes a crosshair).
2. Click and drag to draw a box around the missed text.
3. A new unassigned box is created — assign its field type via the dropdown.
4. Press **`S`** to return to Select mode.

---

### Step 7 — Save

Press **`Ctrl+S`** or click **Save** in the right panel (or toolbar).

The annotation is written to `dataset/annotations/{name}.json`:

```json
{
  "document_id": "invoice_001",
  "image_path": "images/invoice_001.jpg",
  "ocr_raw": [
    { "ocr_id": "ocr_0", "text": "22862792", "bbox": [120, 45, 310, 80], "confidence": 0.98 }
  ],
  "header_fields": {
    "invoice_number": { "text": "22862792", "bbox": [120, 45, 310, 80], "ocr_id": "ocr_0" },
    "invoice_date":   { "text": "2024-01-15", "bbox": [420, 45, 580, 80], "ocr_id": "ocr_3" },
    "vendor_name":    { "text": "Acme Corp", "bbox": [50, 10, 200, 38], "ocr_id": "ocr_1" },
    "total_gross":    { "text": "$1,250.00", "bbox": [680, 520, 800, 545], "ocr_id": "ocr_41" }
  },
  "line_items": [
    {
      "line_item_id": 1,
      "fields": {
        "description": { "text": "Web Design Services", "bbox": [50, 200, 320, 220], "ocr_id": "ocr_10" },
        "quantity":    { "text": "5",       "bbox": [330, 200, 370, 220], "ocr_id": "ocr_11" },
        "net_price":   { "text": "$150.00", "bbox": [380, 200, 460, 220], "ocr_id": "ocr_12" },
        "net_worth":   { "text": "$750.00", "bbox": [470, 200, 550, 220], "ocr_id": "ocr_13" },
        "vat":         { "text": "23%",     "bbox": [560, 200, 610, 220], "ocr_id": "ocr_14" },
        "gross_worth": { "text": "$922.50", "bbox": [620, 200, 710, 220], "ocr_id": "ocr_15" }
      }
    }
  ]
}
```

The sidebar marks the image with a green **✓** once saved.

---

### Step 8 — Navigate to Next Invoice

Press `→` (right arrow) or click the next image in the sidebar. Any unsaved changes are auto-saved before switching.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` | Select mode |
| `D` | Draw box mode |
| `G` | Group selected boxes as a line item |
| `Delete` / `Backspace` | Delete selected box(es) |
| `Escape` | Clear selection |
| `← →` | Previous / next image (auto-saves) |
| `Ctrl+S` | Save annotation |
| `Ctrl+Scroll` | Zoom in / out |
| `Scroll` | Pan image |
| `Middle mouse drag` | Pan image |

---

## Field Color Reference

| Field | Color |
|---|---|
| `description` | Blue |
| `quantity` | Green |
| `unit_measure` | Purple |
| `net_price` | Amber |
| `net_worth` | Red |
| `vat` | Pink |
| `gross_worth` | Teal |
| `invoice_number` | Orange |
| `invoice_date` | Indigo |
| `vendor_name` | Lime |
| `total_gross` | Cyan |
| `other` | Gray |
| `unassigned` | Light gray |

---

## Project Structure

```
text-region-annotation/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Configuration
│   │   ├── database.py       # SQLite setup + migrations
│   │   ├── models.py         # ORM models (ImageRecord)
│   │   ├── schemas.py        # Pydantic schemas
│   │   └── routers/
│   │       ├── images.py     # Image management endpoints
│   │       ├── ocr.py        # EasyOCR endpoints + caching
│   │       └── invoice.py    # Invoice annotation endpoints
│   ├── requirements.txt
│   └── run.py
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AnnotationCanvas.tsx   # Canvas with zoom/pan/draw/select
│       │   ├── FieldLabelDropdown.tsx # Field assignment popup
│       │   ├── InvoicePanel.tsx       # Line items + headers + save
│       │   ├── ImageSidebar.tsx       # Image list + upload
│       │   ├── Toolbar.tsx            # Tools + zoom + OCR status
│       │   ├── Layout.tsx             # App shell + help button
│       │   └── HelpModal.tsx          # In-app help documentation
│       ├── store/
│       │   ├── invoiceStore.ts        # Labeled boxes, line items, header fields
│       │   ├── imageStore.ts          # Image list, OCR status, annotated flag
│       │   └── canvasStore.ts         # Tool mode, zoom/pan transform
│       ├── api/
│       │   ├── ocr.ts                 # OCR cache + trigger
│       │   ├── invoice.ts             # Load / save invoice annotations
│       │   └── images.ts              # Image list + upload + delete
│       ├── hooks/
│       │   └── useKeyboardShortcuts.ts
│       └── types/index.ts             # All TypeScript types + FIELD_COLORS
├── dataset/
│   ├── images/       # Source invoice images
│   ├── ocr/          # Cached EasyOCR results ({name}.json)
│   └── annotations/  # Saved invoice annotations ({name}.json)
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/images/` | List all images with OCR status and annotated flag |
| GET | `/api/images/{filename}` | Serve image file |
| POST | `/api/images/upload` | Upload image files |
| DELETE | `/api/images/{filename}` | Delete image, OCR cache, and annotation |
| GET | `/api/ocr/{filename}` | Get cached OCR result (404 if not run yet) |
| POST | `/api/ocr/{filename}` | Run EasyOCR (or return cache) |
| GET | `/api/invoice/{filename}` | Load saved invoice annotation |
| POST | `/api/invoice/{filename}` | Save invoice annotation |
| DELETE | `/api/invoice/{filename}` | Delete annotation, mark as unannotated |

---

## Future Improvements

- [ ] **Undo/Redo**: History stack for annotation actions
- [ ] **OCR Language Support**: Add language selector for non-English invoices
- [ ] **Batch Export**: Export all annotations as a single combined dataset JSON
- [ ] **Validation Warnings**: Warn before saving if required header fields are missing
- [ ] **Cloud Storage**: Import images from Google Drive / S3
- [ ] **Review Mode**: Side-by-side original vs annotated view for QA

---

## License

MIT
