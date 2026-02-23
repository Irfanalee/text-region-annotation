import React from 'react';
import { useImageStore } from '../store/imageStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useCanvasStore } from '../store/canvasStore';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { images, currentIndex } = useImageStore();
  const { labeledBoxes, isDirty } = useInvoiceStore();
  const { tool, transform } = useCanvasStore();

  const currentImage = images[currentIndex];
  const labeledCount = labeledBoxes.filter((b) => b.fieldType !== 'unassigned').length;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="h-10 bg-gray-800 text-white flex items-center px-4 justify-between">
        <h1 className="text-sm font-semibold">Invoice Annotation Tool</h1>
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <span>{images.length} images</span>
          <span>{labeledBoxes.length} boxes</span>
          <span>{labeledCount} labeled</span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">{children}</main>

      <footer className="h-6 bg-gray-200 border-t border-gray-300 flex items-center px-4 text-xs text-gray-600 gap-4">
        <span className="font-medium">{currentImage?.filename || 'No image selected'}</span>
        {currentImage && (
          <span>
            {currentImage.width} × {currentImage.height}
          </span>
        )}
        <span className="capitalize">Tool: {tool}</span>
        <span>Zoom: {Math.round(transform.scale * 100)}%</span>
        {isDirty && <span className="text-orange-600">Unsaved changes</span>}
        <div className="flex-1" />
        <span className="text-gray-400">
          D: Draw | S: Select | Del: Delete box | G: Group as line item | Arrows: Navigate | Ctrl+S: Save
        </span>
      </footer>
    </div>
  );
};
