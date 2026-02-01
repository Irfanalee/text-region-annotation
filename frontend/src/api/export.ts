import { fetchJSON } from './client';
import { ExportResponse } from '../types';

export type ExportFormat = 'yolo' | 'coco' | 'trocr';

export async function exportAnnotations(
  format: ExportFormat,
  includeEmpty: boolean = false
): Promise<ExportResponse> {
  return fetchJSON<ExportResponse>(`/export/${format}`, {
    method: 'POST',
    body: JSON.stringify({ include_empty: includeEmpty }),
  });
}
