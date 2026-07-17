import { Layer, RasterSource } from "../layer-graph";

/** Document-space axis-aligned selection rectangle. */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipboardPayload {
  source: RasterSource;
  name: string;
}

/**
 * Crop a rectangular region of a raster layer (document-space selection mapped
 * into the layer's unscaled bitmap). Returns null if the intersection is empty.
 */
export async function cropLayerToSelection(
  layer: Layer,
  selection: SelectionRect,
): Promise<ClipboardPayload | null> {
  const t = layer.transform;
  // Map document selection into layer-local (unscaled) pixel space.
  const localX = (selection.x - t.x) / t.scaleX;
  const localY = (selection.y - t.y) / t.scaleY;
  const localW = selection.width / t.scaleX;
  const localH = selection.height / t.scaleY;

  const sx = Math.max(0, Math.floor(localX));
  const sy = Math.max(0, Math.floor(localY));
  const ex = Math.min(layer.source.width, Math.ceil(localX + localW));
  const ey = Math.min(layer.source.height, Math.ceil(localY + localH));
  const w = ex - sx;
  const h = ey - sy;
  if (w <= 0 || h <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(layer.source.bitmap as CanvasImageSource, sx, sy, w, h, 0, 0, w, h);

  const img = await canvasToImage(canvas);
  return {
    name: `${layer.name} copy`,
    source: { width: w, height: h, bitmap: img },
  };
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("crop failed"));
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("crop decode failed"));
      img.src = url;
    }, "image/png");
  });
}

/** Duplicate an entire layer's raster into a clipboard payload. */
export async function cloneLayerSource(layer: Layer): Promise<ClipboardPayload> {
  const canvas = document.createElement("canvas");
  canvas.width = layer.source.width;
  canvas.height = layer.source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(layer.source.bitmap as CanvasImageSource, 0, 0);
  const img = await canvasToImage(canvas);
  return {
    name: `${layer.name} copy`,
    source: { width: layer.source.width, height: layer.source.height, bitmap: img },
  };
}
