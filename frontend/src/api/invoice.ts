import { fetchJSON } from './client';
import { InvoiceAnnotation, LineItem, InvoiceField, HeaderFieldType } from '../types';

interface SaveInvoicePayload {
  line_items: LineItem[];
  header_fields: Partial<Record<HeaderFieldType, InvoiceField>>;
}

export async function fetchInvoiceAnnotation(filename: string): Promise<InvoiceAnnotation> {
  return fetchJSON<InvoiceAnnotation>(`/invoice/${encodeURIComponent(filename)}`);
}

export async function saveInvoiceAnnotation(
  filename: string,
  payload: SaveInvoicePayload
): Promise<InvoiceAnnotation> {
  return fetchJSON<InvoiceAnnotation>(`/invoice/${encodeURIComponent(filename)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteInvoiceAnnotation(filename: string): Promise<void> {
  await fetchJSON(`/invoice/${encodeURIComponent(filename)}`, { method: 'DELETE' });
}
