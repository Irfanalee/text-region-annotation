import { useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Toolbar } from './components/Toolbar';
import { ImageSidebar } from './components/ImageSidebar';
import { AnnotationCanvas } from './components/AnnotationCanvas';
import { AnnotationPanel } from './components/AnnotationPanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useImageStore } from './store/imageStore';
import { useAnnotationStore } from './store/annotationStore';
import { fetchImages } from './api/images';
import { fetchAnnotations, saveAnnotations } from './api/annotations';

function App() {
  const { images, currentIndex, setImages, setLoading, setError, updateAnnotationCount } = useImageStore();
  const { setAnnotations, annotations, isDirty, setSaving, markClean } = useAnnotationStore();
  const prevIndexRef = useRef<number | null>(null);
  const currentImage = images[currentIndex];

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Load images on mount
  useEffect(() => {
    const loadImages = async () => {
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

    loadImages();
  }, [setImages, setLoading, setError]);

  // Load annotations when image changes
  useEffect(() => {
    if (!currentImage) return;

    // Save previous image's annotations if dirty
    const saveAndLoad = async () => {
      // Save previous if needed
      if (prevIndexRef.current !== null && prevIndexRef.current !== currentIndex && isDirty) {
        const prevImage = images[prevIndexRef.current];
        if (prevImage) {
          setSaving(true);
          try {
            const result = await saveAnnotations(prevImage.filename, annotations);
            updateAnnotationCount(prevImage.filename, result.annotations.length);
          } catch (error) {
            console.error('Failed to save previous annotations:', error);
          } finally {
            setSaving(false);
          }
        }
      }

      // Load new annotations
      try {
        const data = await fetchAnnotations(currentImage.filename);
        setAnnotations(data.annotations);
      } catch (error) {
        console.error('Failed to load annotations:', error);
        setAnnotations([]);
      }

      prevIndexRef.current = currentIndex;
    };

    saveAndLoad();
  }, [currentImage, currentIndex]);

  return (
    <Layout>
      <ImageSidebar />
      <div className="flex-1 flex flex-col">
        <Toolbar />
        <AnnotationCanvas />
      </div>
      <AnnotationPanel />
    </Layout>
  );
}

export default App;
