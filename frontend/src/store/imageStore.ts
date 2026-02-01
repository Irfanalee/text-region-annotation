import { create } from 'zustand';
import { ImageData } from '../types';

interface ImageStore {
  images: ImageData[];
  currentIndex: number;
  isLoading: boolean;
  error: string | null;

  setImages: (images: ImageData[]) => void;
  setCurrentIndex: (index: number) => void;
  nextImage: () => void;
  prevImage: () => void;
  updateAnnotationCount: (filename: string, count: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getCurrentImage: () => ImageData | null;
}

export const useImageStore = create<ImageStore>((set, get) => ({
  images: [],
  currentIndex: 0,
  isLoading: false,
  error: null,

  setImages: (images) =>
    set({
      images,
      currentIndex: 0,
      error: null,
    }),

  setCurrentIndex: (index) => {
    const { images } = get();
    if (index >= 0 && index < images.length) {
      set({ currentIndex: index });
    }
  },

  nextImage: () => {
    const { currentIndex, images } = get();
    if (currentIndex < images.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevImage: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  updateAnnotationCount: (filename, count) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.filename === filename ? { ...img, annotationCount: count } : img
      ),
    }));
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  getCurrentImage: () => {
    const { images, currentIndex } = get();
    return images[currentIndex] || null;
  },
}));
