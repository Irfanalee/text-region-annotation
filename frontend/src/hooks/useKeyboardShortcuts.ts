import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useAnnotationStore } from '../store/annotationStore';
import { useImageStore } from '../store/imageStore';
import { saveAnnotations } from '../api/annotations';

export function useKeyboardShortcuts() {
  const { setTool, zoomIn, zoomOut } = useCanvasStore();
  const { selectedId, deleteAnnotation, annotations, isDirty, setSaving, markClean } =
    useAnnotationStore();
  const { nextImage, prevImage, images, currentIndex, updateAnnotationCount } = useImageStore();

  const currentImage = images[currentIndex];

  const handleSave = useCallback(async () => {
    if (!currentImage || !isDirty) return;

    setSaving(true);
    try {
      const result = await saveAnnotations(currentImage.filename, annotations);
      markClean();
      updateAnnotationCount(currentImage.filename, result.annotations.length);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  }, [currentImage, isDirty, annotations, setSaving, markClean, updateAnnotationCount]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Ignore if typing in input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        // Allow Ctrl+S even in inputs
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          await handleSave();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          setTool('draw');
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            await handleSave();
          } else {
            setTool('select');
          }
          break;
        case 'delete':
        case 'backspace':
          if (selectedId !== null) {
            e.preventDefault();
            deleteAnnotation(selectedId);
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          // Auto-save before navigating
          if (isDirty) {
            await handleSave();
          }
          prevImage();
          break;
        case 'arrowright':
          e.preventDefault();
          // Auto-save before navigating
          if (isDirty) {
            await handleSave();
          }
          nextImage();
          break;
        case 'escape':
          useAnnotationStore.getState().clearSelection();
          break;
        case '=':
        case '+':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
      }
    },
    [
      setTool,
      selectedId,
      deleteAnnotation,
      nextImage,
      prevImage,
      handleSave,
      isDirty,
      zoomIn,
      zoomOut,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Warn on unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
