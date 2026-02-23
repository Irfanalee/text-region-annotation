import { create } from 'zustand';
import {
  OcrBox,
  LabeledBox,
  FieldType,
  LineItem,
  LineItemFieldType,
  HeaderFieldType,
  InvoiceField,
  InvoiceAnnotation,
  LINE_ITEM_FIELDS,
} from '../types';

interface InvoiceStore {
  ocrBoxes: OcrBox[];
  labeledBoxes: LabeledBox[];
  selectedIds: Set<string>;
  lineItems: LineItem[];
  headerFields: Partial<Record<HeaderFieldType, InvoiceField>>;
  isDirty: boolean;
  isSaving: boolean;

  // OCR / load
  setOcrBoxes: (boxes: OcrBox[]) => void;
  loadInvoiceAnnotation: (annotation: InvoiceAnnotation) => void;
  clearAll: () => void;

  // Box mutations
  addManualBox: (bbox: [number, number, number, number]) => string;
  assignFieldType: (tempId: string, fieldType: FieldType) => void;
  updateBoxText: (tempId: string, text: string) => void;
  updateBoxBbox: (tempId: string, bbox: [number, number, number, number]) => void;
  deleteBox: (tempId: string) => void;

  // Selection
  selectBox: (tempId: string, addToSelection: boolean) => void;
  clearSelection: () => void;

  // Line items
  createLineItem: (tempIds: string[]) => void;
  removeLineItem: (lineItemId: number) => void;

  // Save
  buildSavePayload: () => { line_items: LineItem[]; header_fields: Partial<Record<HeaderFieldType, InvoiceField>> };
  setSaving: (saving: boolean) => void;
  markClean: () => void;
}

let manualCounter = 0;

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  ocrBoxes: [],
  labeledBoxes: [],
  selectedIds: new Set(),
  lineItems: [],
  headerFields: {},
  isDirty: false,
  isSaving: false,

  setOcrBoxes: (boxes) => {
    const { labeledBoxes } = get();
    // If we already have labeled boxes (from a loaded annotation), just update ocrBoxes
    if (labeledBoxes.length > 0) {
      set({ ocrBoxes: boxes });
      return;
    }
    // Initialize labeled boxes from OCR (all unassigned)
    const newBoxes: LabeledBox[] = boxes.map((b) => ({
      tempId: b.ocr_id,
      ocr_id: b.ocr_id,
      text: b.text,
      bbox: b.bbox as [number, number, number, number],
      confidence: b.confidence,
      fieldType: 'unassigned',
    }));
    set({ ocrBoxes: boxes, labeledBoxes: newBoxes });
  },

  loadInvoiceAnnotation: (annotation) => {
    const ocrMap = new Map(annotation.ocr_raw.map((b) => [b.ocr_id, b]));
    const boxes: LabeledBox[] = [];

    // Start with all OCR boxes as unassigned
    annotation.ocr_raw.forEach((b) => {
      boxes.push({
        tempId: b.ocr_id,
        ocr_id: b.ocr_id,
        text: b.text,
        bbox: b.bbox as [number, number, number, number],
        confidence: b.confidence,
        fieldType: 'unassigned',
      });
    });

    const lineItems: LineItem[] = annotation.line_items;

    // Apply field assignments from header_fields
    for (const [fieldType, field] of Object.entries(annotation.header_fields) as [HeaderFieldType, InvoiceField][]) {
      if (field.ocr_id) {
        const box = boxes.find((b) => b.ocr_id === field.ocr_id);
        if (box) {
          box.fieldType = fieldType;
          box.text = field.text;
        }
      } else {
        // Manual box for header field
        const tempId = `manual_hdr_${fieldType}`;
        boxes.push({
          tempId,
          ocr_id: null,
          text: field.text,
          bbox: field.bbox as [number, number, number, number],
          fieldType,
        });
      }
    }

    // Apply field assignments from line items
    for (const lineItem of annotation.line_items) {
      for (const [fieldType, field] of Object.entries(lineItem.fields) as [LineItemFieldType, InvoiceField][]) {
        if (field.ocr_id) {
          const box = boxes.find((b) => b.ocr_id === field.ocr_id);
          if (box) {
            box.fieldType = fieldType;
            box.text = field.text;
            box.lineItemId = lineItem.line_item_id;
          }
        } else {
          const tempId = `manual_li${lineItem.line_item_id}_${fieldType}`;
          boxes.push({
            tempId,
            ocr_id: null,
            text: field.text,
            bbox: field.bbox as [number, number, number, number],
            fieldType,
            lineItemId: lineItem.line_item_id,
          });
        }
      }
    }

    set({
      ocrBoxes: annotation.ocr_raw,
      labeledBoxes: boxes,
      lineItems,
      headerFields: annotation.header_fields,
      isDirty: false,
    });
  },

  clearAll: () => {
    manualCounter = 0;
    set({
      ocrBoxes: [],
      labeledBoxes: [],
      selectedIds: new Set(),
      lineItems: [],
      headerFields: {},
      isDirty: false,
      isSaving: false,
    });
  },

  addManualBox: (bbox) => {
    const tempId = `manual_${manualCounter++}`;
    const newBox: LabeledBox = {
      tempId,
      ocr_id: null,
      text: '',
      bbox,
      fieldType: 'unassigned',
    };
    set((state) => ({
      labeledBoxes: [...state.labeledBoxes, newBox],
      selectedIds: new Set([tempId]),
      isDirty: true,
    }));
    return tempId;
  },

  assignFieldType: (tempId, fieldType) => {
    set((state) => {
      const labeledBoxes = state.labeledBoxes.map((b) =>
        b.tempId === tempId ? { ...b, fieldType } : b
      );
      // Rebuild header fields
      const headerFields: Partial<Record<HeaderFieldType, InvoiceField>> = {};
      for (const box of labeledBoxes) {
        if (['invoice_number', 'invoice_date', 'vendor_name', 'total_gross'].includes(box.fieldType)) {
          headerFields[box.fieldType as HeaderFieldType] = {
            text: box.text,
            bbox: box.bbox,
            ocr_id: box.ocr_id ?? undefined,
          };
        }
      }
      return { labeledBoxes, headerFields, isDirty: true };
    });
  },

  updateBoxText: (tempId, text) => {
    set((state) => ({
      labeledBoxes: state.labeledBoxes.map((b) =>
        b.tempId === tempId ? { ...b, text } : b
      ),
      isDirty: true,
    }));
  },

  updateBoxBbox: (tempId, bbox) => {
    set((state) => ({
      labeledBoxes: state.labeledBoxes.map((b) =>
        b.tempId === tempId ? { ...b, bbox } : b
      ),
      isDirty: true,
    }));
  },

  deleteBox: (tempId) => {
    set((state) => {
      const box = state.labeledBoxes.find((b) => b.tempId === tempId);
      const newBoxes = state.labeledBoxes.filter((b) => b.tempId !== tempId);
      const newSelected = new Set(state.selectedIds);
      newSelected.delete(tempId);

      // Remove from line items if grouped
      let lineItems = state.lineItems;
      if (box?.lineItemId !== undefined) {
        lineItems = lineItems.map((li) => {
          if (li.line_item_id !== box.lineItemId) return li;
          const fields = { ...li.fields };
          for (const [k, v] of Object.entries(fields)) {
            if (v.ocr_id === box.ocr_id && box.ocr_id !== null) delete fields[k as LineItemFieldType];
          }
          return { ...li, fields };
        });
      }

      return { labeledBoxes: newBoxes, selectedIds: newSelected, lineItems, isDirty: true };
    });
  },

  selectBox: (tempId, addToSelection) => {
    set((state) => {
      const newSelected = addToSelection ? new Set(state.selectedIds) : new Set<string>();
      if (newSelected.has(tempId) && addToSelection) {
        newSelected.delete(tempId);
      } else {
        newSelected.add(tempId);
      }
      return { selectedIds: newSelected };
    });
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  createLineItem: (tempIds) => {
    set((state) => {
      // Validate all boxes have line item field types
      const boxes = tempIds.map((id) => state.labeledBoxes.find((b) => b.tempId === id)).filter(Boolean) as LabeledBox[];
      const invalid = boxes.filter((b) => !LINE_ITEM_FIELDS.includes(b.fieldType as LineItemFieldType));
      if (invalid.length > 0) return {}; // silently skip

      const nextId = state.lineItems.length > 0
        ? Math.max(...state.lineItems.map((li) => li.line_item_id)) + 1
        : 1;

      const fields: Partial<Record<LineItemFieldType, InvoiceField>> = {};
      for (const box of boxes) {
        fields[box.fieldType as LineItemFieldType] = {
          text: box.text,
          bbox: box.bbox,
          ocr_id: box.ocr_id ?? undefined,
        };
      }

      const newLineItem: LineItem = { line_item_id: nextId, fields };
      const updatedBoxes = state.labeledBoxes.map((b) =>
        tempIds.includes(b.tempId) ? { ...b, lineItemId: nextId } : b
      );

      return {
        lineItems: [...state.lineItems, newLineItem],
        labeledBoxes: updatedBoxes,
        isDirty: true,
      };
    });
  },

  removeLineItem: (lineItemId) => {
    set((state) => ({
      lineItems: state.lineItems.filter((li) => li.line_item_id !== lineItemId),
      labeledBoxes: state.labeledBoxes.map((b) =>
        b.lineItemId === lineItemId ? { ...b, lineItemId: undefined } : b
      ),
      isDirty: true,
    }));
  },

  buildSavePayload: () => {
    const { lineItems, headerFields } = get();
    return { line_items: lineItems, header_fields: headerFields };
  },

  setSaving: (isSaving) => set({ isSaving }),
  markClean: () => set({ isDirty: false }),
}));
