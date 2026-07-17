import { Renderer } from "../render";

export type ExportFormat = "png" | "jpeg" | "webp";

const MIME: Record<ExportFormat, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** Flatten the current document to an encoded image Blob. */
export async function flattenToBlob(
  renderer: Renderer,
  format: ExportFormat,
  quality = 0.92,
): Promise<Blob> {
  const canvas = await renderer.extractCanvas();
  const blob = await canvasToBlob(canvas, MIME[format], quality);
  if (!blob) throw new Error("Export failed");
  return blob;
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
