'use client';

import { useEffect } from 'react';

interface VideoPopupProps {
  onClose: () => void;
  videoUrl?: string;
}

export function VideoPopup({
  onClose,
  videoUrl,
}: VideoPopupProps) {
  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!videoUrl) return null;

  const isDirectVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(videoUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white text-xl hover:text-gray-300 transition-colors"
        >
          ✕ Kapat
        </button>

        {/* Video */}
        <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ paddingBottom: '56.25%' }}>
          {isDirectVideo ? (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <iframe
              src={videoUrl}
              title="NetTapu Tanıtım Videosu"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </div>
  );
}
