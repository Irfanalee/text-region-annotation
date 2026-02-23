import React, { useState } from 'react';
import { useInvoiceStore } from '../store/invoiceStore';
import { useImageStore } from '../store/imageStore';
import { saveInvoiceAnnotation } from '../api/invoice';
import { FIELD_COLORS, LINE_ITEM_FIELDS, HEADER_FIELDS, LineItemFieldType, HeaderFieldType } from '../types';

export const InvoicePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'line_items' | 'headers'>('line_items');
  const [jsonOpen, setJsonOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const {
    lineItems,
    headerFields,
    labeledBoxes,
    selectedIds,
    removeLineItem,
    createLineItem,
    buildSavePayload,
    markClean,
    isDirty,
  } = useInvoiceStore();

  const { images, currentIndex, setIsAnnotated } = useImageStore();
  const currentImage = images[currentIndex] || null;

  const handleSave = async () => {
    if (!currentImage) return;
    setIsSaving(true);
    try {
      const payload = buildSavePayload();
      await saveInvoiceAnnotation(currentImage.filename, payload);
      markClean();
      setIsAnnotated(currentImage.filename, true);
    } catch (e) {
      console.error('Failed to save:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const canCreateLineItem = (() => {
    if (selectedIds.size < 2) return false;
    const boxes = [...selectedIds]
      .map((id) => labeledBoxes.find((b) => b.tempId === id))
      .filter(Boolean);
    return boxes.every((b) => b && LINE_ITEM_FIELDS.includes(b.fieldType as LineItemFieldType));
  })();

  const handleCreateLineItem = () => {
    createLineItem([...selectedIds]);
  };

  const savePayload = buildSavePayload();

  return (
    <div className="w-72 flex flex-col border-l border-gray-200 bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'line_items'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('line_items')}
        >
          Line Items ({lineItems.length})
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            activeTab === 'headers'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('headers')}
        >
          Headers ({Object.keys(headerFields).length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeTab === 'line_items' && (
          <>
            {/* Create line item button */}
            <button
              onClick={handleCreateLineItem}
              disabled={!canCreateLineItem}
              className="w-full py-1.5 text-sm rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              + Create Line Item
              {!canCreateLineItem && selectedIds.size > 0 && (
                <span className="block text-[10px] text-blue-400">
                  Select 2+ line-item fields
                </span>
              )}
            </button>

            {lineItems.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">No line items yet</p>
            )}

            {lineItems.map((li) => (
              <div key={li.line_item_id} className="border border-gray-200 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">
                    Line Item #{li.line_item_id}
                  </span>
                  <button
                    onClick={() => removeLineItem(li.line_item_id)}
                    className="text-red-400 hover:text-red-600 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-0.5">
                  {LINE_ITEM_FIELDS.filter((f) => li.fields[f]).map((field) => {
                    const val = li.fields[field];
                    if (!val) return null;
                    return (
                      <div key={field} className="flex items-start gap-1">
                        <span
                          className="text-[10px] font-medium px-1 py-0.5 rounded flex-shrink-0"
                          style={{
                            backgroundColor: FIELD_COLORS[field] + '22',
                            color: FIELD_COLORS[field],
                          }}
                        >
                          {field.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-gray-700 truncate">{val.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        {activeTab === 'headers' && (
          <>
            {HEADER_FIELDS.map((field) => {
              const val = headerFields[field as HeaderFieldType];
              return (
                <div key={field} className="flex items-start gap-2 py-1 border-b border-gray-100 last:border-0">
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                      backgroundColor: FIELD_COLORS[field] + '22',
                      color: FIELD_COLORS[field],
                    }}
                  >
                    {field.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-gray-700 truncate">
                    {val ? val.text : <span className="text-gray-300 italic">—</span>}
                  </span>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* JSON preview */}
      <div className="border-t border-gray-200">
        <button
          onClick={() => setJsonOpen((o) => !o)}
          className="w-full text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 flex items-center justify-between"
        >
          <span>JSON Preview</span>
          <span>{jsonOpen ? '▲' : '▼'}</span>
        </button>
        {jsonOpen && (
          <pre className="text-[10px] bg-gray-50 p-2 max-h-48 overflow-auto text-gray-600 leading-relaxed">
            {JSON.stringify(savePayload, null, 2)}
          </pre>
        )}
      </div>

      {/* Save button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={!currentImage || isSaving}
          className={`w-full py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            isDirty
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {isSaving ? 'Saving…' : isDirty ? 'Save *' : 'Saved'}
        </button>
      </div>
    </div>
  );
};
