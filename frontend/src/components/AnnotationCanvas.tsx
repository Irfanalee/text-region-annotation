import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useAnnotationStore } from '../store/annotationStore';
import { useImageStore } from '../store/imageStore';
import { getImageUrl } from '../api/client';
import { BoundingBox, CanvasTransform, HandlePosition, Point } from '../types';

const COLORS = {
  box: '#3B82F6',
  boxSelected: '#EF4444',
  boxFill: 'rgba(59, 130, 246, 0.1)',
  boxFillSelected: 'rgba(239, 68, 68, 0.2)',
  handle: '#FFFFFF',
  handleBorder: '#3B82F6',
  label: '#1F2937',
  labelBg: 'rgba(255, 255, 255, 0.9)',
};

const HANDLE_SIZE = 8;
const MIN_BOX_SIZE = 10;

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

function imageToCanvas(
  imageX: number,
  imageY: number,
  transform: CanvasTransform
): Point {
  return {
    x: imageX * transform.scale + transform.offsetX,
    y: imageY * transform.scale + transform.offsetY,
  };
}

function getHandleAtPoint(
  canvasX: number,
  canvasY: number,
  box: BoundingBox,
  transform: CanvasTransform
): HandlePosition {
  const { x, y } = imageToCanvas(box.x, box.y, transform);
  const width = box.width * transform.scale;
  const height = box.height * transform.scale;
  const hs = HANDLE_SIZE;

  const handles: [HandlePosition, number, number][] = [
    ['top-left', x, y],
    ['top-right', x + width, y],
    ['bottom-right', x + width, y + height],
    ['bottom-left', x, y + height],
    ['top-center', x + width / 2, y],
    ['right-center', x + width, y + height / 2],
    ['bottom-center', x + width / 2, y + height],
    ['left-center', x, y + height / 2],
  ];

  for (const [position, hx, hy] of handles) {
    if (Math.abs(canvasX - hx) <= hs && Math.abs(canvasY - hy) <= hs) {
      return position;
    }
  }

  if (
    canvasX >= x &&
    canvasX <= x + width &&
    canvasY >= y &&
    canvasY <= y + height
  ) {
    return 'body';
  }

  return null;
}

function drawBoundingBox(
  ctx: CanvasRenderingContext2D,
  box: BoundingBox,
  transform: CanvasTransform,
  isSelected: boolean,
  isDrawing: boolean = false
) {
  const { x, y } = imageToCanvas(box.x, box.y, transform);
  const width = box.width * transform.scale;
  const height = box.height * transform.scale;

  // Fill
  ctx.fillStyle = isSelected ? COLORS.boxFillSelected : COLORS.boxFill;
  ctx.fillRect(x, y, width, height);

  // Stroke
  ctx.strokeStyle = isSelected ? COLORS.boxSelected : COLORS.box;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.setLineDash(isDrawing ? [5, 5] : []);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);

  // Draw resize handles for selected box
  if (isSelected && !isDrawing) {
    const handles = [
      { x: x, y: y },
      { x: x + width / 2, y: y },
      { x: x + width, y: y },
      { x: x + width, y: y + height / 2 },
      { x: x + width, y: y + height },
      { x: x + width / 2, y: y + height },
      { x: x, y: y + height },
      { x: x, y: y + height / 2 },
    ];

    for (const handle of handles) {
      ctx.fillStyle = COLORS.handle;
      ctx.strokeStyle = COLORS.handleBorder;
      ctx.lineWidth = 1;
      ctx.fillRect(
        handle.x - HANDLE_SIZE / 2,
        handle.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      );
      ctx.strokeRect(
        handle.x - HANDLE_SIZE / 2,
        handle.y - HANDLE_SIZE / 2,
        HANDLE_SIZE,
        HANDLE_SIZE
      );
    }
  }

  // Draw transcription label
  if (box.transcription && !isDrawing) {
    ctx.font = '12px Inter, system-ui, sans-serif';
    const metrics = ctx.measureText(box.transcription);
    const padding = 4;

    ctx.fillStyle = COLORS.labelBg;
    ctx.fillRect(x, y - 18, metrics.width + padding * 2, 16);

    ctx.fillStyle = COLORS.label;
    ctx.fillText(box.transcription, x + padding, y - 6);
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
    originalBox: BoundingBox;
  } | null>(null);
  const lastMousePos = useRef<Point | null>(null);

  const { images, currentIndex } = useImageStore();
  const currentImage = images[currentIndex] || null;
  const { annotations, selectedId, addAnnotation, selectAnnotation, updateAnnotation } =
    useAnnotationStore();
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

  // Load image when currentImage changes
  useEffect(() => {
    if (!currentImage) {
      setImage(null);
      return;
    }

    const img = new Image();
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);
    img.src = getImageUrl(currentImage.filename);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [currentImage]);

  // Reset transform when image changes
  useEffect(() => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  }, [currentImage, setTransform]);

  // Resize canvas to container
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

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image
    if (image) {
      ctx.save();
      ctx.translate(transform.offsetX, transform.offsetY);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(image, 0, 0);
      ctx.restore();
    }

    // Draw annotations
    for (const ann of annotations) {
      const isSelected = ann.id === selectedId;
      drawBoundingBox(ctx, ann, transform, isSelected);
    }

    // Draw current drawing box
    if (drawingBox) {
      drawBoundingBox(
        ctx,
        { ...drawingBox, id: -1, transcription: '' },
        transform,
        false,
        true
      );
    }
  }, [image, annotations, selectedId, transform, drawingBox]);

  // Mouse wheel zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + scroll = zoom
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
        // Scroll = pan
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

  // Scrollbar drag
  useEffect(() => {
    if (!scrollDrag) return;

    const handleMove = (e: MouseEvent) => {
      const pos = scrollDrag.axis === 'x' ? e.clientX : e.clientY;
      const delta = pos - scrollDrag.startPos;
      const thumbSize = Math.max(20, (scrollDrag.containerDim / scrollDrag.imageEffectiveSize) * scrollDrag.trackSize);
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

      // Middle mouse button - pan
      if (e.button === 1) {
        e.preventDefault();
        startPanning();
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Left click only
      if (e.button !== 0) return;

      if (tool === 'draw') {
        startDrawing(imagePoint.x, imagePoint.y);
        setDrawingBox({ x: imagePoint.x, y: imagePoint.y, width: 0, height: 0 });
      } else if (tool === 'select') {
        // Check if clicking on selected box handle
        if (selectedId !== null) {
          const selectedBox = annotations.find((a) => a.id === selectedId);
          if (selectedBox) {
            const handle = getHandleAtPoint(canvasX, canvasY, selectedBox, transform);
            if (handle) {
              setDragState({
                handle,
                startPoint: imagePoint,
                originalBox: { ...selectedBox },
              });
              return;
            }
          }
        }

        // Check if clicking on any annotation
        let clicked: BoundingBox | undefined;
        // Iterate in reverse to select top-most box first
        for (let i = annotations.length - 1; i >= 0; i--) {
          const ann = annotations[i];
          if (
            imagePoint.x >= ann.x &&
            imagePoint.x <= ann.x + ann.width &&
            imagePoint.y >= ann.y &&
            imagePoint.y <= ann.y + ann.height
          ) {
            clicked = ann;
            break;
          }
        }

        if (clicked) {
          selectAnnotation(clicked.id);
          setDragState({
            handle: 'body',
            startPoint: imagePoint,
            originalBox: { ...clicked },
          });
        } else {
          selectAnnotation(null);
        }
      }
    },
    [tool, transform, annotations, selectedId, startDrawing, startPanning, selectAnnotation]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const imagePoint = screenToImage(e.clientX, e.clientY, transform, rect);

      // Panning
      if (isPanning && lastMousePos.current) {
        const deltaX = e.clientX - lastMousePos.current.x;
        const deltaY = e.clientY - lastMousePos.current.y;
        pan(deltaX, deltaY);
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Drawing
      if (isDrawing && drawStartPoint) {
        const x = Math.min(drawStartPoint.x, imagePoint.x);
        const y = Math.min(drawStartPoint.y, imagePoint.y);
        const width = Math.abs(imagePoint.x - drawStartPoint.x);
        const height = Math.abs(imagePoint.y - drawStartPoint.y);
        setDrawingBox({ x, y, width, height });
        return;
      }

      // Dragging/resizing annotation
      if (dragState && selectedId !== null) {
        const { handle, startPoint, originalBox } = dragState;
        const deltaX = imagePoint.x - startPoint.x;
        const deltaY = imagePoint.y - startPoint.y;

        let newBox = { ...originalBox };

        switch (handle) {
          case 'body':
            newBox.x = originalBox.x + deltaX;
            newBox.y = originalBox.y + deltaY;
            break;
          case 'top-left':
            newBox.x = originalBox.x + deltaX;
            newBox.y = originalBox.y + deltaY;
            newBox.width = originalBox.width - deltaX;
            newBox.height = originalBox.height - deltaY;
            break;
          case 'top-center':
            newBox.y = originalBox.y + deltaY;
            newBox.height = originalBox.height - deltaY;
            break;
          case 'top-right':
            newBox.y = originalBox.y + deltaY;
            newBox.width = originalBox.width + deltaX;
            newBox.height = originalBox.height - deltaY;
            break;
          case 'right-center':
            newBox.width = originalBox.width + deltaX;
            break;
          case 'bottom-right':
            newBox.width = originalBox.width + deltaX;
            newBox.height = originalBox.height + deltaY;
            break;
          case 'bottom-center':
            newBox.height = originalBox.height + deltaY;
            break;
          case 'bottom-left':
            newBox.x = originalBox.x + deltaX;
            newBox.width = originalBox.width - deltaX;
            newBox.height = originalBox.height + deltaY;
            break;
          case 'left-center':
            newBox.x = originalBox.x + deltaX;
            newBox.width = originalBox.width - deltaX;
            break;
        }

        // Normalize if width/height is negative
        if (newBox.width < 0) {
          newBox.x = newBox.x + newBox.width;
          newBox.width = Math.abs(newBox.width);
        }
        if (newBox.height < 0) {
          newBox.y = newBox.y + newBox.height;
          newBox.height = Math.abs(newBox.height);
        }

        // Minimum size
        newBox.width = Math.max(MIN_BOX_SIZE, newBox.width);
        newBox.height = Math.max(MIN_BOX_SIZE, newBox.height);

        updateAnnotation(selectedId, {
          x: newBox.x,
          y: newBox.y,
          width: newBox.width,
          height: newBox.height,
        });
      }

      // Update cursor based on handle hover
      if (tool === 'select' && selectedId !== null && !dragState) {
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        const selectedBox = annotations.find((a) => a.id === selectedId);
        if (selectedBox) {
          const handle = getHandleAtPoint(canvasX, canvasY, selectedBox, transform);
          switch (handle) {
            case 'top-left':
            case 'bottom-right':
              canvas.style.cursor = 'nwse-resize';
              break;
            case 'top-right':
            case 'bottom-left':
              canvas.style.cursor = 'nesw-resize';
              break;
            case 'top-center':
            case 'bottom-center':
              canvas.style.cursor = 'ns-resize';
              break;
            case 'left-center':
            case 'right-center':
              canvas.style.cursor = 'ew-resize';
              break;
            case 'body':
              canvas.style.cursor = 'move';
              break;
            default:
              canvas.style.cursor = 'default';
          }
        }
      }
    },
    [
      isPanning,
      isDrawing,
      drawStartPoint,
      dragState,
      selectedId,
      transform,
      pan,
      updateAnnotation,
      tool,
      annotations,
    ]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Stop panning
      if (isPanning) {
        stopPanning();
        lastMousePos.current = null;
        return;
      }

      // Finish drawing
      if (isDrawing && drawingBox) {
        if (drawingBox.width > MIN_BOX_SIZE && drawingBox.height > MIN_BOX_SIZE) {
          addAnnotation({
            x: drawingBox.x,
            y: drawingBox.y,
            width: drawingBox.width,
            height: drawingBox.height,
            transcription: '',
          });
        }
        stopDrawing();
        setDrawingBox(null);
        return;
      }

      // Stop dragging
      if (dragState) {
        setDragState(null);
      }
    },
    [isPanning, isDrawing, drawingBox, dragState, addAnnotation, stopDrawing, stopPanning]
  );

  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (tool === 'draw') return 'crosshair';
    return 'default';
  };

  // Scrollbar computations
  const imgW = (currentImage?.width ?? 0) * transform.scale;
  const imgH = (currentImage?.height ?? 0) * transform.scale;
  const cW = containerSize.width;
  const cH = containerSize.height;
  const SCROLLBAR = 10; // px
  const showHBar = imgW > cW;
  const showVBar = imgH > cH;
  const hTrack = cW - (showVBar ? SCROLLBAR : 0);
  const vTrack = cH - (showHBar ? SCROLLBAR : 0);
  const hThumbW = showHBar ? Math.max(20, (cW / imgW) * hTrack) : 0;
  const vThumbH = showVBar ? Math.max(20, (cH / imgH) * vTrack) : 0;
  const hThumbLeft = showHBar ? Math.min(hTrack - hThumbW, (-transform.offsetX / (imgW - cW)) * (hTrack - hThumbW)) : 0;
  const vThumbTop = showVBar ? Math.min(vTrack - vThumbH, (-transform.offsetY / (imgH - cH)) * (vTrack - vThumbH)) : 0;

  return (
    <div
      ref={containerRef}
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
            <p className="text-sm">Add images to dataset/images/ folder</p>
          </div>
        </div>
      )}
      {/* Horizontal scrollbar */}
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
              setScrollDrag({ axis: 'x', startPos: e.clientX, startOffset: transform.offsetX, imageEffectiveSize: imgW, containerDim: cW, trackSize: hTrack });
            }}
          />
        </div>
      )}
      {/* Vertical scrollbar */}
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
              setScrollDrag({ axis: 'y', startPos: e.clientY, startOffset: transform.offsetY, imageEffectiveSize: imgH, containerDim: cH, trackSize: vTrack });
            }}
          />
        </div>
      )}
    </div>
  );
};
