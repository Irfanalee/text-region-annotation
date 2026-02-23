import { fetchJSON } from './client';

export interface AutoAnnotateResult {
  filename: string;
  status: 'annotated' | 'skipped' | 'error';
  fields_found: number;
  message: string;
}

export interface AutoAnnotateResponse {
  results: AutoAnnotateResult[];
  total_annotated: number;
  total_skipped: number;
  total_errors: number;
}

export async function autoAnnotate(
  overwriteExisting = false,
  maxExamples = 3
): Promise<AutoAnnotateResponse> {
  return fetchJSON<AutoAnnotateResponse>('/claude/auto-annotate', {
    method: 'POST',
    body: JSON.stringify({
      overwrite_existing: overwriteExisting,
      max_examples: maxExamples,
    }),
  });
}
