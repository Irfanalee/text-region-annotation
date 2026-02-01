import React, { useRef, useState } from 'react';
import { useImageStore } from '../store/imageStore';
import { getImageUrl } from '../api/client';
import { uploadImages, fetchImages } from '../api/images';

export const ImageSidebar: React.FC = () => {
  const { images, currentIndex, setCurrentIndex, setImages, isLoading } = useImageStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadMessage(null);

    try {
      const result = await uploadImages(files);

      if (result.total_uploaded > 0) {
        // Refresh the image list
        const newImages = await fetchImages();
        setImages(newImages);
        setUploadMessage(`Uploaded ${result.total_uploaded} image(s)`);
      }

      if (result.total_failed > 0) {
        const failedNames = result.failed.map(f => f.filename).join(', ');
        setUploadMessage(prev =>
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
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
            <p className="mt-2 text-xs">Upload images or add to<br />dataset/images/</p>
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
