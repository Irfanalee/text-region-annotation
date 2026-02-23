import React, { useRef, useState } from 'react';
import { useImageStore } from '../store/imageStore';
import { getImageUrl } from '../api/client';
import { uploadImages, fetchImages, deleteImage } from '../api/images';

export const ImageSidebar: React.FC = () => {
  const { images, currentIndex, setCurrentIndex, setImages, removeImage, isLoading } =
    useImageStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadMessage(null);
    try {
      const result = await uploadImages(files);
      if (result.total_uploaded > 0) {
        const newImages = await fetchImages();
        setImages(newImages);
        setUploadMessage(`Uploaded ${result.total_uploaded} image(s)`);
      }
      if (result.total_failed > 0) {
        const failedNames = result.failed.map((f) => f.filename).join(', ');
        setUploadMessage((prev) =>
          prev ? `${prev}. Failed: ${failedNames}` : `Failed: ${failedNames}`
        );
      }
      setTimeout(() => setUploadMessage(null), 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadMessage('Upload failed');
      setTimeout(() => setUploadMessage(null), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    try {
      await deleteImage(filename);
      removeImage(filename);
    } catch (err) {
      console.error('Failed to remove image:', err);
    }
  };

  const handleRemoveAllImages = async () => {
    if (!window.confirm(`Remove all ${images.length} images from the gallery?`)) return;
    try {
      await Promise.all(images.map((img) => deleteImage(img.filename)));
      setImages([]);
    } catch (err) {
      console.error('Failed to remove all images:', err);
    }
  };

  const annotatedCount = images.filter((img) => img.isAnnotated).length;

  const UploadButton = () => (
    <div className="p-2 border-b border-gray-300">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.bmp,.tiff,.webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleUploadClick}
        disabled={uploading}
        className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <span className="animate-spin">&#8635;</span>
            Uploading...
          </>
        ) : (
          <>
            <span>+</span>
            Upload Images
          </>
        )}
      </button>
      {uploadMessage && (
        <p className="mt-1 text-xs text-center text-gray-600">{uploadMessage}</p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="w-48 bg-gray-100 border-r border-gray-300 flex flex-col">
        <UploadButton />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="w-48 bg-gray-100 border-r border-gray-300 flex flex-col">
        <UploadButton />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-gray-500 text-center text-sm">
            <p>No images found</p>
            <p className="mt-2 text-xs">Upload invoice images to get started</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-48 bg-gray-100 border-r border-gray-300 flex flex-col">
      <UploadButton />
      <div className="p-2 border-b border-gray-300 bg-gray-200">
        <h2 className="text-sm font-semibold text-gray-700">Images ({images.length})</h2>
        <p className="text-xs text-green-700 mt-0.5">
          {annotatedCount} / {images.length} annotated
        </p>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {images.map((img, index) => {
          const isSelected = index === currentIndex;
          const ocrDot =
            img.ocrStatus === 'done'
              ? '●'
              : img.ocrStatus === 'running'
              ? '◌'
              : img.ocrStatus === 'error'
              ? '✗'
              : '○';
          const ocrColor =
            img.ocrStatus === 'done'
              ? 'text-blue-500'
              : img.ocrStatus === 'running'
              ? 'text-yellow-500 animate-pulse'
              : img.ocrStatus === 'error'
              ? 'text-red-500'
              : 'text-gray-400';

          return (
            <div
              key={img.filename}
              className={`p-2 cursor-pointer border-b border-gray-200 hover:bg-gray-200 ${
                isSelected
                  ? img.isAnnotated
                    ? 'bg-green-100 border-l-4 border-l-green-500'
                    : 'bg-blue-100 border-l-4 border-l-blue-500'
                  : img.isAnnotated
                  ? 'bg-green-50 border-l-2 border-l-green-400'
                  : ''
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
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveImage(e, img.filename)}
                  title="Remove image"
                  className="absolute top-1 left-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600 text-xs leading-none"
                >
                  ×
                </button>
                {/* Annotation count */}
                {img.annotationCount > 0 && (
                  <span className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {img.annotationCount}
                  </span>
                )}
                {/* Annotated checkmark */}
                {img.isAnnotated && (
                  <span className="absolute bottom-1 right-1 text-green-600 font-bold text-sm leading-none">
                    ✓
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className={`text-xs font-bold ${ocrColor}`} title={`OCR: ${img.ocrStatus}`}>
                  {ocrDot}
                </span>
                <p className="text-xs text-gray-600 truncate flex-1" title={img.filename}>
                  {img.filename}
                </p>
              </div>
              <p className="text-xs text-gray-400">
                {img.width} × {img.height}
              </p>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-gray-300">
        <button
          onClick={handleRemoveAllImages}
          className="w-full px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
        >
          Remove All Images
        </button>
      </div>
    </div>
  );
};
