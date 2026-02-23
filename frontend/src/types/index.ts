export type ToolMode = 'select' | 'draw';

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface Point {
  x: number;
  y: number;
}

export type HandlePosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'right-center'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'left-center'
  | 'body'
  | null;

export interface ImageData {
  filename: string;
  width: number;
  height: number;
  annotationCount: number;
  isSample?: boolean;
  ocrStatus: 'pending' | 'running' | 'done' | 'error';
  isAnnotated: boolean;
}

// ---- Invoice field types ----

export type LineItemFieldType =
  | 'description'
  | 'quantity'
  | 'unit_measure'
  | 'net_price'
  | 'net_worth'
  | 'vat'
  | 'gross_worth';

export type HeaderFieldType =
  | 'invoice_number'
  | 'invoice_date'
  | 'vendor_name'
  | 'total_gross';

export type FieldType = LineItemFieldType | HeaderFieldType | 'other' | 'unassigned';

export const LINE_ITEM_FIELDS: LineItemFieldType[] = [
  'description',
  'quantity',
  'unit_measure',
  'net_price',
  'net_worth',
  'vat',
  'gross_worth',
];

export const HEADER_FIELDS: HeaderFieldType[] = [
  'invoice_number',
  'invoice_date',
  'vendor_name',
  'total_gross',
];

export const FIELD_COLORS: Record<FieldType, string> = {
  description: '#3B82F6',
  quantity: '#10B981',
  unit_measure: '#8B5CF6',
  net_price: '#F59E0B',
  net_worth: '#EF4444',
  vat: '#EC4899',
  gross_worth: '#14B8A6',
  invoice_number: '#F97316',
  invoice_date: '#6366F1',
  vendor_name: '#84CC16',
  total_gross: '#06B6D4',
  other: '#6B7280',
  unassigned: '#D1D5DB',
};

// ---- OCR / Invoice data structures ----

export interface OcrBox {
  ocr_id: string;
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface LabeledBox {
  tempId: string;        // "ocr_0" or "manual_0", "manual_1", …
  ocr_id: string | null; // null = manually drawn
  text: string;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] image-space pixels
  confidence?: number;
  fieldType: FieldType;
  lineItemId?: number;
}

export interface InvoiceField {
  text: string;
  bbox: [number, number, number, number];
  ocr_id?: string;
}

export interface LineItem {
  line_item_id: number;
  fields: Partial<Record<LineItemFieldType, InvoiceField>>;
}

export interface InvoiceAnnotation {
  document_id: string;
  image_path: string;
  ocr_raw: OcrBox[];
  line_items: LineItem[];
  header_fields: Partial<Record<HeaderFieldType, InvoiceField>>;
}
