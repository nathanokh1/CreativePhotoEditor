import { Renderer } from "../render";

export type ExportFormat = "png" | "jpeg" | "webp";

const MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface ExportImageOptions {
  quality?: number;
  scale?: number;
  /** A CSS color to paint behind the image, or "transparent" (default) to keep alpha. */
  background?: string;
}

/** Flatten the current document to an encoded image Blob. */
export async function flattenToBlob(
  renderer: Renderer,
  format: ExportFormat,
  options: ExportImageOptions = {},
): Promise<Blob> {
  const { quality = 0.92, scale = 1 } = options;
  const canvas = await renderer.extractCanvas();
  let out = scale !== 1 ? scaleCanvas(canvas, scale) : canvas;
  // JPEG has no alpha, so it always needs an opaque backdrop (default white).
  const bg = options.background ?? (format === "jpeg" ? "#ffffff" : "transparent");
  if (bg !== "transparent") out = fillBackground(out, bg);
  const blob = await canvasToBlob(out, MIME[format], quality);
  if (!blob) throw new Error("Export failed");
  return blob;
}

/** Return a copy of the canvas scaled by `scale` with high-quality smoothing. */
export function scaleCanvas(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const scaled = document.createElement("canvas");
  scaled.width = Math.max(1, Math.round(canvas.width * scale));
  scaled.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = scaled.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
  return scaled;
}

/** Composite the canvas over a solid background color, returning a new opaque canvas. */
export function fillBackground(canvas: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

/**
 * Crop a canvas to the bounding box of its non-transparent pixels. Returns the
 * original canvas if it's fully transparent (nothing to trim to).
 */
export function trimCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;
  const { width, height } = canvas;
  if (width === 0 || height === 0) return canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return canvas;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  if (w === width && h === height) return canvas;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  if (!octx) return canvas;
  octx.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);
  return out;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
