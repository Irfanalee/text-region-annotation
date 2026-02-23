import { fetchJSON } from './client';
import { ImageData } from '../types';

interface ImageListResponse {
  filename: string;
  width: number;
  height: number;
  annotation_count: number;
  is_sample: boolean;
  ocr_status: string;
  is_annotated: boolean;
}

export interface UploadResponse {
  uploaded: { filename: string; width: number; height: number }[];
  failed: { filename: string; error: string }[];
  total_uploaded: number;
  total_failed: number;
}

export async function fetchImages(): Promise<ImageData[]> {
  const data = await fetchJSON<ImageListResponse[]>('/images/');
  return data.map((img) => ({
    filename: img.filename,
    width: img.width,
    height: img.height,
    annotationCount: img.annotation_count,
    isSample: img.is_sample,
    ocrStatus: (img.ocr_status ?? 'pending') as ImageData['ocrStatus'],
    isAnnotated: img.is_annotated ?? false,
  }));
}

export async function uploadImages(files: FileList): Promise<UploadResponse> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const response = await fetch('/api/images/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Upload failed: ${response.status}`);
  }

  return response.json();
}

export async function deleteImage(filename: string): Promise<void> {
  await fetchJSON(`/images/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
}

export async function markAsSample(filename: string, isSample: boolean): Promise<void> {
  await fetchJSON(`/images/${encodeURIComponent(filename)}/sample`, {
    method: 'PATCH',
    body: JSON.stringify({ is_sample: isSample }),
  });
}
