import { useEffect, useCallback } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useImageStore } from '../store/imageStore';
import { saveInvoiceAnnotation } from '../api/invoice';

export function useKeyboardShortcuts() {
  const { setTool, zoomIn, zoomOut } = useCanvasStore();
  const {
    selectedIds,
    deleteBox,
    isDirty,
    setSaving,
    markClean,
    buildSavePayload,
    createLineItem,
  } = useInvoiceStore();
  const { nextImage, prevImage, images, currentIndex, setIsAnnotated } = useImageStore();

  const currentImage = images[currentIndex];

  const handleSave = useCallback(async () => {
    if (!currentImage || !isDirty) return;
    setSaving(true);
    try {
      await saveInvoiceAnnotation(currentImage.filename, buildSavePayload());
      markClean();
      setIsAnnotated(currentImage.filename, true);
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setSaving(false);
    }
  }, [currentImage, isDirty, buildSavePayload, setSaving, markClean, setIsAnnotated]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
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
          if (selectedIds.size > 0) {
            e.preventDefault();
            [...selectedIds].forEach((id) => deleteBox(id));
          }
          break;
        case 'g':
          if (selectedIds.size >= 2) {
            e.preventDefault();
            createLineItem([...selectedIds]);
          }
          break;
        case 'escape':
          useInvoiceStore.getState().clearSelection();
          break;
        case 'arrowleft':
          e.preventDefault();
          if (isDirty) await handleSave();
          prevImage();
          break;
        case 'arrowright':
          e.preventDefault();
          if (isDirty) await handleSave();
          nextImage();
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
      selectedIds,
      deleteBox,
      createLineItem,
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
