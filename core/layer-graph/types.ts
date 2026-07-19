// Canonical data types for the LayerGraph — the in-house scene-graph abstraction
// that is the single source of truth for a Document. See TAXONOMY.md.
//
// This module is framework-agnostic on purpose: it must survive a future Tauri /
// mobile wrap and must not import React, Next.js, or pixi.js.

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

export interface Transform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number; // radians
}

export function identityTransform(): Transform {
  return { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
}

/** Raster pixel source for a layer. Kept as an ImageBitmap-friendly source. */
export interface RasterSource {
  width: number;
  height: number;
  bitmap: unknown;
}

export type LayerType = "raster" | "text" | "group";

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  transform: Transform;
  opacity: number; // 0..1
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  /** Raster / text bitmap. Groups have a 1×1 transparent placeholder. */
  source: RasterSource;
  /**
   * Optional layer mask (same dimensions as `source`). Stored as RGBA where the
   * alpha channel is the coverage (255 = fully visible, 0 = hidden). Applied
   * non-destructively at render time.
   */
  mask?: RasterSource | null;
  /** When false, the mask is ignored (kept but disabled). Defaults to true. */
  maskEnabled?: boolean;
  /** Clip this layer to the alpha of the layer directly below it. */
  clip?: boolean;
  /** For type === "text" */
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fillColor?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  /** For type === "group" — child layer ids (paint order bottom→top). */
  childIds?: string[];
  /** If set, this layer belongs to a group. */
  parentId?: string | null;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export type CanvasBackground = "transparent" | string;

export interface DocumentMeta {
  name: string;
  createdAt: number;
  modifiedAt: number;
  background?: CanvasBackground;
}

/** Events emitted by the LayerGraph so the renderer + UI store can react. */
export type LayerGraphEvent =
  | { type: "layer-added"; layerId: string }
  | { type: "layer-removed"; layerId: string }
  | { type: "layer-updated"; layerId: string }
  | { type: "layer-reordered" }
  | { type: "active-changed"; layerId: string | null }
  | { type: "canvas-resized" }
  | { type: "graph-replaced" };

export type LayerGraphListener = (event: LayerGraphEvent) => void;
