import { RasterSource } from "../layer-graph";

/** Decode an image File/Blob into a RasterSource the renderer can texture. */
export function loadImageAsSource(file: Blob): Promise<RasterSource> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
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
export function loadImageFromUrl(src: string): Promise<RasterSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight, bitmap: img });
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp"];

export function isSupportedImage(file: File): boolean {
  return IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}
