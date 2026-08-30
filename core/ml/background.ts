// On-device (in-browser) foreground segmentation. Wraps @imgly/background-removal
// which runs an ONNX model via WASM entirely client-side — images never leave the
// device and there is no per-use cost. The model assets are fetched (and cached)
// on first use. This module is imported dynamically so the heavy dep stays out of
// the initial bundle.

import type { RasterSource } from "../layer-graph";

/** Draw a raster source into a fresh 2D canvas (its own pixels). */
function sourceCanvas(source: RasterSource): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, source.width);
  c.height = Math.max(1, source.height);
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(source.bitmap as CanvasImageSource, 0, 0);
  return c;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode failed"));
    };
    img.src = url;
  });
}

// Loaded from a CDN at runtime (not through webpack) — @imgly/background-removal
// bundles onnxruntime-web, whose `import.meta` breaks Terser during `next build`.
// A runtime ESM import keeps the heavy WASM/model machinery out of the bundle;
// the model + wasm are still fetched on-device (and cached) at first use.
// Typed as `string` (not a literal) so TypeScript doesn't try to resolve the URL
// as a module at compile time.
const BG_REMOVAL_ESM: string = "https://esm.sh/@imgly/background-removal@1.7.0";

type BgRemovalModule = {
  removeBackground: (input: Blob) => Promise<Blob>;
};

let modulePromise: Promise<BgRemovalModule> | null = null;

function loadBgRemoval(): Promise<BgRemovalModule> {
  if (!modulePromise) {
    modulePromise = import(/* webpackIgnore: true */ BG_REMOVAL_ESM) as Promise<BgRemovalModule>;
  }
  return modulePromise;
}

/**
 * Segment the foreground/subject. Returns a canvas the exact size of `source`
 * where the subject keeps its pixels and the background is transparent.
 */
export async function segmentForeground(source: RasterSource): Promise<HTMLCanvasElement> {
  const { removeBackground } = await loadBgRemoval();
  const input = await canvasToBlob(sourceCanvas(source));
  const cutoutBlob = await removeBackground(input);
  const img = await blobToImage(cutoutBlob);
  const out = document.createElement("canvas");
  out.width = Math.max(1, source.width);
  out.height = Math.max(1, source.height);
  const ctx = out.getContext("2d");
  if (ctx) ctx.drawImage(img, 0, 0, out.width, out.height);
  return out;
}
