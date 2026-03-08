/**
 * Burns a repeating diagonal watermark text into an image using canvas.
 * Returns a data URL with the watermark permanently rendered on the image.
 * This ensures the watermark persists even when someone right-clicks + "Open in new tab".
 *
 * Uses fetch→blob→createObjectURL to avoid CORS issues with crossOrigin on <img>.
 */
export function burnWatermark(
  imageUrl: string,
  watermarkText: string,
  options?: { opacity?: number; fontSize?: number; gap?: number },
): Promise<string> {
  const { opacity = 0.12, fontSize = 32, gap = 120 } = options || {};

  return new Promise((resolve) => {
    // Fetch the image as blob to avoid CORS canvas tainting
    fetch(imageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { URL.revokeObjectURL(blobUrl); resolve(imageUrl); return; }

          // Draw original image
          ctx.drawImage(img, 0, 0);

          // Draw watermark — white text with shadow for visibility on any background
          ctx.save();
          ctx.globalAlpha = opacity;
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.rotate(-25 * Math.PI / 180);

          const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
          const textSpacing = watermarkText.length * fontSize * 0.6 + gap;

          for (let wy = -diagonal; wy < diagonal * 2; wy += gap) {
            for (let wx = -diagonal; wx < diagonal * 2; wx += textSpacing) {
              // Dark shadow for light backgrounds
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.fillText(watermarkText, wx + 1, wy + 1);
              // White text for dark backgrounds
              ctx.fillStyle = 'rgba(255,255,255,0.9)';
              ctx.fillText(watermarkText, wx, wy);
            }
          }
          ctx.restore();

          URL.revokeObjectURL(blobUrl);
          try {
            resolve(canvas.toDataURL('image/jpeg', 0.92));
          } catch {
            resolve(imageUrl);
          }
        };
        img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(imageUrl); };
        img.src = blobUrl;
      })
      .catch(() => resolve(imageUrl));
  });
}

/**
 * Cache for already-watermarked images to avoid re-processing.
 */
const wmCache = new Map<string, string>();

export async function getWatermarkedUrl(
  imageUrl: string,
  watermarkText: string,
): Promise<string> {
  const key = `${imageUrl}::${watermarkText}`;
  if (wmCache.has(key)) return wmCache.get(key)!;
  const result = await burnWatermark(imageUrl, watermarkText);
  wmCache.set(key, result);
  return result;
}
