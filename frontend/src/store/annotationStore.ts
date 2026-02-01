import { create } from 'zustand';
import { BoundingBox } from '../types';

interface AnnotationStore {
  annotations: BoundingBox[];
  selectedId: number | null;
  isDirty: boolean;
  isSaving: boolean;

  setAnnotations: (annotations: BoundingBox[]) => void;
  addAnnotation: (annotation: Omit<BoundingBox, 'id'>) => number;
  updateAnnotation: (id: number, updates: Partial<BoundingBox>) => void;
  deleteAnnotation: (id: number) => void;
  selectAnnotation: (id: number | null) => void;
  clearSelection: () => void;
  markClean: () => void;
  setSaving: (saving: boolean) => void;
  getSelectedAnnotation: () => BoundingBox | null;
}

let nextTempId = -1;

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  annotations: [],
  selectedId: null,
  isDirty: false,
  isSaving: false,

  setAnnotations: (annotations) =>
    set({ annotations, isDirty: false, selectedId: null }),

  addAnnotation: (annotation) => {
    const id = nextTempId--;
    set((state) => ({
      annotations: [
        ...state.annotations,
        { ...annotation, id, classId: 0 },
      ],
      selectedId: id,
      isDirty: true,
    }));
    return id;
  },

  updateAnnotation: (id, updates) => {
    set((state) => ({
      annotations: state.annotations.map((ann) =>
        ann.id === id ? { ...ann, ...updates } : ann
      ),
      isDirty: true,
    }));
  },

  deleteAnnotation: (id) => {
    set((state) => ({
      annotations: state.annotations.filter((ann) => ann.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
      isDirty: true,
    }));
  },

  selectAnnotation: (id) => set({ selectedId: id }),
  clearSelection: () => set({ selectedId: null }),
  markClean: () => set({ isDirty: false }),
  setSaving: (saving) => set({ isSaving: saving }),

  getSelectedAnnotation: () => {
    const { annotations, selectedId } = get();
    return annotations.find((a) => a.id === selectedId) || null;
  },
}));
