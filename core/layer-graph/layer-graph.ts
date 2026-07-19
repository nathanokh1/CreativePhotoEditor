import {
  CanvasSize,
  DocumentMeta,
  identityTransform,
  Layer,
  LayerGraphEvent,
  LayerGraphListener,
  RasterSource,
  Transform,
} from "./types";

let idCounter = 0;
function nextId(prefix = "layer"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

/**
 * The LayerGraph owns the ordered list of Layers, the active layer, canvas
 * dimensions and document metadata. It is pure data + methods — no rendering.
 *
 * IMPORTANT: UI handlers must never call these mutators directly. All mutations
 * flow through Commands (see /core/commands) so undo/redo stays authoritative.
 * The Command layer is the only intended caller of the mutating methods here.
 */
export class LayerGraph {
  private layers: Layer[] = [];
  private activeLayerId: string | null = null;
  private canvas: CanvasSize;
  private meta: DocumentMeta;
  private listeners = new Set<LayerGraphListener>();

  constructor(canvas: CanvasSize = { width: 1280, height: 720 }, name = "Untitled") {
    this.canvas = { ...canvas };
    const now = Date.now();
    this.meta = { name, createdAt: now, modifiedAt: now };
  }

  // ---- subscription -------------------------------------------------------

  subscribe(listener: LayerGraphListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: LayerGraphEvent): void {
    this.meta.modifiedAt = Date.now();
    for (const l of this.listeners) l(event);
  }

  // ---- reads --------------------------------------------------------------

  getLayers(): readonly Layer[] {
    return this.layers;
  }

  /** Layers in paint order (bottom first). z-order === array order. */
  getLayersBottomUp(): readonly Layer[] {
    return this.layers;
  }

  getLayer(id: string): Layer | undefined {
    return this.layers.find((l) => l.id === id);
  }

  getActiveLayerId(): string | null {
    return this.activeLayerId;
  }

  getActiveLayer(): Layer | undefined {
    return this.activeLayerId ? this.getLayer(this.activeLayerId) : undefined;
  }

  getCanvasSize(): CanvasSize {
    return { ...this.canvas };
  }

  getMeta(): DocumentMeta {
    return { ...this.meta };
  }

  // ---- mutators (Command-only callers) -----------------------------------

  createRasterLayer(name: string, source: RasterSource, transform?: Partial<Transform>): Layer {
    const layer: Layer = {
      id: nextId(),
      name,
      type: "raster",
      transform: { ...identityTransform(), ...transform },
      opacity: 1,
      blendMode: "normal",
      visible: true,
      locked: false,
      source,
    };
    return layer;
  }

  /** Folder-style group — no pixels; children keep painting in the flat stack. */
  createGroupLayer(name: string, childIds: string[], source: RasterSource): Layer {
    return {
      id: nextId("group"),
      name,
      type: "group",
      transform: identityTransform(),
      opacity: 1,
      blendMode: "normal",
      visible: true,
      locked: false,
      source,
      childIds: [...childIds],
    };
  }

  addLayer(layer: Layer, index?: number): void {
    const at = index === undefined ? this.layers.length : index;
    this.layers.splice(at, 0, layer);
    this.activeLayerId = layer.id;
    this.emit({ type: "layer-added", layerId: layer.id });
    this.emit({ type: "active-changed", layerId: layer.id });
  }

  removeLayer(id: string): Layer | undefined {
    const idx = this.layers.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    const [removed] = this.layers.splice(idx, 1);
    if (this.activeLayerId === id) {
      const next = this.layers[idx] ?? this.layers[idx - 1] ?? null;
      this.activeLayerId = next ? next.id : null;
      this.emit({ type: "active-changed", layerId: this.activeLayerId });
    }
    this.emit({ type: "layer-removed", layerId: id });
    return removed;
  }

  /** Returns the current index of a layer (or -1). */
  indexOf(id: string): number {
    return this.layers.findIndex((l) => l.id === id);
  }

  moveLayer(id: string, toIndex: number): void {
    const from = this.indexOf(id);
    if (from === -1) return;
    const [layer] = this.layers.splice(from, 1);
    const clamped = Math.max(0, Math.min(toIndex, this.layers.length));
    this.layers.splice(clamped, 0, layer);
    this.emit({ type: "layer-reordered" });
  }

  setActiveLayer(id: string | null): void {
    if (id !== null && !this.getLayer(id)) return;
    this.activeLayerId = id;
    this.emit({ type: "active-changed", layerId: id });
  }

  updateLayer(id: string, patch: Partial<Omit<Layer, "id" | "type" | "source">>): void {
    const layer = this.getLayer(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.emit({ type: "layer-updated", layerId: id });
  }

  setTransform(id: string, transform: Transform): void {
    const layer = this.getLayer(id);
    if (!layer) return;
    layer.transform = { ...transform };
    this.emit({ type: "layer-updated", layerId: id });
  }

  translate(id: string, dx: number, dy: number): void {
    const layer = this.getLayer(id);
    if (!layer) return;
    layer.transform.x += dx;
    layer.transform.y += dy;
    this.emit({ type: "layer-updated", layerId: id });
  }

  setCanvasSize(size: CanvasSize): void {
    this.canvas = { ...size };
    this.emit({ type: "canvas-resized" });
  }

  setName(name: string): void {
    this.meta.name = name;
    this.emit({ type: "layer-updated", layerId: "" });
  }

  setBackground(background: DocumentMeta["background"]): void {
    this.meta.background = background;
    this.emit({ type: "canvas-resized" });
  }

  replaceLayerSource(id: string, source: RasterSource): void {
    const layer = this.getLayer(id);
    if (!layer) return;
    layer.source = source;
    this.emit({ type: "layer-updated", layerId: id });
  }

  /** Replace the entire graph (used by project load). */
  replaceWith(layers: Layer[], canvas: CanvasSize, meta: DocumentMeta): void {
    this.layers = layers;
    this.canvas = { ...canvas };
    this.meta = { ...meta };
    this.activeLayerId = layers.length ? layers[layers.length - 1].id : null;
    this.emit({ type: "graph-replaced" });
  }
}
