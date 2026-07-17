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
import { HandleId, handlePositions, layerBounds } from "../tools/transform-math";
import type { SelectionRect } from "../file-io/clipboard";

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
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
  private overlay = new Graphics();
  private sprites = new Map<string, Sprite>();
  private textures = new Map<string, Texture>();
  private previewOffset = new Map<string, { dx: number; dy: number }>();
  private graph: LayerGraph | null = null;
  private unsubscribe: (() => void) | null = null;
  private view: ViewportState = { x: 0, y: 0, zoom: 1 };
  private showTransformHandles = false;
  private hostCanvas: HTMLCanvasElement | null = null;
  private selection: SelectionRect | null = null;

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

  setViewport(view: Partial<ViewportState>): void {
    this.view = { ...this.view, ...view };
    this.applyViewport();
    this.drawOverlay();
  }

  getViewport(): ViewportState {
    return { ...this.view };
  }

  private applyViewport(): void {
    this.viewport.position.set(this.view.x, this.view.y);
    this.viewport.scale.set(this.view.zoom);
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
        for (const pos of Object.values(positions)) {
          g.rect(pos.x - half, pos.y - half, half * 2, half * 2)
            .fill(0xffffff)
            .stroke({ width: strokeW, color: 0x6366f1 });
        }
      }
    }

    if (this.selection && this.selection.width > 0 && this.selection.height > 0) {
      const s = this.selection;
      g.rect(s.x, s.y, s.width, s.height)
        .fill({ color: 0x6366f1, alpha: 0.12 })
        .stroke({ width: 1 / this.view.zoom, color: 0xffffff, alpha: 0.9 });
    }
  }

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
    const texture = Texture.from(layer.source.bitmap as HTMLImageElement);
    this.textures.set(layer.id, texture);
    return texture;
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

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const t of this.textures.values()) t.destroy(true);
    this.textures.clear();
    this.sprites.clear();
    this.app?.destroy(true, { children: true });
    this.app = null;
    this.hostCanvas = null;
  }
}
