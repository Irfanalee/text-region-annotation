import React, { useState, useRef, useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useImageStore } from '../store/imageStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { saveInvoiceAnnotation } from '../api/invoice';
import { fetchImages } from '../api/images';
import { autoAnnotate } from '../api/claude';
import { exportJsonl, exportHuggingFace, getJsonlDownloadUrl, getHuggingFaceDownloadUrl } from '../api/exportDataset';

export const Toolbar: React.FC = () => {
  const { tool, setTool, transform, zoomIn, zoomOut, resetZoom } = useCanvasStore();
  const { images, currentIndex, nextImage, prevImage, setIsAnnotated, setImages } = useImageStore();
  const { isDirty, setSaving, markClean, buildSavePayload } = useInvoiceStore();

  const [annotating, setAnnotating] = useState(false);
  const [annotateMsg, setAnnotateMsg] = useState<string | null>(null);
  const [annotateError, setAnnotateError] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentImage = images[currentIndex];
  const zoomPercent = Math.round(transform.scale * 100);
  const annotatedCount = images.filter((img) => img.isAnnotated).length;

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

  const handleAutoAnnotate = async () => {
    if (annotating) return;
    setAnnotating(true);
    setAnnotateMsg(null);
    setAnnotateError(null);
    try {
      const result = await autoAnnotate(false, 3);
      const refreshed = await fetchImages();
      setImages(refreshed);
      if (result.total_annotated === 0 && result.total_errors === 0) {
        setAnnotateMsg('Nothing to annotate — all invoices are already done.');
      } else {
        const parts = [];
        if (result.total_annotated > 0) parts.push(`✓ ${result.total_annotated} annotated`);
        if (result.total_skipped > 0)   parts.push(`⏭ ${result.total_skipped} skipped (no OCR)`);
        if (result.total_errors > 0)    parts.push(`✗ ${result.total_errors} errors`);
        setAnnotateMsg(parts.join('  '));
      }
      setTimeout(() => setAnnotateMsg(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnnotateError(msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
      setTimeout(() => setAnnotateError(null), 8000);
    } finally {
      setAnnotating(false);
    }
  };

  const handleExportJsonl = async () => {
    setExporting('jsonl');
    setExportMsg(null);
    setExportOpen(false);
    try {
      const stats = await exportJsonl();
      setExportMsg(`JSONL ready — ${stats.total_documents} docs`);
      // Trigger download
      window.location.href = getJsonlDownloadUrl();
      setTimeout(() => setExportMsg(null), 5000);
    } catch (err: unknown) {
      setExportMsg(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setExportMsg(null), 5000);
    } finally {
      setExporting(null);
    }
  };

  const handleExportHuggingFace = async () => {
    setExporting('huggingface');
    setExportMsg(null);
    setExportOpen(false);
    try {
      const stats = await exportHuggingFace();
      setExportMsg(`HuggingFace ZIP ready — ${stats.total_documents} docs`);
      window.location.href = getHuggingFaceDownloadUrl();
      setTimeout(() => setExportMsg(null), 5000);
    } catch (err: unknown) {
      setExportMsg(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setExportMsg(null), 5000);
    } finally {
      setExporting(null);
    }
  };

  const ocrStatus = currentImage?.ocrStatus ?? 'pending';
  const ocrChip = {
    pending: { label: 'OCR: Pending', className: 'bg-gray-100 text-gray-500' },
    running: { label: 'OCR: Running…', className: 'bg-yellow-100 text-yellow-700 animate-pulse' },
    done:    { label: 'OCR: Done',    className: 'bg-green-100 text-green-700' },
    error:   { label: 'OCR: Error',   className: 'bg-red-100 text-red-600' },
  }[ocrStatus];

  const canAutoAnnotate = annotatedCount > 0 && !annotating;

  return (
    <div className="h-12 bg-gray-100 border-b border-gray-300 flex items-center px-4 gap-3">
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

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <button onClick={zoomOut}   className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100">-</button>
        <button onClick={resetZoom} className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 min-w-[56px] text-center">{zoomPercent}%</button>
        <button onClick={zoomIn}    className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100">+</button>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={prevImage}
          disabled={currentIndex === 0}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          &lt; Prev
        </button>
        <span className="text-sm text-gray-600 min-w-[56px] text-center">
          {images.length > 0 ? `${currentIndex + 1} / ${images.length}` : '0 / 0'}
        </span>
        <button
          onClick={nextImage}
          disabled={currentIndex >= images.length - 1}
          className="px-2 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next &gt;
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!isDirty || !currentImage}
        className={`px-3 py-1.5 text-sm rounded ${
          isDirty && currentImage
            ? 'bg-green-500 text-white hover:bg-green-600'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title="Save (Ctrl+S)"
      >
        {isDirty ? 'Save *' : 'Saved'}
      </button>

      {/* OCR chip */}
      {currentImage && (
        <span className={`text-xs px-2 py-1 rounded font-medium ${ocrChip.className}`}>
          {ocrChip.label}
        </span>
      )}

      <div className="flex-1" />

      {/* Feedback messages */}
      {annotateMsg && (
        <span className="text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-1 rounded">
          {annotateMsg}
        </span>
      )}
      {annotateError && (
        <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded" title={annotateError}>
          {annotateError}
        </span>
      )}
      {exportMsg && (
        <span className="text-xs text-purple-700 font-medium bg-purple-50 px-2 py-1 rounded">
          {exportMsg}
        </span>
      )}

      {/* Auto-Annotate with Claude */}
      <div className="relative group">
        <button
          onClick={handleAutoAnnotate}
          disabled={!canAutoAnnotate}
          className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
            canAutoAnnotate
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {annotating ? (
            <><span className="animate-spin inline-block">⟳</span> Annotating…</>
          ) : (
            <><span>✦</span> Auto-Annotate</>
          )}
        </button>
        {/* Tooltip */}
        <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1.5 z-50 w-64 leading-snug pointer-events-none">
          {annotatedCount === 0
            ? '⚠ Annotate and save at least one invoice manually first. Those become few-shot examples for Claude.'
            : `Uses your ${annotatedCount} saved annotation${annotatedCount !== 1 ? 's' : ''} as few-shot examples to auto-annotate all remaining invoices with Claude AI.`}
        </div>
      </div>

      {/* Export Dataset Dropdown */}
      <div className="relative" ref={exportRef}>
        <button
          onClick={() => setExportOpen((o) => !o)}
          disabled={exporting !== null}
          className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {exporting ? `Exporting…` : 'Export Dataset'}
          <span className="text-xs">▾</span>
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-xl z-50 w-56 overflow-hidden">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              Choose format
            </div>
            <button
              onClick={handleExportJsonl}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex flex-col"
            >
              <span className="font-medium text-gray-800">Claude Fine-tuning JSONL</span>
              <span className="text-[11px] text-gray-400">JSONL for Anthropic fine-tuning API</span>
            </button>
            <button
              onClick={handleExportHuggingFace}
              className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex flex-col border-t border-gray-100"
            >
              <span className="font-medium text-gray-800">HuggingFace Dataset ZIP</span>
              <span className="text-[11px] text-gray-400">Compatible with LayoutLM, Donut, etc.</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
