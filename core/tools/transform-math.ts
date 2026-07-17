import { Layer, Transform } from "../layer-graph";

/** Eight resize handles around a layer's axis-aligned bounding box. */
export type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export interface LayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Document-space axis-aligned bounds of a layer (ignoring rotation for MVP). */
export function layerBounds(layer: Layer): LayerBounds {
  const t = layer.transform;
  return {
    x: t.x,
    y: t.y,
    width: layer.source.width * t.scaleX,
    height: layer.source.height * t.scaleY,
  };
}

export function handlePositions(b: LayerBounds): Record<HandleId, { x: number; y: number }> {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return {
    nw: { x: b.x, y: b.y },
    n: { x: cx, y: b.y },
    ne: { x: b.x + b.width, y: b.y },
    e: { x: b.x + b.width, y: cy },
    se: { x: b.x + b.width, y: b.y + b.height },
    s: { x: cx, y: b.y + b.height },
    sw: { x: b.x, y: b.y + b.height },
    w: { x: b.x, y: cy },
  };
}

export function handleCursor(id: HandleId): string {
  switch (id) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
  }
}

/**
 * Resize a layer from a dragged handle. Anchor is the opposite corner/edge.
 * When `lockAspect` is true, corners keep proportions; edges still stretch one axis.
 */
export function resizeFromHandle(
  layer: Layer,
  start: Transform,
  handle: HandleId,
  pointer: { x: number; y: number },
  lockAspect: boolean,
): Transform {
  const sw = layer.source.width;
  const sh = layer.source.height;
  const startW = sw * start.scaleX;
  const startH = sh * start.scaleY;

  // Fixed anchor point (opposite side of the dragged handle).
  let ax = start.x;
  let ay = start.y;
  if (handle.includes("e") || handle === "e") ax = start.x;
  if (handle.includes("w") || handle === "w") ax = start.x + startW;
  if (handle === "n" || handle === "s") ax = start.x + startW / 2;
  if (handle.includes("s") || handle === "s") ay = start.y;
  if (handle.includes("n") || handle === "n") ay = start.y + startH;
  if (handle === "e" || handle === "w") ay = start.y + startH / 2;

  // Refine anchors per handle for clarity.
  switch (handle) {
    case "nw":
      ax = start.x + startW;
      ay = start.y + startH;
      break;
    case "ne":
      ax = start.x;
      ay = start.y + startH;
      break;
    case "se":
      ax = start.x;
      ay = start.y;
      break;
    case "sw":
      ax = start.x + startW;
      ay = start.y;
      break;
    case "n":
      ax = start.x + startW / 2;
      ay = start.y + startH;
      break;
    case "s":
      ax = start.x + startW / 2;
      ay = start.y;
      break;
    case "e":
      ax = start.x;
      ay = start.y + startH / 2;
      break;
    case "w":
      ax = start.x + startW;
      ay = start.y + startH / 2;
      break;
  }

  let newW = startW;
  let newH = startH;

  const isCorner = handle.length === 2;
  const isHorizontal = handle === "e" || handle === "w" || isCorner;
  const isVertical = handle === "n" || handle === "s" || isCorner;

  if (isHorizontal) newW = Math.abs(pointer.x - ax);
  if (isVertical) newH = Math.abs(pointer.y - ay);

  // Minimum size so layers don't vanish.
  newW = Math.max(8, newW);
  newH = Math.max(8, newH);

  if (lockAspect && isCorner) {
    const ratio = startW / Math.max(1, startH);
    // Prefer the axis that moved more.
    if (Math.abs(newW / ratio - newH) > Math.abs(newH * ratio - newW)) {
      newH = newW / ratio;
    } else {
      newW = newH * ratio;
    }
    newW = Math.max(8, newW);
    newH = Math.max(8, newH);
  }

  let newX = start.x;
  let newY = start.y;

  switch (handle) {
    case "nw":
      newX = ax - newW;
      newY = ay - newH;
      break;
    case "ne":
      newX = ax;
      newY = ay - newH;
      break;
    case "se":
      newX = ax;
      newY = ay;
      break;
    case "sw":
      newX = ax - newW;
      newY = ay;
      break;
    case "n":
      newX = ax - newW / 2;
      newY = ay - newH;
      break;
    case "s":
      newX = ax - newW / 2;
      newY = ay;
      break;
    case "e":
      newX = ax;
      newY = ay - newH / 2;
      break;
    case "w":
      newX = ax - newW;
      newY = ay - newH / 2;
      break;
  }

  return {
    ...start,
    x: newX,
    y: newY,
    scaleX: newW / sw,
    scaleY: newH / sh,
  };
}
