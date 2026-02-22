export interface BoundingBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  transcription: string;
  classId?: number;
}

export interface ImageData {
  filename: string;
  width: number;
  height: number;
  annotationCount: number;
  isSample?: boolean;
}

export interface ImageAnnotations {
  filename: string;
  width: number;
  height: number;
  annotations: BoundingBox[];
}

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

export interface ExportResponse {
  path: string;
  format: string;
  file_count: number;
  annotation_count: number;
}
