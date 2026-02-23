import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useImageStore } from '../store/imageStore';
import { getImageUrl } from '../api/client';
import { CanvasTransform, HandlePosition, Point, LabeledBox, FIELD_COLORS } from '../types';

const HANDLE_SIZE = 8;
const MIN_BOX_SIZE = 10;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function screenToImage(
  screenX: number,
  screenY: number,
  transform: CanvasTransform,
  canvasRect: DOMRect
): Point {
  const canvasX = screenX - canvasRect.left;
  const canvasY = screenY - canvasRect.top;
  return {
    x: (canvasX - transform.offsetX) / transform.scale,
    y: (canvasY - transform.offsetY) / transform.scale,
  };
}

function imageToCanvas(imageX: number, imageY: number, transform: CanvasTransform): Point {
  return {
    x: imageX * transform.scale + transform.offsetX,
    y: imageY * transform.scale + transform.offsetY,
  };
}

function getHandleAtPoint(
  canvasX: number,
  canvasY: number,
  bbox: [number, number, number, number],
  transform: CanvasTransform
): HandlePosition {
  const x = bbox[0] * transform.scale + transform.offsetX;
  const y = bbox[1] * transform.scale + transform.offsetY;
  const w = (bbox[2] - bbox[0]) * transform.scale;
  const h = (bbox[3] - bbox[1]) * transform.scale;
  const hs = HANDLE_SIZE;

  const handles: [HandlePosition, number, number][] = [
    ['top-left', x, y],
    ['top-right', x + w, y],
    ['bottom-right', x + w, y + h],
    ['bottom-left', x, y + h],
    ['top-center', x + w / 2, y],
    ['right-center', x + w, y + h / 2],
    ['bottom-center', x + w / 2, y + h],
    ['left-center', x, y + h / 2],
  ];

  for (const [position, hx, hy] of handles) {
    if (Math.abs(canvasX - hx) <= hs && Math.abs(canvasY - hy) <= hs) {
      return position;
    }
  }

  if (canvasX >= x && canvasX <= x + w && canvasY >= y && canvasY <= y + h) {
    return 'body';
  }
  return null;
}

function drawLabeledBox(
  ctx: CanvasRenderingContext2D,
  box: LabeledBox,
  transform: CanvasTransform,
  isSelected: boolean,
  isDrawing: boolean = false
) {
  const x = box.bbox[0] * transform.scale + transform.offsetX;
  const y = box.bbox[1] * transform.scale + transform.offsetY;
  const w = (box.bbox[2] - box.bbox[0]) * transform.scale;
  const h = (box.bbox[3] - box.bbox[1]) * transform.scale;
  const color = FIELD_COLORS[box.fieldType];

  ctx.fillStyle = hexToRgba(color, isSelected ? 0.3 : 0.15);
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = color;
  ctx.lineWidth = isSelected ? 3 : 2;
  ctx.setLineDash(isDrawing ? [5, 5] : isSelected ? [6, 3] : []);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  if (isSelected && !isDrawing) {
    const handlePoints = [
      { x, y },
      { x: x + w / 2, y },
      { x: x + w, y },
      { x: x + w, y: y + h / 2 },
      { x: x + w, y: y + h },
      { x: x + w / 2, y: y + h },
      { x, y: y + h },
      { x, y: y + h / 2 },
    ];
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    for (const hp of handlePoints) {
      ctx.fillRect(hp.x - HANDLE_SIZE / 2, hp.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(hp.x - HANDLE_SIZE / 2, hp.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  if (!isDrawing && box.fieldType !== 'unassigned') {
    const label = box.fieldType.replace(/_/g, ' ');
    ctx.font = 'bold 10px Inter, system-ui, sans-serif';
    const textW = ctx.measureText(label).width;
    const chipW = textW + 8;
    const chipH = 14;
    const chipX = x;
    const chipY = Math.max(0, y - chipH - 2);

    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(chipX, chipY, chipW, chipH, 3);
    } else {
      ctx.rect(chipX, chipY, chipW, chipH);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, chipX + 4, chipY + 10);
  }
}

export const AnnotationCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [scrollDrag, setScrollDrag] = useState<{
    axis: 'x' | 'y';
    startPos: number;
    startOffset: number;
    imageEffectiveSize: number;
    containerDim: number;
    trackSize: number;
  } | null>(null);
  const [drawingBox, setDrawingBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    handle: HandlePosition;
    startPoint: Point;
    originalBbox: [number, number, number, number];
    tempId: string;
  } | null>(null);
  const lastMousePos = useRef<Point | null>(null);

  const { images, currentIndex } = useImageStore();
  const currentImage = images[currentIndex] || null;

  const { labeledBoxes, selectedIds, selectBox, clearSelection, addManualBox, updateBoxBbox } =
    useInvoiceStore();

  const {
    tool,
    transform,
    isDrawing,
    isPanning,
    drawStartPoint,
    startDrawing,
    stopDrawing,
    startPanning,
    stopPanning,
    pan,
    setTransform,
  } = useCanvasStore();

  useEffect(() => {
    if (!currentImage) { setImage(null); return; }
    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = getImageUrl(currentImage.filename);
    return () => { img.onload = null; img.onerror = null; };
  }, [currentImage]);

  useEffect(() => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  }, [currentImage, setTransform]);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      setContainerSize({ width: container.clientWidth, height: container.clientHeight });
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (image) {
      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }

    for (const box of labeledBoxes) {
      drawLabeledBox(ctx, box, transform, selectedIds.has(box.tempId));
    }

    if (drawingBox) {
      const preview: LabeledBox = {
        tempId: '__preview__',
        ocr_id: null,
        text: '',
        bbox: [
          drawingBox.x,
          drawingBox.y,
          drawingBox.x + drawingBox.width,
          drawingBox.y + drawingBox.height,
        ],
        fieldType: 'unassigned',
      };
      drawLabeledBox(ctx, preview, transform, false, true);
    }
  }, [image, labeledBoxes, selectedIds, transform, drawingBox]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));
        const scaleRatio = newScale / transform.scale;
        setTransform({
          scale: newScale,
          offsetX: mouseX - (mouseX - transform.offsetX) * scaleRatio,
          offsetY: mouseY - (mouseY - transform.offsetY) * scaleRatio,
        });
      } else {
        setTransform({
          scale: transform.scale,
          offsetX: transform.offsetX - e.deltaX,
          offsetY: transform.offsetY - e.deltaY,
        });
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [transform, setTransform]);

  useEffect(() => {
    if (!scrollDrag) return;

    const handleMove = (e: MouseEvent) => {
      const pos = scrollDrag.axis === 'x' ? e.clientX : e.clientY;
      const delta = pos - scrollDrag.startPos;
      const thumbSize = Math.max(
        20,
        (scrollDrag.containerDim / scrollDrag.imageEffectiveSize) * scrollDrag.trackSize
      );
      const maxThumbPos = scrollDrag.trackSize - thumbSize;
      if (maxThumbPos <= 0) return;
      const scrollRange = scrollDrag.imageEffectiveSize - scrollDrag.containerDim;
      const newOffset = Math.max(
        scrollDrag.containerDim - scrollDrag.imageEffectiveSize,
        Math.min(0, scrollDrag.startOffset - (delta / maxThumbPos) * scrollRange)
      );
      if (scrollDrag.axis === 'x') {
        setTransform({ ...transform, offsetX: newOffset });
      } else {
        setTransform({ ...transform, offsetY: newOffset });
      }
    };

    const handleUp = () => setScrollDrag(null);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [scrollDrag, transform, setTransform]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      const imagePoint = screenToImage(e.clientX, e.clientY, transform, rect);

      if (e.button === 1) {
        e.preventDefault();
        startPanning();
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }
      if (e.button !== 0) return;

      if (tool === 'draw') {
        startDrawing(imagePoint.x, imagePoint.y);
        setDrawingBox({ x: imagePoint.x, y: imagePoint.y, width: 0, height: 0 });
      } else if (tool === 'select') {
        if (selectedIds.size === 1) {
          const selId = [...selectedIds][0];
          const selBox = labeledBoxes.find((b) => b.tempId === selId);
          if (selBox) {
            const handle = getHandleAtPoint(canvasX, canvasY, selBox.bbox, transform);
            if (handle) {
              setDragState({
                handle,
                startPoint: imagePoint,
                originalBbox: [...selBox.bbox] as [number, number, number, number],
                tempId: selId,
              });
              return;
            }
          }
        }

        let clicked: LabeledBox | undefined;
        for (let i = labeledBoxes.length - 1; i >= 0; i--) {
          const b = labeledBoxes[i];
          if (
            imagePoint.x >= b.bbox[0] && imagePoint.x <= b.bbox[2] &&
            imagePoint.y >= b.bbox[1] && imagePoint.y <= b.bbox[3]
          ) {
            clicked = b;
            break;
          }
        }

        if (clicked) {
          selectBox(clicked.tempId, e.shiftKey);
          setDragState({
            handle: 'body',
            startPoint: imagePoint,
            originalBbox: [...clicked.bbox] as [number, number, number, number],
            tempId: clicked.tempId,
          });
        } else {
          clearSelection();
        }
      }
    },
    [tool, transform, labeledBoxes, selectedIds, startDrawing, startPanning, selectBox, clearSelection]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const imagePoint = screenToImage(e.clientX, e.clientY, transform, rect);

      if (isPanning && lastMousePos.current) {
        pan(e.clientX - lastMousePos.current.x, e.clientY - lastMousePos.current.y);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (isDrawing && drawStartPoint) {
        setDrawingBox({
          x: Math.min(drawStartPoint.x, imagePoint.x),
          y: Math.min(drawStartPoint.y, imagePoint.y),
          width: Math.abs(imagePoint.x - drawStartPoint.x),
          height: Math.abs(imagePoint.y - drawStartPoint.y),
        });
        return;
      }

      if (dragState) {
        const { handle, startPoint, originalBbox, tempId } = dragState;
        const dx = imagePoint.x - startPoint.x;
        const dy = imagePoint.y - startPoint.y;
        let [x1, y1, x2, y2] = originalBbox;

        switch (handle) {
          case 'body':          x1 += dx; y1 += dy; x2 += dx; y2 += dy; break;
          case 'top-left':      x1 += dx; y1 += dy; break;
          case 'top-center':    y1 += dy; break;
          case 'top-right':     x2 += dx; y1 += dy; break;
          case 'right-center':  x2 += dx; break;
          case 'bottom-right':  x2 += dx; y2 += dy; break;
          case 'bottom-center': y2 += dy; break;
          case 'bottom-left':   x1 += dx; y2 += dy; break;
          case 'left-center':   x1 += dx; break;
        }

        const nx1 = Math.min(x1, x2), ny1 = Math.min(y1, y2);
        let nx2 = Math.max(x1, x2), ny2 = Math.max(y1, y2);
        if (nx2 - nx1 < MIN_BOX_SIZE) nx2 = nx1 + MIN_BOX_SIZE;
        if (ny2 - ny1 < MIN_BOX_SIZE) ny2 = ny1 + MIN_BOX_SIZE;
        updateBoxBbox(tempId, [nx1, ny1, nx2, ny2]);
      }

      if (tool === 'select' && selectedIds.size === 1 && !dragState) {
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const selId = [...selectedIds][0];
        const selBox = labeledBoxes.find((b) => b.tempId === selId);
        if (selBox) {
          const handle = getHandleAtPoint(canvasX, canvasY, selBox.bbox, transform);
          const cursors: Partial<Record<NonNullable<HandlePosition>, string>> = {
            'top-left': 'nwse-resize', 'bottom-right': 'nwse-resize',
            'top-right': 'nesw-resize', 'bottom-left': 'nesw-resize',
            'top-center': 'ns-resize', 'bottom-center': 'ns-resize',
            'left-center': 'ew-resize', 'right-center': 'ew-resize',
            body: 'move',
          };
          canvas.style.cursor = handle ? (cursors[handle] ?? 'default') : 'default';
        }
      }
    },
    [isPanning, isDrawing, drawStartPoint, dragState, transform, pan, tool, selectedIds, labeledBoxes, updateBoxBbox]
  );

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      if (isPanning) {
        stopPanning();
        lastMousePos.current = null;
        return;
      }
      if (isDrawing && drawingBox) {
        if (drawingBox.width > MIN_BOX_SIZE && drawingBox.height > MIN_BOX_SIZE) {
          addManualBox([
            Math.round(drawingBox.x),
            Math.round(drawingBox.y),
            Math.round(drawingBox.x + drawingBox.width),
            Math.round(drawingBox.y + drawingBox.height),
          ]);
        }
        stopDrawing();
        setDrawingBox(null);
        return;
      }
      if (dragState) setDragState(null);
    },
    [isPanning, isDrawing, drawingBox, dragState, addManualBox, stopDrawing, stopPanning]
  );

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (tool === 'draw') return 'crosshair';
    return 'default';
  };

  const imgW = (currentImage?.width ?? 0) * transform.scale;
  const imgH = (currentImage?.height ?? 0) * transform.scale;
  const cW = containerSize.width;
  const cH = containerSize.height;
  const SCROLLBAR = 10;
  const showHBar = imgW > cW;
  const showVBar = imgH > cH;
  const hTrack = cW - (showVBar ? SCROLLBAR : 0);
  const vTrack = cH - (showHBar ? SCROLLBAR : 0);
  const hThumbW = showHBar ? Math.max(20, (cW / imgW) * hTrack) : 0;
  const vThumbH = showVBar ? Math.max(20, (cH / imgH) * vTrack) : 0;
  const hThumbLeft = showHBar
    ? Math.min(hTrack - hThumbW, (-transform.offsetX / (imgW - cW)) * (hTrack - hThumbW))
    : 0;
  const vThumbTop = showVBar
    ? Math.min(vTrack - vThumbH, (-transform.offsetY / (imgH - cH)) * (vTrack - vThumbH))
    : 0;

  return (
    <div
      ref={containerRef}
      id="canvas-container"
      className="flex-1 relative overflow-hidden bg-gray-200"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {!currentImage && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg">No image selected</p>
            <p className="text-sm">Upload images to get started</p>
          </div>
        </div>
      )}
      {showHBar && (
        <div
          className="absolute bottom-0 left-0 bg-black/10"
          style={{ width: hTrack, height: SCROLLBAR }}
        >
          <div
            className="absolute top-0.5 bottom-0.5 bg-gray-500/60 rounded cursor-pointer hover:bg-gray-600/70"
            style={{ left: hThumbLeft, width: hThumbW }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setScrollDrag({
                axis: 'x', startPos: e.clientX, startOffset: transform.offsetX,
                imageEffectiveSize: imgW, containerDim: cW, trackSize: hTrack,
              });
            }}
          />
        </div>
      )}
      {showVBar && (
        <div
          className="absolute top-0 right-0 bg-black/10"
          style={{ width: SCROLLBAR, height: vTrack }}
        >
          <div
            className="absolute left-0.5 right-0.5 bg-gray-500/60 rounded cursor-pointer hover:bg-gray-600/70"
            style={{ top: vThumbTop, height: vThumbH }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setScrollDrag({
                axis: 'y', startPos: e.clientY, startOffset: transform.offsetY,
                imageEffectiveSize: imgH, containerDim: cH, trackSize: vTrack,
              });
            }}
          />
        </div>
      )}
    </div>
  );
};
