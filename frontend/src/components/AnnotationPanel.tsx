import React from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { useCanvasStore } from '../store/canvasStore';
import { BoundingBox } from '../types';

interface AnnotationItemProps {
  annotation: BoundingBox;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<BoundingBox>) => void;
  onDelete: () => void;
}

const AnnotationItem: React.FC<AnnotationItemProps> = ({
  annotation,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) => {
  return (
    <div
      className={`p-3 border-b border-gray-200 ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Box #{index + 1}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-red-500 hover:text-red-700 text-sm px-2 py-0.5 rounded hover:bg-red-50"
        >
          Delete
        </button>
      </div>
      <div className="text-xs text-gray-500 mb-2">
        <span>x: {Math.round(annotation.x)}</span>
        <span className="ml-2">y: {Math.round(annotation.y)}</span>
        <span className="ml-2">w: {Math.round(annotation.width)}</span>
        <span className="ml-2">h: {Math.round(annotation.height)}</span>
      </div>
      <input
        type="text"
        value={annotation.transcription}
        onChange={(e) => onUpdate({ transcription: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        placeholder="Enter transcription..."
        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  );
};

export const AnnotationPanel: React.FC = () => {
  const { annotations, selectedId, selectAnnotation, updateAnnotation, deleteAnnotation } =
    useAnnotationStore();
  const { setTool } = useCanvasStore();

  const handleAddNew = () => {
    setTool('draw');
  };

  const transcribedCount = annotations.filter((a) => a.transcription.trim()).length;

  return (
    <div className="w-72 bg-gray-50 border-l border-gray-300 flex flex-col">
      <div className="p-3 border-b border-gray-300 bg-gray-100">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Annotations ({annotations.length})
          </h2>
          <button
            onClick={handleAddNew}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            + Add Box
          </button>
        </div>
        {annotations.length > 0 && (
          <p className="text-xs text-gray-500 mt-1">
            {transcribedCount}/{annotations.length} transcribed
          </p>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {annotations.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <p>No annotations yet</p>
            <p className="mt-1 text-xs">
              Press <kbd className="bg-gray-200 px-1 rounded">D</kbd> to draw a box
            </p>
          </div>
        ) : (
          annotations.map((ann, index) => (
            <AnnotationItem
              key={ann.id}
              annotation={ann}
              index={index}
              isSelected={ann.id === selectedId}
              onSelect={() => selectAnnotation(ann.id)}
              onUpdate={(updates) => updateAnnotation(ann.id, updates)}
              onDelete={() => deleteAnnotation(ann.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
