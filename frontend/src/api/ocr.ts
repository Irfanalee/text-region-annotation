import { fetchJSON } from './client';
import { OcrBox } from '../types';

interface OcrResult {
  filename: string;
  ocr_boxes: OcrBox[];
}

export async function getOcrCache(filename: string): Promise<OcrBox[]> {
  const data = await fetchJSON<OcrResult>(`/ocr/${encodeURIComponent(filename)}`);
  return data.ocr_boxes;
}

export async function runOcr(filename: string): Promise<OcrBox[]> {
  const data = await fetchJSON<OcrResult>(`/ocr/${encodeURIComponent(filename)}`, {
    method: 'POST',
  });
  return data.ocr_boxes;
}
