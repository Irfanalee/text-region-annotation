import { useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { ImageSidebar } from './components/ImageSidebar';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { FieldLabelDropdown } from './components/FieldLabelDropdown';
import { InvoicePanel } from './components/InvoicePanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useImageStore } from './store/imageStore';
import { useInvoiceStore } from './store/invoiceStore';
import { fetchImages } from './api/images';
import { fetchInvoiceAnnotation, saveInvoiceAnnotation } from './api/invoice';
import { getOcrCache, runOcr } from './api/ocr';

function App() {
  const { images, currentIndex, setImages, setLoading, setError, setOcrStatus, setIsAnnotated } =
    useImageStore();
  const { clearAll, loadInvoiceAnnotation, setOcrBoxes, buildSavePayload, isDirty, setSaving, markClean } =
    useInvoiceStore();

  const prevIndexRef = useRef<number | null>(null);
  const currentImage = images[currentIndex];
  const currentFilename = currentImage?.filename;

  useKeyboardShortcuts();

  // Load images on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchImages();
        setImages(data);
      } catch (error) {
        console.error('Failed to load images:', error);
        setError('Failed to load images');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [setImages, setLoading, setError]);

  // On image change: save prev, load annotation + OCR for new
  useEffect(() => {
    if (!currentFilename) {
      clearAll();
      return;
    }

    let cancelled = false;
    const prevIdx = prevIndexRef.current;
    prevIndexRef.current = currentIndex;

    const run = async () => {
      // Auto-save previous image if dirty
      if (prevIdx !== null && prevIdx !== currentIndex && isDirty) {
        const prevImage = images[prevIdx];
        if (prevImage) {
          setSaving(true);
          try {
            await saveInvoiceAnnotation(prevImage.filename, buildSavePayload());
            if (!cancelled) setIsAnnotated(prevImage.filename, true);
          } catch (e) {
            console.error('Failed to auto-save:', e);
          } finally {
            if (!cancelled) setSaving(false);
          }
        }
      }

      if (cancelled) return;
      clearAll();

      // Load existing annotation (always succeeds — returns empty structure if none)
      try {
        const annotation = await fetchInvoiceAnnotation(currentFilename);
        if (!cancelled) loadInvoiceAnnotation(annotation);
      } catch (e) {
        console.error('Failed to load annotation:', e);
      }

      if (cancelled) return;

      // Load OCR: try cache first, run if missing
      try {
        const cached = await getOcrCache(currentFilename);
        if (!cancelled) {
          setOcrBoxes(cached);
          setOcrStatus(currentFilename, 'done');
        }
      } catch {
        // 404 → run OCR
        if (cancelled) return;
        setOcrStatus(currentFilename, 'running');
        try {
          const boxes = await runOcr(currentFilename);
          if (!cancelled) {
            setOcrBoxes(boxes);
            setOcrStatus(currentFilename, 'done');
          }
        } catch (e) {
          console.error('OCR failed:', e);
          if (!cancelled) setOcrStatus(currentFilename, 'error');
        }
      }
    };

    run();
    return () => { cancelled = true; };
  }, [currentFilename, currentIndex]);

  return (
    <Layout>
      <ImageSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Toolbar />
        <div className="flex-1 flex overflow-hidden relative">
          <AnnotationCanvas />
          <FieldLabelDropdown />
        </div>
      </div>
      <InvoicePanel />
    </Layout>
  );
}

export default App;
