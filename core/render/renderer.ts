// The ONLY module permitted to import pixi.js. Keeping Pixi contained here means
// a future engine swap (or Tauri/mobile wrap) doesn't ripple through the app.
import {
  Application,
  ColorMatrixFilter,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";
import { BlendMode, CanvasSize, Layer, LayerGraph } from "../layer-graph";
import type { AdjustmentOptions } from "../file-io/raster-edit";
import { buildAdjustmentMatrix } from "./color-matrix";
import { HandleId, handlePositions, layerBounds } from "../tools/transform-math";
import type { SelectionRect } from "../file-io/clipboard";
import { maskToOverlayCanvas, type SelectionMask } from "../file-io/selection";
import type { PenNode } from "../file-io/pen";

/** Live pen-path preview (document-space). */
export interface PenPreviewState {
  nodes: PenNode[];
  closed: boolean;
  cursor?: { x: number; y: number } | null;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

/** Live tool cursor decorations, all in document-space coordinates. */
export interface ToolCursorState {
  /** Ring at the destination/paint point. */
  brush?: { x: number; y: number; r: number };
  /** Ring showing where a clone samples from (+ a link line to the brush). */
  cloneSource?: { x: number; y: number; r: number };
  /** Fixed clone source anchor marker (before painting starts). */
  anchor?: { x: number; y: number };
}

const CHECKER_LIGHT = 0x2c2f36;
const CHECKER_DARK = 0x22252b;
const CHECKER_SIZE = 16;
const HANDLE_SCREEN_PX = 10;

/**
 * Wraps a PixiJS Application. Subscribes to a LayerGraph and re-composites the
 * WebGL scene. Owns viewport pan/zoom and flatten-to-image extraction.
 */
export class Renderer {
  private app: Application | null = null;
  private viewport = new Container();
  private checker = new Graphics();
  private docLayers = new Container();
  private clipLayer = new Container();
  private overlay = new Graphics();
  private sprites = new Map<string, Sprite>();
  private textures = new Map<string, Texture>();
  private textureBitmaps = new Map<string, unknown>();
  private textureMasks = new Map<string, unknown>();
  private maskPreview = new Map<string, HTMLCanvasElement>();
  private clipMasks = new Map<string, Sprite>();
  private previewOffset = new Map<string, { dx: number; dy: number }>();
  private graph: LayerGraph | null = null;
  private unsubscribe: (() => void) | null = null;
  private view: ViewportState = { x: 0, y: 0, zoom: 1 };
  private showTransformHandles = false;
  private hostCanvas: HTMLCanvasElement | null = null;
  private selection: SelectionRect | null = null;
  private lassoPath: { x: number; y: number }[] | null = null;
  private penPreview: PenPreviewState | null = null;
  private showGuides = false;
  private toolCursor: ToolCursorState | null = null;
  private selectionMask: SelectionMask | null = null;
  private selectionSprite: Sprite | null = null;
  private selectionTexture: Texture | null = null;
  private snapLines: { axis: "x" | "y"; pos: number }[] = [];
  private viewportListeners = new Set<(v: ViewportState) => void>();
  private adjustFilters = new Map<string, ColorMatrixFilter>();

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    this.hostCanvas = canvas;
    const app = new Application();
    await app.init({
      canvas,
      width,
      height,
      backgroundColor: 0x101216,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: "webgl",
    });
    this.app = app;
    this.docLayers.sortableChildren = false;
    this.viewport.addChild(this.checker);
    this.viewport.addChild(this.docLayers);
    // Holds mirror sprites used only as clipping masks. Pixi excludes any object
    // assigned as a `.mask` from normal rendering, so these never draw twice.
    this.viewport.addChild(this.clipLayer);
    this.viewport.addChild(this.overlay);
    app.stage.addChild(this.viewport);
  }

  get ready(): boolean {
    return this.app !== null;
  }

  attachGraph(graph: LayerGraph): void {
    this.unsubscribe?.();
    this.graph = graph;
    this.drawChecker(graph.getCanvasSize());
    this.syncAll();
    this.unsubscribe = graph.subscribe(() => {
      this.syncAll();
    });
  }

  resize(width: number, height: number): void {
    this.app?.renderer.resize(width, height);
    this.drawOverlay();
  }

  setShowTransformHandles(show: boolean): void {
    this.showTransformHandles = show;
    this.drawOverlay();
  }

  setCursorOverride(cursor: string | null): void {
    if (this.hostCanvas) {
      this.hostCanvas.style.cursor = cursor ?? "";
    }
  }

  setSelection(rect: SelectionRect | null): void {
    this.selection = rect;
    this.drawOverlay();
  }

  getSelection(): SelectionRect | null {
    return this.selection ? { ...this.selection } : null;
  }

  setLassoPath(points: { x: number; y: number }[] | null): void {
    this.lassoPath = points;
    this.drawOverlay();
  }

  setPenPreview(state: PenPreviewState | null): void {
    this.penPreview = state;
    this.drawOverlay();
  }

  setShowGuides(show: boolean): void {
    this.showGuides = show;
    this.drawOverlay();
  }

  /** Set (or clear) live tool cursor decorations. Coordinates are document-space. */
  setToolCursor(state: ToolCursorState | null): void {
    this.toolCursor = state;
    this.drawOverlay();
  }

  /** Store the active pixel selection mask and refresh its on-canvas overlay. */
  setSelectionMask(mask: SelectionMask | null): void {
    this.selectionMask = mask;
    if (this.selectionSprite) {
      this.viewport.removeChild(this.selectionSprite);
      this.selectionSprite.destroy();
      this.selectionSprite = null;
    }
    if (this.selectionTexture && !this.selectionTexture.destroyed) {
      this.selectionTexture.destroy(true);
    }
    this.selectionTexture = null;
    if (mask) {
      const canvas = maskToOverlayCanvas(mask);
      this.selectionTexture = Texture.from(canvas, true);
      this.selectionSprite = new Sprite(this.selectionTexture);
      this.selectionSprite.anchor.set(0);
      // Sit above document layers but below the overlay handles/guides.
      const idx = this.viewport.getChildIndex(this.overlay);
      this.viewport.addChildAt(this.selectionSprite, idx);
    }
  }

  getSelectionMask(): SelectionMask | null {
    return this.selectionMask;
  }

  hasSelectionMask(): boolean {
    return this.selectionMask !== null;
  }

  setViewport(view: Partial<ViewportState>): void {
    this.view = { ...this.view, ...view };
    this.applyViewport();
    this.drawOverlay();
  }

  getViewport(): ViewportState {
    return { ...this.view };
  }

  /** Subscribe to pan/zoom changes (drives HTML rulers). Returns unsubscribe. */
  onViewportChange(cb: (v: ViewportState) => void): () => void {
    this.viewportListeners.add(cb);
    return () => this.viewportListeners.delete(cb);
  }

  /** Snap alignment guides (document-space axis positions) drawn during a drag. */
  setSnapLines(lines: { axis: "x" | "y"; pos: number }[]): void {
    this.snapLines = lines;
    this.drawOverlay();
  }

  /**
   * Live, non-destructive GPU preview of tonal/color adjustments on one layer via
   * a ColorMatrixFilter. Pass null to clear. The exact result is baked on Apply
   * through the CPU path, so preview ≈ final.
   */
  setAdjustmentPreview(layerId: string, opts: AdjustmentOptions | null): void {
    const sprite = this.sprites.get(layerId);
    if (!sprite) return;
    if (!opts) {
      const existing = this.adjustFilters.get(layerId);
      if (existing) {
        sprite.filters = [];
        existing.destroy?.();
        this.adjustFilters.delete(layerId);
      }
      return;
    }
    let filter = this.adjustFilters.get(layerId);
    if (!filter) {
      filter = new ColorMatrixFilter();
      this.adjustFilters.set(layerId, filter);
      sprite.filters = [filter];
    }
    filter.matrix = buildAdjustmentMatrix(opts) as ColorMatrixFilter["matrix"];
  }

  private applyViewport(): void {
    this.viewport.position.set(this.view.x, this.view.y);
    this.viewport.scale.set(this.view.zoom);
    for (const cb of this.viewportListeners) cb({ ...this.view });
  }

  fitToView(): void {
    if (!this.app || !this.graph) return;
    const { width: cw, height: ch } = this.graph.getCanvasSize();
    const vw = this.app.renderer.width / (window.devicePixelRatio || 1);
    const vh = this.app.renderer.height / (window.devicePixelRatio || 1);
    const zoom = Math.min(vw / cw, vh / ch) * 0.9;
    this.view = {
      zoom,
      x: (vw - cw * zoom) / 2,
      y: (vh - ch * zoom) / 2,
    };
    this.applyViewport();
    this.drawOverlay();
  }

  private drawChecker(size: CanvasSize): void {
    const g = this.checker;
    g.clear();
    const bg = this.graph?.getMeta().background ?? "transparent";
    if (bg && bg !== "transparent") {
      const hex = bg.startsWith("#") ? bg.slice(1) : bg;
      const color = Number.parseInt(hex.length === 6 ? hex : "181a1f", 16);
      g.rect(0, 0, size.width, size.height).fill(Number.isFinite(color) ? color : 0x181a1f);
      return;
    }
    g.rect(0, 0, size.width, size.height).fill(CHECKER_LIGHT);
    for (let y = 0; y < size.height; y += CHECKER_SIZE) {
      for (let x = 0; x < size.width; x += CHECKER_SIZE) {
        if (((x / CHECKER_SIZE) + (y / CHECKER_SIZE)) % 2 === 0) {
          const w = Math.min(CHECKER_SIZE, size.width - x);
          const h = Math.min(CHECKER_SIZE, size.height - y);
          g.rect(x, y, w, h).fill(CHECKER_DARK);
        }
      }
    }
  }

  private drawOverlay(): void {
    if (!this.graph) return;
    const g = this.overlay;
    g.clear();
    const size = this.graph.getCanvasSize();
    const strokeW = 1 / this.view.zoom;
    g.rect(0, 0, size.width, size.height).stroke({ width: strokeW, color: 0x3a3f4b });

    const active = this.graph.getActiveLayer();
    if (active && active.visible) {
      const b = layerBounds(active);
      const preview = this.previewOffset.get(active.id);
      const bx = b.x + (preview?.dx ?? 0);
      const by = b.y + (preview?.dy ?? 0);
      g.rect(bx, by, b.width, b.height).stroke({
        width: 1.5 / this.view.zoom,
        color: 0x6366f1,
      });

      if (this.showTransformHandles) {
        const half = HANDLE_SCREEN_PX / 2 / this.view.zoom;
        const positions = handlePositions({ ...b, x: bx, y: by });
        // Stem from top-center to rotate handle.
        g.moveTo(positions.n.x, positions.n.y)
          .lineTo(positions.rotate.x, positions.rotate.y)
          .stroke({ width: strokeW, color: 0x6366f1 });
        for (const [id, pos] of Object.entries(positions) as [string, { x: number; y: number }][]) {
          if (id === "rotate") {
            g.circle(pos.x, pos.y, half + 1 / this.view.zoom)
              .fill(0xffffff)
              .stroke({ width: strokeW, color: 0x6366f1 });
          } else {
            g.rect(pos.x - half, pos.y - half, half * 2, half * 2)
              .fill(0xffffff)
              .stroke({ width: strokeW, color: 0x6366f1 });
          }
        }
      }
    }

    if (this.lassoPath && this.lassoPath.length > 1) {
      g.moveTo(this.lassoPath[0].x, this.lassoPath[0].y);
      for (let i = 1; i < this.lassoPath.length; i++) {
        g.lineTo(this.lassoPath[i].x, this.lassoPath[i].y);
      }
      g.stroke({ width: 1 / this.view.zoom, color: 0xffffff, alpha: 0.85 });
    }

    if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
      const s = this.selection;
      g.rect(s.x, s.y, s.width, s.height)
        .fill({ color: 0x6366f1, alpha: 0.12 })
        .stroke({ width: 1 / this.view.zoom, color: 0xffffff, alpha: 0.9 });
    }

    if (this.showGuides) {
      const step = 50;
      for (let x = 0; x <= size.width; x += step) {
        g.moveTo(x, 0).lineTo(x, size.height).stroke({ width: 1 / this.view.zoom, color: 0x2a2e37, alpha: 0.6 });
      }
      for (let y = 0; y <= size.height; y += step) {
        g.moveTo(0, y).lineTo(size.width, y).stroke({ width: 1 / this.view.zoom, color: 0x2a2e37, alpha: 0.6 });
      }
    }

    if (this.snapLines.length > 0) {
      for (const line of this.snapLines) {
        if (line.axis === "x") {
          g.moveTo(line.pos, 0).lineTo(line.pos, size.height);
        } else {
          g.moveTo(0, line.pos).lineTo(size.width, line.pos);
        }
      }
      g.stroke({ width: 1 / this.view.zoom, color: 0xf472b6, alpha: 0.95 });
    }

    this.drawPenPreview(g);
    this.drawToolCursor(g);
  }

  private drawPenPreview(g: Graphics): void {
    const p = this.penPreview;
    if (!p || p.nodes.length === 0) return;
    const z = this.view.zoom;
    const nodes = p.nodes;

    // Path segments.
    g.moveTo(nodes[0].x, nodes[0].y);
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      g.bezierCurveTo(a.outX, a.outY, b.inX, b.inY, b.x, b.y);
    }
    if (p.closed && nodes.length > 1) {
      const a = nodes[nodes.length - 1];
      const b = nodes[0];
      g.bezierCurveTo(a.outX, a.outY, b.inX, b.inY, b.x, b.y);
    }
    g.stroke({ width: 1.5 / z, color: 0x6366f1, alpha: 0.95 });

    // Rubber-band from the last anchor to the cursor (open path only).
    if (!p.closed && p.cursor) {
      const last = nodes[nodes.length - 1];
      g.moveTo(last.x, last.y)
        .lineTo(p.cursor.x, p.cursor.y)
        .stroke({ width: 1 / z, color: 0x6366f1, alpha: 0.4 });
    }

    // Handles + anchors.
    const r = 3.5 / z;
    for (const n of nodes) {
      const hasHandles = n.outX !== n.x || n.outY !== n.y || n.inX !== n.x || n.inY !== n.y;
      if (hasHandles) {
        g.moveTo(n.inX, n.inY).lineTo(n.outX, n.outY).stroke({ width: 1 / z, color: 0x8b90a0, alpha: 0.8 });
        g.circle(n.inX, n.inY, r * 0.8).fill({ color: 0x8b90a0 });
        g.circle(n.outX, n.outY, r * 0.8).fill({ color: 0x8b90a0 });
      }
      g.rect(n.x - r, n.y - r, r * 2, r * 2)
        .fill(0xffffff)
        .stroke({ width: 1 / z, color: 0x6366f1 });
    }
  }

  private drawToolCursor(g: Graphics): void {
    const tc = this.toolCursor;
    if (!tc) return;
    const z = this.view.zoom;
    const thin = 1 / z;
    const AMBER = 0xf59e0b;

    // Link line + source sampling ring while cloning.
    if (tc.cloneSource) {
      const src = tc.cloneSource;
      if (tc.brush) {
        g.moveTo(src.x, src.y)
          .lineTo(tc.brush.x, tc.brush.y)
          .stroke({ width: thin, color: AMBER, alpha: 0.5 });
      }
      g.circle(src.x, src.y, src.r).stroke({ width: 1.5 / z, color: AMBER, alpha: 0.95 });
      const c = 4 / z;
      g.moveTo(src.x - c, src.y).lineTo(src.x + c, src.y).stroke({ width: thin, color: AMBER, alpha: 0.95 });
      g.moveTo(src.x, src.y - c).lineTo(src.x, src.y + c).stroke({ width: thin, color: AMBER, alpha: 0.95 });
    }

    // Fixed source anchor (set with Alt, before painting).
    if (tc.anchor) {
      const a = tc.anchor;
      const r = 8 / z;
      g.circle(a.x, a.y, r).stroke({ width: 1.5 / z, color: AMBER, alpha: 0.95 });
      const c = 6 / z;
      g.moveTo(a.x - c, a.y).lineTo(a.x + c, a.y).stroke({ width: 1.5 / z, color: AMBER, alpha: 0.95 });
      g.moveTo(a.x, a.y - c).lineTo(a.x, a.y + c).stroke({ width: 1.5 / z, color: AMBER, alpha: 0.95 });
    }

    // Destination brush ring (follows the cursor). Two-tone for contrast on any bg.
    if (tc.brush) {
      const b = tc.brush;
      g.circle(b.x, b.y, b.r).stroke({ width: 2.5 / z, color: 0x000000, alpha: 0.5 });
      g.circle(b.x, b.y, b.r).stroke({ width: 1 / z, color: 0xffffff, alpha: 0.95 });
    }
  }

  private syncAll(): void {
    if (!this.graph) return;
    const layers = this.graph.getLayersBottomUp();
    const seen = new Set<string>();

    layers.forEach((layer, index) => {
      if (layer.type === "group") return;
      seen.add(layer.id);
      let sprite = this.sprites.get(layer.id);
      const texture = this.getTexture(layer);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0);
        this.sprites.set(layer.id, sprite);
        this.docLayers.addChild(sprite);
      } else if (sprite.texture !== texture) {
        sprite.texture = texture;
      }
      this.applyLayer(sprite, layer);
      this.docLayers.setChildIndex(sprite, Math.min(index, this.docLayers.children.length - 1));
    });

    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.docLayers.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(id);
        const tex = this.textures.get(id);
        if (tex && !tex.destroyed) tex.destroy(true);
        this.textures.delete(id);
        this.textureBitmaps.delete(id);
        this.textureMasks.delete(id);
        this.maskPreview.delete(id);
        const af = this.adjustFilters.get(id);
        if (af) {
          af.destroy?.();
          this.adjustFilters.delete(id);
        }
      }
    }

    this.syncClipMasks(layers, seen);
    this.drawChecker(this.graph.getCanvasSize());
    this.drawOverlay();
  }

  /**
   * Apply clipping masks: a layer flagged `clip` is masked by the alpha of the
   * layer directly below it. We mirror the below layer into a dedicated mask
   * sprite (so the base still renders normally) and assign it as the Pixi mask.
   */
  private syncClipMasks(layers: readonly Layer[], seen: Set<string>): void {
    const drawable = layers.filter((l) => l.type !== "group");
    for (let i = 0; i < drawable.length; i++) {
      const layer = drawable[i];
      const sprite = this.sprites.get(layer.id);
      if (!sprite) continue;
      const below = i > 0 ? drawable[i - 1] : null;
      const belowSprite = below ? this.sprites.get(below.id) : null;
      const wantClip = !!layer.clip && !!belowSprite;

      let clip = this.clipMasks.get(layer.id);
      if (!wantClip) {
        if (clip) {
          sprite.mask = null;
          this.clipLayer.removeChild(clip);
          clip.destroy();
          this.clipMasks.delete(layer.id);
        }
        continue;
      }
      if (!clip) {
        clip = new Sprite(belowSprite!.texture);
        clip.anchor.set(0);
        this.clipLayer.addChild(clip);
        this.clipMasks.set(layer.id, clip);
      } else {
        clip.texture = belowSprite!.texture;
      }
      clip.position.copyFrom(belowSprite!.position);
      clip.scale.copyFrom(belowSprite!.scale);
      clip.rotation = belowSprite!.rotation;
      sprite.mask = clip;
    }

    for (const [id, clip] of this.clipMasks) {
      if (!seen.has(id)) {
        const sprite = this.sprites.get(id);
        if (sprite) sprite.mask = null;
        this.clipLayer.removeChild(clip);
        clip.destroy();
        this.clipMasks.delete(id);
      }
    }
  }

  private applyLayer(sprite: Sprite, layer: Layer): void {
    const t = layer.transform;
    const preview = this.previewOffset.get(layer.id);
    sprite.position.set(t.x + (preview?.dx ?? 0), t.y + (preview?.dy ?? 0));
    sprite.scale.set(t.scaleX, t.scaleY);
    sprite.rotation = t.rotation;
    sprite.alpha = layer.opacity;
    sprite.visible = layer.visible;
    sprite.blendMode = layer.blendMode as BlendMode;
  }

  private getTexture(layer: Layer): Texture {
    const maskBitmap = this.effectiveMaskBitmap(layer);
    const existing = this.textures.get(layer.id);
    const bound = this.textureBitmaps.get(layer.id);
    const maskBound = this.textureMasks.get(layer.id);
    if (
      existing &&
      !existing.destroyed &&
      bound === layer.source.bitmap &&
      maskBound === maskBitmap
    ) {
      return existing;
    }
    if (existing && !existing.destroyed) existing.destroy(true);
    // skipCache=true guarantees a uniquely-owned TextureSource per layer. Without
    // it, two layers referencing the same bitmap share a source, and destroying
    // one layer's texture orphans the other (null style → addressModeU crash).
    const src = maskBitmap
      ? this.compositeMaskedCanvas(layer.source, maskBitmap)
      : (layer.source.bitmap as HTMLImageElement);
    const texture = Texture.from(src as HTMLImageElement, true);
    this.textures.set(layer.id, texture);
    this.textureBitmaps.set(layer.id, layer.source.bitmap);
    this.textureMasks.set(layer.id, maskBitmap);
    return texture;
  }

  /** The mask bitmap that should be applied to a layer right now (preview wins). */
  private effectiveMaskBitmap(layer: Layer): unknown {
    const preview = this.maskPreview.get(layer.id);
    if (preview) return preview;
    if (layer.mask && layer.maskEnabled !== false) return layer.mask.bitmap;
    return null;
  }

  /** Bake a mask's alpha into a copy of the layer bitmap (non-destructive display). */
  private compositeMaskedCanvas(
    source: Layer["source"],
    maskBitmap: unknown,
  ): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cx = c.getContext("2d");
    if (cx) {
      cx.drawImage(source.bitmap as CanvasImageSource, 0, 0);
      cx.globalCompositeOperation = "destination-in";
      cx.drawImage(maskBitmap as CanvasImageSource, 0, 0, w, h);
      cx.globalCompositeOperation = "source-over";
    }
    return c;
  }

  /** Live mask-editing preview: composite `canvas` as the layer's mask until cleared. */
  setMaskPreview(layerId: string, canvas: HTMLCanvasElement | null): void {
    if (canvas) this.maskPreview.set(layerId, canvas);
    else this.maskPreview.delete(layerId);
    this.invalidateLayer(layerId);
  }

  setPreviewOffset(layerId: string, dx: number, dy: number): void {
    this.previewOffset.set(layerId, { dx, dy });
    const layer = this.graph?.getLayer(layerId);
    const sprite = this.sprites.get(layerId);
    if (layer && sprite) {
      this.applyLayer(sprite, layer);
      this.drawOverlay();
    }
  }

  clearPreview(layerId?: string): void {
    if (layerId) this.previewOffset.delete(layerId);
    else this.previewOffset.clear();
    this.syncAll();
  }

  /** Force-rebuild a layer's GPU texture after its bitmap changes outside a full sync. */
  invalidateLayer(layerId: string): void {
    const existing = this.textures.get(layerId);
    if (existing && !existing.destroyed) existing.destroy(true);
    this.textures.delete(layerId);
    this.textureBitmaps.delete(layerId);
    this.textureMasks.delete(layerId);
    this.syncAll();
  }

  /**
   * Fast path for live paint: if the texture already tracks this bitmap (e.g. a
   * working canvas), just upload the updated pixels. Otherwise rebuild.
   */
  refreshLayerFromBitmap(layerId: string): void {
    const layer = this.graph?.getLayer(layerId);
    if (!layer) return;
    const existing = this.textures.get(layerId);
    const bound = this.textureBitmaps.get(layerId);
    // Masked layers render a composited copy, so the fast in-place upload can't be
    // used — rebuild the texture so the mask is re-applied to the new pixels.
    if (
      !this.effectiveMaskBitmap(layer) &&
      existing &&
      !existing.destroyed &&
      bound === layer.source.bitmap
    ) {
      existing.source.update();
      return;
    }
    this.invalidateLayer(layerId);
  }

  hitTest(canvasX: number, canvasY: number): string | null {
    if (!this.graph) return null;
    const global = new Point(canvasX, canvasY);
    const layers = this.graph.getLayersBottomUp();
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked || layer.type === "group") continue;
      if (!this.pointHitsLayer(layer, global)) continue;
      return layer.id;
    }
    return null;
  }

  /** True if the screen point lies inside a specific layer's bounds (ignores z-order). */
  hitTestLayer(layerId: string, canvasX: number, canvasY: number): boolean {
    if (!this.graph) return false;
    const layer = this.graph.getLayer(layerId);
    if (!layer || !layer.visible || layer.locked || layer.type === "group") return false;
    return this.pointHitsLayer(layer, new Point(canvasX, canvasY));
  }

  /**
   * Bounds check + alpha sample so transparent areas of a raster/text bitmap
   * pass through to layers below. Text layers get a slightly looser alpha
   * threshold so thin glyphs are easier to grab.
   */
  private pointHitsLayer(layer: Layer, global: Point): boolean {
    const sprite = this.sprites.get(layer.id);
    if (!sprite) return false;
    const local = sprite.toLocal(global);
    const w = layer.source.width;
    const h = layer.source.height;
    if (local.x < 0 || local.y < 0 || local.x > w || local.y > h) return false;

    // Full-frame opaque photos: skip the (expensive) alpha read when clearly solid.
    // Text / partial rasters: require some coverage so empty padding doesn't steal hits.
    const bitmap = layer.source.bitmap as CanvasImageSource | undefined;
    if (!bitmap) return true;
    const ix = Math.min(w - 1, Math.max(0, Math.floor(local.x)));
    const iy = Math.min(h - 1, Math.max(0, Math.floor(local.y)));
    const alpha = sampleAlpha(bitmap, ix, iy, w, h);
    if (alpha === null) return true;
    const minAlpha = layer.type === "text" ? 8 : 16;
    return alpha >= minAlpha;
  }

  hitTestHandle(canvasX: number, canvasY: number, layerId: string): HandleId | null {
    if (!this.graph || !this.showTransformHandles) return null;
    const layer = this.graph.getLayer(layerId);
    if (!layer) return null;
    const doc = this.screenToDocument(canvasX, canvasY);
    const b = layerBounds(layer);
    const preview = this.previewOffset.get(layerId);
    const positions = handlePositions({
      ...b,
      x: b.x + (preview?.dx ?? 0),
      y: b.y + (preview?.dy ?? 0),
    });
    const hitR = (HANDLE_SCREEN_PX / 2 + 2) / this.view.zoom;
    for (const [id, pos] of Object.entries(positions) as [HandleId, { x: number; y: number }][]) {
      if (Math.abs(doc.x - pos.x) <= hitR && Math.abs(doc.y - pos.y) <= hitR) {
        return id;
      }
    }
    return null;
  }

  screenToDocument(canvasX: number, canvasY: number): { x: number; y: number } {
    const p = this.viewport.toLocal(new Point(canvasX, canvasY));
    return { x: p.x, y: p.y };
  }

  async extractCanvas(): Promise<HTMLCanvasElement> {
    if (!this.app || !this.graph) throw new Error("Renderer not ready");
    const size = this.graph.getCanvasSize();
    const prevView = { ...this.view };
    const prevPreview = new Map(this.previewOffset);
    const prevHandles = this.showTransformHandles;
    this.previewOffset.clear();
    this.showTransformHandles = false;
    this.setViewport({ x: 0, y: 0, zoom: 1 });
    this.syncAll();
    const overlayVisible = this.overlay.visible;
    const checkerVisible = this.checker.visible;
    this.overlay.visible = false;
    this.checker.visible = false;

    const frame = new Rectangle(0, 0, size.width, size.height);
    const result = this.app.renderer.extract.canvas({
      target: this.docLayers,
      frame,
      resolution: 1,
    }) as HTMLCanvasElement;

    this.overlay.visible = overlayVisible;
    this.checker.visible = checkerVisible;
    this.previewOffset = prevPreview;
    this.showTransformHandles = prevHandles;
    this.setViewport(prevView);
    this.syncAll();
    return result;
  }

  /**
   * Render a single layer onto a document-sized transparent canvas (position &
   * transform preserved, other layers hidden). Used for batch layer export.
   */
  async extractLayerCanvas(layerId: string): Promise<HTMLCanvasElement> {
    if (!this.app || !this.graph) throw new Error("Renderer not ready");
    const size = this.graph.getCanvasSize();
    const prevView = { ...this.view };
    const prevPreview = new Map(this.previewOffset);
    const prevHandles = this.showTransformHandles;
    this.previewOffset.clear();
    this.showTransformHandles = false;
    this.setViewport({ x: 0, y: 0, zoom: 1 });
    this.syncAll();
    const overlayVisible = this.overlay.visible;
    const checkerVisible = this.checker.visible;
    this.overlay.visible = false;
    this.checker.visible = false;

    const savedVisibility = new Map<string, boolean>();
    for (const [id, sprite] of this.sprites) {
      savedVisibility.set(id, sprite.visible);
      sprite.visible = id === layerId;
    }

    const frame = new Rectangle(0, 0, size.width, size.height);
    const result = this.app.renderer.extract.canvas({
      target: this.docLayers,
      frame,
      resolution: 1,
    }) as HTMLCanvasElement;

    for (const [id, sprite] of this.sprites) {
      sprite.visible = savedVisibility.get(id) ?? true;
    }
    this.overlay.visible = overlayVisible;
    this.checker.visible = checkerVisible;
    this.previewOffset = prevPreview;
    this.showTransformHandles = prevHandles;
    this.setViewport(prevView);
    this.syncAll();
    return result;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const t of this.textures.values()) if (!t.destroyed) t.destroy(true);
    if (this.selectionTexture && !this.selectionTexture.destroyed) this.selectionTexture.destroy(true);
    this.selectionTexture = null;
    this.selectionSprite = null;
    this.selectionMask = null;
    this.textures.clear();
    this.textureBitmaps.clear();
    this.textureMasks.clear();
    this.maskPreview.clear();
    this.clipMasks.clear();
    this.adjustFilters.clear();
    this.sprites.clear();
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.hostCanvas = null;
  }
}

/** 1×1 scratch canvas for alpha sampling under the pointer. */
let alphaProbe: HTMLCanvasElement | null = null;
let alphaProbeCtx: CanvasRenderingContext2D | null = null;

function sampleAlpha(
  bitmap: CanvasImageSource,
  ix: number,
  iy: number,
  srcW: number,
  srcH: number,
): number | null {
  try {
    if (!alphaProbe) {
      alphaProbe = document.createElement("canvas");
      alphaProbe.width = 1;
      alphaProbe.height = 1;
      alphaProbeCtx = alphaProbe.getContext("2d", { willReadFrequently: true });
    }
    const ctx = alphaProbeCtx;
    if (!ctx) return null;
    ctx.clearRect(0, 0, 1, 1);
    // Draw the single source pixel into the probe.
    ctx.drawImage(bitmap, ix, iy, 1, 1, 0, 0, 1, 1);
    const a = ctx.getImageData(0, 0, 1, 1).data[3];
    // Guard against zero-size / tainted canvas failures silently.
    void srcW;
    void srcH;
    return a;
  } catch {
    return null;
  }
}
