import { createEmptyMask, SelectionMask } from "./selection";

/**
 * A single pen anchor with its two bezier control handles (absolute
 * document-space coordinates). For a corner point the handles coincide with
 * the anchor position.
 */
export interface PenNode {
  x: number;
  y: number;
  inX: number;
  inY: number;
  outX: number;
  outY: number;
}

export interface PenPath {
  nodes: PenNode[];
  closed: boolean;
}

/** Build a browser Path2D (document-space) from a pen path. */
export function buildPath2D(path: PenPath): Path2D {
  const p = new Path2D();
  const n = path.nodes;
  if (n.length === 0) return p;
  p.moveTo(n[0].x, n[0].y);
  for (let i = 0; i < n.length - 1; i++) {
    const a = n[i];
    const b = n[i + 1];
    p.bezierCurveTo(a.outX, a.outY, b.inX, b.inY, b.x, b.y);
  }
  if (path.closed && n.length > 1) {
    const a = n[n.length - 1];
    const b = n[0];
    p.bezierCurveTo(a.outX, a.outY, b.inX, b.inY, b.x, b.y);
    p.closePath();
  }
  return p;
}

/** Rasterize a closed pen path into a selection mask via even-odd fill. */
export function penPathToMask(
  width: number,
  height: number,
  path: PenPath,
): SelectionMask {
  const mask = createEmptyMask(width, height);
  if (path.nodes.length < 2) return mask;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return mask;
  const p2d = buildPath2D({ ...path, closed: true });
  ctx.fillStyle = "#ffffff";
  ctx.fill(p2d);
  const img = ctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < mask.data.length; i++) {
    mask.data[i] = img[i * 4 + 3];
  }
  return mask;
}
