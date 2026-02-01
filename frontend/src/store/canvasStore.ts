import { create } from 'zustand';
import { ToolMode, CanvasTransform, Point } from '../types';

interface CanvasStore {
  tool: ToolMode;
  transform: CanvasTransform;
  isDrawing: boolean;
  isPanning: boolean;
  drawStartPoint: Point | null;

  setTool: (tool: ToolMode) => void;
  setZoom: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  pan: (deltaX: number, deltaY: number) => void;
  setOffset: (x: number, y: number) => void;
  setTransform: (transform: CanvasTransform) => void;
  startDrawing: (x: number, y: number) => void;
  stopDrawing: () => void;
  startPanning: () => void;
  stopPanning: () => void;
}

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  tool: 'select',
  transform: { scale: 1, offsetX: 0, offsetY: 0 },
  isDrawing: false,
  isPanning: false,
  drawStartPoint: null,

  setTool: (tool) => set({ tool }),

  setZoom: (scale) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
    set((state) => ({
      transform: { ...state.transform, scale: clamped },
    }));
  },

  zoomIn: () => {
    const { transform } = get();
    const newScale = Math.min(MAX_ZOOM, transform.scale + ZOOM_STEP);
    set({ transform: { ...transform, scale: newScale } });
  },

  zoomOut: () => {
    const { transform } = get();
    const newScale = Math.max(MIN_ZOOM, transform.scale - ZOOM_STEP);
    set({ transform: { ...transform, scale: newScale } });
  },

  resetZoom: () =>
    set({
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
    }),

  pan: (deltaX, deltaY) => {
    set((state) => ({
      transform: {
        ...state.transform,
        offsetX: state.transform.offsetX + deltaX,
        offsetY: state.transform.offsetY + deltaY,
      },
    }));
  },

  setOffset: (x, y) => {
    set((state) => ({
      transform: { ...state.transform, offsetX: x, offsetY: y },
    }));
  },

  setTransform: (transform) => set({ transform }),

  startDrawing: (x, y) => set({ isDrawing: true, drawStartPoint: { x, y } }),
  stopDrawing: () => set({ isDrawing: false, drawStartPoint: null }),
  startPanning: () => set({ isPanning: true }),
  stopPanning: () => set({ isPanning: false }),
}));
