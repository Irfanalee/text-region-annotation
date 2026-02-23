import React from 'react';
import { FIELD_COLORS, LINE_ITEM_FIELDS, HEADER_FIELDS } from '../types';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[680px] max-h-[85vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-gray-800">How to Use the Invoice Annotation Tool</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6 text-sm text-gray-700">

          {/* Workflow */}
          <section>
            <h3 className="font-semibold text-gray-900 mb-2 text-base">Workflow</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
              <li>Upload invoice images via the sidebar.</li>
              <li>OCR runs automatically — colored boxes appear over detected text regions.</li>
              <li>Click a box to select it → a dropdown appears to assign a field label.</li>
              <li>For line item fields, shift+click multiple boxes then press <kbd className="bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-xs">G</kbd> (or click <em>Create Line Item</em> in the panel) to group them into one row.</li>
              <li>Press <kbd className="bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-xs">Ctrl+S</kbd> or click Save to write the annotation JSON.</li>
              <li>Use arrow keys to move to the next invoice.</li>
            </ol>
          </section>

          {/* Header vs Line Item */}
          <section>
            <h3 className="font-semibold text-gray-900 mb-2 text-base">Header Fields vs Line Item Fields</h3>
            <p className="text-gray-600 mb-3">
              The key distinction: <strong>header fields appear once per invoice</strong>, while <strong>line item fields repeat for each product or service</strong>.
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* Header */}
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-semibold text-gray-800 mb-2">Header Fields</p>
                <p className="text-xs text-gray-500 mb-2">Document-level data. Appears once.</p>
                <div className="space-y-1.5">
                  {HEADER_FIELDS.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ backgroundColor: FIELD_COLORS[f] + '22', color: FIELD_COLORS[f] }}
                      >
                        {f.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {f === 'invoice_number' && 'e.g. INV-2024-001'}
                        {f === 'invoice_date' && 'e.g. 2024-01-15'}
                        {f === 'vendor_name' && 'e.g. Acme Corp'}
                        {f === 'total_gross' && 'e.g. $1,250.00'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Line Item */}
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="font-semibold text-gray-800 mb-2">Line Item Fields</p>
                <p className="text-xs text-gray-500 mb-2">Row-level data. Repeats per product.</p>
                <div className="space-y-1.5">
                  {LINE_ITEM_FIELDS.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ backgroundColor: FIELD_COLORS[f] + '22', color: FIELD_COLORS[f] }}
                      >
                        {f.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-500">
                        {f === 'description' && 'e.g. Web Design'}
                        {f === 'quantity' && 'e.g. 5'}
                        {f === 'unit_measure' && 'e.g. hours'}
                        {f === 'net_price' && 'e.g. $150.00'}
                        {f === 'net_worth' && 'e.g. $750.00'}
                        {f === 'vat' && 'e.g. 23%'}
                        {f === 'gross_worth' && 'e.g. $922.50'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* What to annotate */}
          <section>
            <h3 className="font-semibold text-gray-900 mb-2 text-base">What to Annotate</h3>
            <p className="text-gray-600 mb-2">
              Always annotate the <strong>value</strong>, not the label text next to it.
            </p>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5 text-xs font-mono">
              <div className="flex gap-3">
                <span className="text-red-400 w-32">❌ "Invoice no:"</span>
                <span className="text-gray-400">← static label, leave unassigned</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 w-32">✓ "22862792"</span>
                <span className="text-gray-400">← the value → assign invoice_number</span>
              </div>
              <div className="flex gap-3 mt-1">
                <span className="text-red-400 w-32">❌ "Date:"</span>
                <span className="text-gray-400">← static label, leave unassigned</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-600 w-32">✓ "2024-01-15"</span>
                <span className="text-gray-400">← the value → assign invoice_date</span>
              </div>
            </div>
          </section>

          {/* Grouping line items */}
          <section>
            <h3 className="font-semibold text-gray-900 mb-2 text-base">Grouping Line Items</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
              <li>Assign field types to each box in a row (description, quantity, net price, etc.).</li>
              <li>Shift+click each box in that row to multi-select them.</li>
              <li>Press <kbd className="bg-gray-100 border border-gray-300 rounded px-1 py-0.5 text-xs">G</kbd> or click <em>Create Line Item</em> in the right panel.</li>
              <li>Repeat for each row in the table.</li>
            </ol>
            <p className="text-xs text-gray-400 mt-2">
              Note: all selected boxes must have line item field types (not header types) to create a group.
            </p>
          </section>

          {/* Keyboard shortcuts */}
          <section>
            <h3 className="font-semibold text-gray-900 mb-2 text-base">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-600">
              {[
                ['S', 'Select tool'],
                ['D', 'Draw box tool'],
                ['G', 'Group selection as line item'],
                ['Delete / Backspace', 'Delete selected box(es)'],
                ['Escape', 'Clear selection'],
                ['← →', 'Previous / next image'],
                ['Ctrl+S', 'Save annotation'],
                ['Ctrl+Scroll', 'Zoom in/out'],
                ['Scroll', 'Pan image'],
                ['Middle mouse drag', 'Pan image'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center gap-2">
                  <kbd className="bg-gray-100 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-mono whitespace-nowrap">
                    {key}
                  </kbd>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
