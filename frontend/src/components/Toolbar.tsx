import React from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useImageStore } from '../store/imageStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { saveInvoiceAnnotation } from '../api/invoice';

export const Toolbar: React.FC = () => {
  const { tool, setTool, transform, zoomIn, zoomOut, resetZoom } = useCanvasStore();
  const { images, currentIndex, nextImage, prevImage, setIsAnnotated } = useImageStore();
  const { isDirty, setSaving, markClean, buildSavePayload } = useInvoiceStore();

  const currentImage = images[currentIndex];
  const zoomPercent = Math.round(transform.scale * 100);

  const handleSave = async () => {
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
  };

  const ocrStatus = currentImage?.ocrStatus ?? 'pending';
  const ocrChip = {
    pending: { label: 'OCR: Pending', className: 'bg-gray-100 text-gray-500' },
    running: { label: 'OCR: Running…', className: 'bg-yellow-100 text-yellow-700 animate-pulse' },
    done:    { label: `OCR: Done`, className: 'bg-green-100 text-green-700' },
    error:   { label: 'OCR: Error', className: 'bg-red-100 text-red-600' },
  }[ocrStatus];

  return (
    <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-4">
      {/* Tool Selector */}
      <div className="flex items-center gap-0 bg-white rounded border border-gray-300">
        <button
          onClick={() => setTool('select')}
          className={`px-3 py-1.5 text-sm rounded-l ${
            tool === 'select' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
          }`}
          title="Select tool (S)"
        >
          Select
        </button>
        <button
          onClick={() => setTool('draw')}
          className={`px-3 py-1.5 text-sm rounded-r ${
            tool === 'draw' ? 'bg-blue-500 text-white' : 'text-gray-700 hover:bg-gray-100'
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
        disabled={!isDirty || !currentImage}
        className={`px-3 py-1.5 text-sm rounded ${
          isDirty && currentImage
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title="Save annotations (Ctrl+S)"
      >
        {isDirty ? 'Save *' : 'Saved'}
      </button>

      {/* OCR Status chip */}
      {currentImage && (
        <span className={`text-xs px-2 py-1 rounded font-medium ${ocrChip.className}`}>
          {ocrChip.label}
        </span>
      )}

      <div className="flex-1" />
    </div>
  );
};
