import React from 'react';
import { useImageStore } from '../store/imageStore';
import { getImageUrl } from '../api/client';

export const ImageSidebar: React.FC = () => {
  const { images, currentIndex, setCurrentIndex, isLoading } = useImageStore();

  if (isLoading) {
    return (
      <div className="w-48 bg-gray-100 border-r border-gray-300 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="w-48 bg-gray-100 border-r border-gray-300 flex items-center justify-center p-4">
        <div className="text-gray-500 text-center text-sm">
          <p>No images found</p>
          <p className="mt-2 text-xs">Add images to<br />dataset/images/</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-48 bg-gray-100 border-r border-gray-300 flex flex-col">
      <div className="p-2 border-b border-gray-300 bg-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Images ({images.length})</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {images.map((img, index) => (
          <div
            key={img.filename}
            className={`p-2 cursor-pointer border-b border-gray-200 hover:bg-gray-200 ${
              index === currentIndex ? 'bg-blue-100 border-l-4 border-l-blue-500' : ''
            }`}
            onClick={() => setCurrentIndex(index)}
          >
            <div className="relative">
              <img
                src={getImageUrl(img.filename)}
                alt={img.filename}
                className="w-full h-24 object-cover rounded bg-gray-300"
                loading="lazy"
              />
              {img.annotationCount > 0 && (
                <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {img.annotationCount}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-600 truncate" title={img.filename}>
              {img.filename}
            </p>
            <p className="text-xs text-gray-400">
              {img.width} x {img.height}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
