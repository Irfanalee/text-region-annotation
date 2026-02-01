import { fetchJSON } from './client';
import { ImageData } from '../types';

interface ImageListResponse {
  filename: string;
  width: number;
  height: number;
  annotation_count: number;
}

export async function fetchImages(): Promise<ImageData[]> {
  const data = await fetchJSON<ImageListResponse[]>('/images/');
  return data.map((img) => ({
    filename: img.filename,
    width: img.width,
    height: img.height,
    annotationCount: img.annotation_count,
  }));
}
