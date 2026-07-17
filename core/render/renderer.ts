// The ONLY module permitted to import pixi.js. Keeping Pixi contained here means
// a future engine swap (or Tauri/mobile wrap) doesn't ripple through the app.
import {
  Application,
  Container,
  Graphics,
  Point,
  Rectangle,
  Sprite,
  Texture,
} from "pixi.js";
import { BlendMode, CanvasSize, Layer, LayerGraph } from "../layer-graph";

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

const CHECKER_LIGHT = 0x2c2f36;
const CHECKER_DARK = 0x22252b;
const CHECKER_SIZE = 16;

/**
 * Wraps a PixiJS Application. Subscribes to a LayerGraph and re-composites the
 * WebGL scene. Owns viewport pan/zoom and flatten-to-image extraction.
 */
export class Renderer {
  private app: Application | null = null;
  private viewport = new Container();
  private checker = new Graphics();
  private docLayers = new Container();
  private overlay = new Graphics();
  private sprites = new Map<string, Sprite>();
  private textures = new Map<string, Texture>();
  private previewOffset = new Map<string, { dx: number; dy: number }>();
  private graph: LayerGraph | null = null;
  private unsubscribe: (() => void) | null = null;
  private view: ViewportState = { x: 0, y: 0, zoom: 1 };

  async init(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
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
      // Coarse re-sync keeps MVP simple; optimize per-event later if needed.
      this.syncAll();
    });
  }

  resize(width: number, height: number): void {
    this.app?.renderer.resize(width, height);
    this.drawOverlay();
  }

  // ---- viewport -----------------------------------------------------------

  setViewport(view: Partial<ViewportState>): void {
    this.view = { ...this.view, ...view };
    this.applyViewport();
  }

  getViewport(): ViewportState {
    return { ...this.view };
  }

  private applyViewport(): void {
    this.viewport.position.set(this.view.x, this.view.y);
    this.viewport.scale.set(this.view.zoom);
  }

  /** Fit the document centered in the current view with a small margin. */
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
  }

  // ---- checker + overlay --------------------------------------------------

  private drawChecker(size: CanvasSize): void {
    const g = this.checker;
    g.clear();
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
    // Document border.
    g.rect(0, 0, size.width, size.height).stroke({ width: 1 / this.view.zoom, color: 0x3a3f4b });
    // Active layer selection outline.
    const active = this.graph.getActiveLayer();
    if (active && active.visible) {
      const b = this.spriteBounds(active);
      if (b) {
        g.rect(b.x, b.y, b.width, b.height).stroke({
          width: 1.5 / this.view.zoom,
          color: 0x6366f1,
        });
      }
    }
  }

  private spriteBounds(layer: Layer): Rectangle | null {
    const sprite = this.sprites.get(layer.id);
    if (!sprite) return null;
    const b = sprite.getBounds();
    // Convert world (screen) bounds back to viewport-local (document) space.
    const tl = this.viewport.toLocal(new Point(b.x, b.y));
    const br = this.viewport.toLocal(new Point(b.x + b.width, b.y + b.height));
    return new Rectangle(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  }

  // ---- graph sync ---------------------------------------------------------

  private syncAll(): void {
    if (!this.graph) return;
    const layers = this.graph.getLayersBottomUp();
    const seen = new Set<string>();

    layers.forEach((layer, index) => {
      seen.add(layer.id);
      let sprite = this.sprites.get(layer.id);
      if (!sprite) {
        const texture = this.getTexture(layer);
        sprite = new Sprite(texture);
        sprite.anchor.set(0);
        this.sprites.set(layer.id, sprite);
        this.docLayers.addChild(sprite);
      }
      this.applyLayer(sprite, layer);
      this.docLayers.setChildIndex(sprite, index);
    });

    // Drop sprites for removed layers.
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        this.docLayers.removeChild(sprite);
        sprite.destroy();
        this.sprites.delete(id);
      }
    }

    this.drawChecker(this.graph.getCanvasSize());
    this.drawOverlay();
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
    const existing = this.textures.get(layer.id);
    if (existing) return existing;
    // layer.source.bitmap is an HTMLImageElement or ImageBitmap (see file-io).
    const texture = Texture.from(layer.source.bitmap as HTMLImageElement);
    this.textures.set(layer.id, texture);
    return texture;
  }

  // ---- live drag preview (no graph mutation) ------------------------------

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

  // ---- hit testing --------------------------------------------------------

  /** Topmost visible layer id at a canvas-relative point, or null. */
  hitTest(canvasX: number, canvasY: number): string | null {
    if (!this.graph) return null;
    const global = new Point(canvasX, canvasY);
    const layers = this.graph.getLayersBottomUp();
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.visible || layer.locked) continue;
      const sprite = this.sprites.get(layer.id);
      if (!sprite) continue;
      const local = sprite.toLocal(global);
      if (
        local.x >= 0 &&
        local.y >= 0 &&
        local.x <= layer.source.width &&
        local.y <= layer.source.height
      ) {
        return layer.id;
      }
    }
    return null;
  }

  /** Convert a canvas-relative point to document coordinates. */
  screenToDocument(canvasX: number, canvasY: number): { x: number; y: number } {
    const p = this.viewport.toLocal(new Point(canvasX, canvasY));
    return { x: p.x, y: p.y };
  }

  // ---- export -------------------------------------------------------------

  /** Flatten the document layers (chrome-free) to a canvas at 1:1 resolution. */
  async extractCanvas(): Promise<HTMLCanvasElement> {
    if (!this.app || !this.graph) throw new Error("Renderer not ready");
    const size = this.graph.getCanvasSize();
    const prevView = { ...this.view };
    const prevPreview = new Map(this.previewOffset);
    // Reset viewport so document-local == world coords for a clean frame.
    this.previewOffset.clear();
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

    // Restore editor state.
    this.overlay.visible = overlayVisible;
    this.checker.visible = checkerVisible;
    this.previewOffset = prevPreview;
    this.setViewport(prevView);
    this.syncAll();
    return result;
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const t of this.textures.values()) t.destroy(true);
    this.textures.clear();
    this.sprites.clear();
    this.app?.destroy(true, { children: true });
    this.app = null;
  }
}
