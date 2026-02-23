import { fetchJSON } from './client';

export interface ExportStats {
  total_documents: number;
  output_path: string;
  format: string;
}

export async function exportJsonl(): Promise<ExportStats> {
  return fetchJSON<ExportStats>('/export/jsonl', { method: 'POST' });
}

export async function exportHuggingFace(): Promise<ExportStats> {
  return fetchJSON<ExportStats>('/export/huggingface', { method: 'POST' });
}

export function getJsonlDownloadUrl(): string {
  return '/api/export/download/jsonl';
}

export function getHuggingFaceDownloadUrl(): string {
  return '/api/export/download/huggingface';
}
