'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import apiClient from '@/lib/api-client';
import { resolveImageUrl } from '@/lib/format';
import { showApiError } from '@/components/api-error-toast';

interface UploadedImage {
  id: string;
  originalUrl: string;
  thumbnailUrl: string | null;
  watermarkedUrl: string | null;
  status: string;
  sortOrder: number;
  isCover: boolean;
}

interface ImageUploadProps {
  parcelId: string;
  images?: UploadedImage[];
  onChange?: (images: UploadedImage[]) => void;
  maxImages?: number;
}

export function ImageUpload({
  parcelId,
  images: initialImages = [],
  onChange,
  maxImages = 20,
}: ImageUploadProps) {
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync with parent when initialImages change
  useEffect(() => {
    if (initialImages.length > 0 && images.length === 0) {
      setImages(initialImages);
    }
  }, [initialImages, images.length]);

  const updateImages = useCallback(
    (updated: UploadedImage[]) => {
      setImages(updated);
      onChange?.(updated);
    },
    [onChange],
  );

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const remaining = maxImages - images.length;
      if (remaining <= 0) return;

      const toUpload = files.slice(0, remaining);
      setUploading(true);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        toUpload.forEach((file) => formData.append('files', file));

        const { data } = await apiClient.post<UploadedImage[]>(
          `/parcels/${parcelId}/images/upload`,
          formData,
          {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (event) => {
              if (event.total) {
                setUploadProgress(Math.round((event.loaded / event.total) * 100));
              }
            },
          },
        );

        updateImages([...images, ...data]);
      } catch (err) {
        showApiError(err);
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [parcelId, images, maxImages, updateImages],
  );

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    uploadFiles(files);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith('image/'),
    );
    uploadFiles(files);
  }

  async function handleRemove(imageId: string) {
    try {
      await apiClient.delete(`/parcels/${parcelId}/images/${imageId}`);
      updateImages(images.filter((img) => img.id !== imageId));
    } catch (err) {
      showApiError(err);
    }
  }

  async function handleSetCover(imageId: string) {
    try {
      await apiClient.post(`/parcels/${parcelId}/images/${imageId}/cover`);
      updateImages(
        images.map((img) => ({ ...img, isCover: img.id === imageId })),
      );
    } catch (err) {
      showApiError(err);
    }
  }

  // Drag-to-reorder handlers
  function handleReorderDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleReorderDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  async function handleReorderDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    if (dragIdx === null || dragIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const reordered = [...images];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved);

    updateImages(reordered);
    setDragIdx(null);
    setDragOverIdx(null);

    // Persist reorder to backend
    try {
      await apiClient.post(`/parcels/${parcelId}/images/reorder`, {
        imageIds: reordered.map((img) => img.id),
      });
    } catch (err) {
      showApiError(err);
    }
  }

  function getImageSrc(img: UploadedImage): string {
    return resolveImageUrl(img);
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium">
        Fotograflar
        <span className="ml-1 text-xs text-[var(--muted-foreground)]">
          ({images.length}/{maxImages})
        </span>
      </label>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? 'border-brand-500 bg-brand-50'
            : 'border-[var(--border)] hover:border-brand-300 hover:bg-brand-50/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-3">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
              <svg className="h-5 w-5 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-sm font-medium">Yukleniyor... %{uploadProgress}</p>
            <div className="mx-auto h-2 w-40 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-medium">Fotograflari surukleyip birakin veya tiklayin</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">JPG, PNG, WebP — Maks. 10 MB / dosya</p>
          </>
        )}
      </div>

      {/* Image preview grid */}
      {images.length > 0 && (
        <>
          <p className="text-xs text-[var(--muted-foreground)]">
            Sirayi degistirmek icin surukleyin. Kapak gorseli secmek icin yildiz ikonuna tiklayin.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img, idx) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleReorderDragStart(idx)}
                onDragOver={(e) => handleReorderDragOver(e, idx)}
                onDrop={(e) => handleReorderDrop(e, idx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`group relative aspect-square overflow-hidden rounded-lg border-2 bg-[var(--muted)] cursor-grab active:cursor-grabbing transition-all ${
                  dragOverIdx === idx && dragIdx !== idx
                    ? 'border-brand-500 scale-105'
                    : img.isCover
                      ? 'border-brand-400'
                      : 'border-[var(--border)]'
                }`}
              >
                <img
                  src={getImageSrc(img)}
                  alt={`Fotograf ${idx + 1}`}
                  className="h-full w-full object-cover"
                  draggable={false}
                />

                {/* Status overlay */}
                {img.status !== 'ready' && img.status !== 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <span className="rounded bg-white/90 px-2 py-1 text-xs font-medium">
                      {img.status === 'processing' ? 'Isleniyor...' : 'Hata'}
                    </span>
                  </div>
                )}

                {/* Cover badge */}
                {img.isCover && (
                  <span className="absolute top-2 left-2 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                    Kapak
                  </span>
                )}

                {/* Sort order badge */}
                <span className="absolute bottom-2 left-2 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[10px] font-bold text-white">
                  {idx + 1}
                </span>

                {/* Action buttons (visible on hover) */}
                <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {/* Set cover */}
                  {!img.isCover && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleSetCover(img.id); }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow"
                      title="Kapak gorseli yap"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  )}

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemove(img.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow"
                    aria-label="Sil"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
