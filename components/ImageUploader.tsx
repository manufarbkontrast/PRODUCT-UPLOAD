'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface ImageUploaderProps {
  productId: string;
  onUploadComplete?: () => void;
}

export default function ImageUploader({ productId, onUploadComplete }: ImageUploaderProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;

    const newImages: ImageFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      newImages.push({
        id: `${Date.now()}-${i}`,
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
      });
    }

    setImages(prev => [...prev, ...newImages]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeImage = (id: string) => {
    setImages(prev => {
      const img = prev.find(i => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter(i => i.id !== id);
    });
  };

  const uploadImages = async () => {
    if (images.length === 0) return;

    setUploading(true);

    for (const image of images) {
      if (image.status !== 'pending') continue;

      setImages(prev =>
        prev.map(img =>
          img.id === image.id ? { ...img, status: 'uploading' } : img
        )
      );

      try {
        const formData = new FormData();
        formData.append('file', image.file);

        const res = await fetch(`/api/products/${productId}/images`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Upload fehlgeschlagen');

        setImages(prev =>
          prev.map(img =>
            img.id === image.id ? { ...img, status: 'done' } : img
          )
        );
      } catch {
        setImages(prev =>
          prev.map(img =>
            img.id === image.id ? { ...img, status: 'error' } : img
          )
        );
      }
    }

    setUploading(false);
    onUploadComplete?.();
  };

  const pendingCount = images.filter(i => i.status === 'pending').length;
  const doneCount = images.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg p-6 text-center cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <svg className="w-8 h-8 mx-auto mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Bilder auswählen oder hierher ziehen
        </p>
        <p className="text-xs text-zinc-400 mt-1">JPG, PNG, WebP</p>
      </div>

      {/* Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image) => (
            <div
              key={image.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800"
            >
              <img
                src={image.preview}
                alt=""
                className="w-full h-full object-cover"
              />

              {/* Status Overlay */}
              {image.status === 'uploading' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}

              {image.status === 'done' && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {image.status === 'error' && (
                <div className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}

              {/* Remove Button */}
              {image.status === 'pending' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                  }}
                  className="absolute top-1 right-1 bg-zinc-900/70 hover:bg-zinc-900 rounded-full p-1"
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Status & Upload Button */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{images.length} Bild{images.length !== 1 ? 'er' : ''}</span>
            {doneCount > 0 && <span>{doneCount} hochgeladen</span>}
          </div>

          {pendingCount > 0 && (
            <button
              onClick={uploadImages}
              disabled={uploading}
              className="w-full py-2.5 px-4 bg-zinc-900 text-white rounded-lg text-sm font-medium disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {uploading ? 'Lädt hoch...' : `${pendingCount} Bild${pendingCount !== 1 ? 'er' : ''} hochladen`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
