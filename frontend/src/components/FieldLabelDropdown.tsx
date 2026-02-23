import React, { useEffect, useRef } from 'react';
import { useInvoiceStore } from '../store/invoiceStore';
import { useCanvasStore } from '../store/canvasStore';
import {
  FieldType,
  FIELD_COLORS,
  LINE_ITEM_FIELDS,
  HEADER_FIELDS,
} from '../types';

export const FieldLabelDropdown: React.FC = () => {
  const { labeledBoxes, selectedIds, assignFieldType, updateBoxText } = useInvoiceStore();
  const { transform } = useCanvasStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Only show when exactly one box is selected
  if (selectedIds.size !== 1) return null;

  const tempId = [...selectedIds][0];
  const box = labeledBoxes.find((b) => b.tempId === tempId);
  if (!box) return null;

  // Compute screen position relative to parent container
  const container = document.getElementById('canvas-container');
  if (!container) return null;

  const containerRect = container.getBoundingClientRect();
  const boxScreenX = box.bbox[0] * transform.scale + transform.offsetX;
  const boxScreenY = box.bbox[1] * transform.scale + transform.offsetY;
  const boxScreenY2 = box.bbox[3] * transform.scale + transform.offsetY;

  // Position above or below the box depending on space
  const dropdownH = 280;
  const spaceAbove = boxScreenY;
  const preferAbove = spaceAbove >= dropdownH;
  const top = preferAbove
    ? Math.max(0, boxScreenY - dropdownH - 4)
    : Math.min(containerRect.height - dropdownH - 4, boxScreenY2 + 4);
  const left = Math.min(
    containerRect.width - 220,
    Math.max(0, boxScreenX)
  );

  const handleAssign = (ft: FieldType) => {
    assignFieldType(tempId, ft);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-52 overflow-hidden"
      style={{ top, left }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Text correction */}
      <div className="px-2 pt-2 pb-1 border-b border-gray-100">
        <input
          type="text"
          className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
          placeholder="Edit text..."
          value={box.text}
          onChange={(e) => updateBoxText(tempId, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>

      {/* Header fields */}
      <div className="px-2 pt-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Header</p>
        <div className="grid grid-cols-2 gap-0.5">
          {HEADER_FIELDS.map((ft) => (
            <button
              key={ft}
              onClick={() => handleAssign(ft)}
              className="text-[11px] px-1.5 py-0.5 rounded text-left truncate hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: FIELD_COLORS[ft] + '22',
                color: FIELD_COLORS[ft],
                border: `1px solid ${FIELD_COLORS[ft]}55`,
                fontWeight: box.fieldType === ft ? 700 : 400,
                outline: box.fieldType === ft ? `2px solid ${FIELD_COLORS[ft]}` : undefined,
              }}
            >
              {ft.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Line item fields */}
      <div className="px-2 pt-1">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Line Item</p>
        <div className="grid grid-cols-2 gap-0.5">
          {LINE_ITEM_FIELDS.map((ft) => (
            <button
              key={ft}
              onClick={() => handleAssign(ft)}
              className="text-[11px] px-1.5 py-0.5 rounded text-left truncate hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: FIELD_COLORS[ft] + '22',
                color: FIELD_COLORS[ft],
                border: `1px solid ${FIELD_COLORS[ft]}55`,
                fontWeight: box.fieldType === ft ? 700 : 400,
                outline: box.fieldType === ft ? `2px solid ${FIELD_COLORS[ft]}` : undefined,
              }}
            >
              {ft.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Other / Unassign */}
      <div className="px-2 pt-1 pb-2 flex gap-1">
        <button
          onClick={() => handleAssign('other')}
          className="flex-1 text-[11px] px-1.5 py-0.5 rounded text-left hover:opacity-80"
          style={{
            backgroundColor: FIELD_COLORS['other'] + '22',
            color: FIELD_COLORS['other'],
            border: `1px solid ${FIELD_COLORS['other']}55`,
            fontWeight: box.fieldType === 'other' ? 700 : 400,
          }}
        >
          other
        </button>
        <button
          onClick={() => handleAssign('unassigned')}
          className="flex-1 text-[11px] px-1.5 py-0.5 rounded text-left hover:opacity-80"
          style={{
            backgroundColor: FIELD_COLORS['unassigned'] + '22',
            color: '#6B7280',
            border: `1px solid ${FIELD_COLORS['unassigned']}55`,
          }}
        >
          unassign
        </button>
      </div>
    </div>
  );
};
