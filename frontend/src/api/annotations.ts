import { fetchJSON } from './client';
import { BoundingBox, ImageAnnotations } from '../types';

interface AnnotationResponse {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  transcription: string;
  class_id: number;
  created_at: string;
  updated_at: string;
}

interface ImageAnnotationsResponse {
  filename: string;
  width: number;
  height: number;
  annotations: AnnotationResponse[];
}

function mapAnnotation(ann: AnnotationResponse): BoundingBox {
  return {
    id: ann.id,
    x: ann.x,
    y: ann.y,
    width: ann.width,
    height: ann.height,
    transcription: ann.transcription,
    classId: ann.class_id,
  };
}

export async function fetchAnnotations(
  filename: string
): Promise<ImageAnnotations> {
  const data = await fetchJSON<ImageAnnotationsResponse>(
    `/annotations/${encodeURIComponent(filename)}`
  );
  return {
    filename: data.filename,
    width: data.width,
    height: data.height,
    annotations: data.annotations.map(mapAnnotation),
  };
}

export async function saveAnnotations(
  filename: string,
  annotations: BoundingBox[]
): Promise<ImageAnnotations> {
  const payload = annotations.map((ann) => ({
    x: ann.x,
    y: ann.y,
    width: ann.width,
    height: ann.height,
    transcription: ann.transcription,
    class_id: ann.classId || 0,
  }));

  const data = await fetchJSON<ImageAnnotationsResponse>(
    `/annotations/${encodeURIComponent(filename)}/bulk`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );

  return {
    filename: data.filename,
    width: data.width,
    height: data.height,
    annotations: data.annotations.map(mapAnnotation),
  };
}

export async function deleteAnnotation(
  filename: string,
  annotationId: number
): Promise<void> {
  await fetchJSON(`/annotations/${encodeURIComponent(filename)}/${annotationId}`, {
    method: 'DELETE',
  });
}
