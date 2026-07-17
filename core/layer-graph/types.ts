// Canonical data types for the LayerGraph — the in-house scene-graph abstraction
// that is the single source of truth for a Document. See TAXONOMY.md.
//
// This module is framework-agnostic on purpose: it must survive a future Tauri /
// mobile wrap and must not import React, Next.js, or pixi.js.

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

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
  /** Natural (unscaled) pixel width of the source image. */
  width: number;
  /** Natural (unscaled) pixel height of the source image. */
  height: number;
  /**
   * The decoded image data. In the browser this is an HTMLImageElement or
   * ImageBitmap; the renderer converts it to a GPU texture. Kept as `unknown`
   * here so this module never depends on DOM/GPU types.
   */
  bitmap: unknown;
}

export type LayerType = "raster";

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  transform: Transform;
  opacity: number; // 0..1
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  source: RasterSource;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface DocumentMeta {
  name: string;
  createdAt: number;
  modifiedAt: number;
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
