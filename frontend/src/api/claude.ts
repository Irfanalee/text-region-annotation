const API_BASE = '/api';

export interface ProgressEvent {
  type: 'start' | 'working' | 'progress' | 'done' | 'error';
  current?: number;
  total?: number;
  filename?: string;
  status?: 'annotated' | 'skipped' | 'error';
  fields_found?: number;
  message?: string;
  total_annotated?: number;
  total_skipped?: number;
  total_errors?: number;
}

export async function autoAnnotate(
  overwriteExisting = false,
  maxExamples = 3,
  onEvent: (e: ProgressEvent) => void = () => {},
): Promise<void> {
  const response = await fetch(`${API_BASE}/claude/auto-annotate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overwrite_existing: overwriteExisting, max_examples: maxExamples }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? ''; // keep incomplete last line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: ProgressEvent = JSON.parse(line.slice(6));
          onEvent(event);
        } catch {
          // ignore malformed line
        }
      }
    }
  }
}
