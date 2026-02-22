import { fetchJSON } from './client';

export interface ClaudeAnnotateResult {
  filename: string;
  status: 'success' | 'skipped' | 'error';
  annotations_added: number;
  message: string;
}

export interface ClaudeAnnotateResponse {
  results: ClaudeAnnotateResult[];
  total_annotated: number;
  total_skipped: number;
  total_errors: number;
}

export async function autoAnnotate(overwriteExisting = false): Promise<ClaudeAnnotateResponse> {
  return fetchJSON<ClaudeAnnotateResponse>('/claude/annotate', {
    method: 'POST',
    body: JSON.stringify({ overwrite_existing: overwriteExisting }),
  });
}
