import { RasterSource } from "../layer-graph";

/**
 * Hard ceiling on any single imported image's largest dimension. Above this we
 * downsample on import so huge photos (e.g. 8000px phone panoramas) don't blow
 * up WebGL texture limits or stall the CPU raster paths. High-quality bilinear.
 */
export const MAX_IMPORT_DIMENSION = 4096;

/** Downscale a decoded image to a canvas if it exceeds `max`; else null. */
function downsampleIfLarge(img: HTMLImageElement, max: number): HTMLCanvasElement | null {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest <= max) return null;
  const scale = max / longest;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = nw;
  canvas.height = nh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, nw, nh);
  return canvas;
}

/** Decode an image File/Blob into a RasterSource the renderer can texture. */
export function loadImageAsSource(
  file: Blob,
  maxDimension = MAX_IMPORT_DIMENSION,
): Promise<RasterSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scaled = downsampleIfLarge(img, maxDimension);
      if (scaled) {
        URL.revokeObjectURL(url);
        resolve({ width: scaled.width, height: scaled.height, bitmap: scaled });
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight, bitmap: img });
      // Note: we intentionally keep the object URL alive for the element's
      // lifetime; the browser reclaims it when the element is GC'd.
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    img.src = url;
  });
}

/** Decode a raw data URL / URL string into a RasterSource. */
export function loadImageFromUrl(
  src: string,
  maxDimension = MAX_IMPORT_DIMENSION,
): Promise<RasterSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scaled = downsampleIfLarge(img, maxDimension);
      if (scaled) {
        resolve({ width: scaled.width, height: scaled.height, bitmap: scaled });
        return;
      }
      resolve({ width: img.naturalWidth, height: img.naturalHeight, bitmap: img });
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];

export function isSupportedImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}
