import React, { useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useImageStore } from '../store/imageStore';
import { useAnnotationStore } from '../store/annotationStore';
import { exportAnnotations, ExportFormat } from '../api/export';
import { saveAnnotations } from '../api/annotations';
import { fetchImages } from '../api/images';
import { autoAnnotate } from '../api/claude';

export const Toolbar: React.FC = () => {
  const { tool, setTool, transform, zoomIn, zoomOut, resetZoom } = useCanvasStore();
  const { images, currentIndex, nextImage, prevImage, setImages } = useImageStore();
  const { annotations, isDirty, setSaving, markClean } = useAnnotationStore();
  const updateAnnotationCount = useImageStore((s) => s.updateAnnotationCount);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [annotating, setAnnotating] = useState(false);
  const [annotateMessage, setAnnotateMessage] = useState<string | null>(null);
  const [annotateError, setAnnotateError] = useState<string | null>(null);

  const currentImage = images[currentIndex];
  const zoomPercent = Math.round(transform.scale * 100);

  const handleSave = async () => {
    if (!currentImage || !isDirty) return;

    setSaving(true);
    try {
      const result = await saveAnnotations(currentImage.filename, annotations);
      markClean();
      updateAnnotationCount(currentImage.filename, result.annotations.length);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save annotations');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (currentImage && isDirty) {
      await handleSave();
    }

    setExporting(format);
    setExportMessage(null);
    try {
      const result = await exportAnnotations(format);
      setExportMessage(
        `Exported ${result.annotation_count} annotations from ${result.file_count} images to ${format.toUpperCase()}`
      );
      setTimeout(() => setExportMessage(null), 3000);
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Export failed: ${error}`);
    } finally {
      setExporting(null);
    }
  };

  const handleAutoAnnotate = async () => {
    // Auto-save first if dirty
    if (currentImage && isDirty) {
      await handleSave();
    }

    setAnnotating(true);
    setAnnotateMessage(null);
    setAnnotateError(null);

    try {
      const result = await autoAnnotate(false);
      if (result.total_annotated === 0 && result.total_errors === 0) {
        setAnnotateMessage('No images to annotate (all non-sample images already annotated).');
      } else {
        const parts: string[] = [];
        if (result.total_annotated > 0)
          parts.push(`${result.total_annotated} image${result.total_annotated !== 1 ? 's' : ''} annotated`);
        if (result.total_errors > 0)
          parts.push(`${result.total_errors} error${result.total_errors !== 1 ? 's' : ''}`);
        setAnnotateMessage(parts.join(', ') + '.');
      }
      // Refresh image list so annotation counts update
      const refreshed = await fetchImages();
      setImages(refreshed);
      setTimeout(() => setAnnotateMessage(null), 5000);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setAnnotateError(msg);
      setTimeout(() => setAnnotateError(null), 6000);
    } finally {
      setAnnotating(false);
    }
  };

  const sampleCount = images.filter((img) => img.isSample).length;
  const canAnnotate = sampleCount > 0 && !annotating;

  return (
    <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-4">
      {/* Tool Selector */}
      <div className="flex items-center gap-1 bg-white rounded border border-gray-300">
        <button
          onClick={() => setTool('select')}
          className={`px-3 py-1.5 text-sm rounded-l ${
            tool === 'select'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Select tool (S)"
        >
          Select
        </button>
        <button
          onClick={() => setTool('draw')}
          className={`px-3 py-1.5 text-sm rounded-r ${
            tool === 'draw'
              ? 'bg-blue-500 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Draw box tool (D)"
        >
          Draw Box
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={zoomOut}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={resetZoom}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 min-w-[60px]"
          title="Reset zoom"
        >
          {zoomPercent}%
        </button>
        <button
          onClick={zoomIn}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100"
          title="Zoom in"
        >
          +
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={prevImage}
          disabled={currentIndex === 0}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous image (Left arrow)"
        >
          &lt; Prev
        </button>
        <span className="text-sm text-gray-600 min-w-[60px] text-center">
          {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : '0 / 0'}
        </span>
        <button
          onClick={nextImage}
          disabled={currentIndex >= images.length - 1}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next image (Right arrow)"
        >
          Next &gt;
        </button>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!isDirty}
        className={`px-3 py-1.5 text-sm rounded ${
          isDirty
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title="Save annotations (Ctrl+S)"
      >
        {isDirty ? 'Save*' : 'Saved'}
      </button>

      {/* Auto-Annotate with Claude */}
      <button
        onClick={handleAutoAnnotate}
        disabled={!canAnnotate}
        title={
          sampleCount === 0
            ? 'Mark at least one image as a sample (★) and annotate it first'
            : 'Auto-annotate remaining images using samples as few-shot examples'
        }
        className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
          canAnnotate
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {annotating ? (
          <>
            <span className="animate-spin inline-block">&#8635;</span>
            Annotating…
          </>
        ) : (
          <>
            <span>✦</span>
            Auto-Annotate
            {sampleCount > 0 && (
              <span className="text-xs opacity-80">({sampleCount} sample{sampleCount !== 1 ? 's' : ''})</span>
            )}
          </>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Feedback messages */}
      {annotateMessage && (
        <span className="text-sm text-indigo-600 font-medium">{annotateMessage}</span>
      )}
      {annotateError && (
        <span className="text-sm text-red-600 font-medium" title={annotateError}>
          {annotateError.length > 60 ? annotateError.slice(0, 60) + '…' : annotateError}
        </span>
      )}
      {exportMessage && (
        <span className="text-sm text-green-600">{exportMessage}</span>
      )}

      {/* Export Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Export:</span>
        <button
          onClick={() => handleExport('yolo')}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {exporting === 'yolo' ? '...' : 'YOLO'}
        </button>
        <button
          onClick={() => handleExport('coco')}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          {exporting === 'coco' ? '...' : 'COCO'}
        </button>
        <button
          onClick={() => handleExport('trocr')}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded hover:bg-teal-600 disabled:opacity-50"
        >
          {exporting === 'trocr' ? '...' : 'TrOCR'}
        </button>
      </div>
    </div>
  );
};
