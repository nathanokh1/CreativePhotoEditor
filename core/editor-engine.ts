import {
  AddLayerCommand,
  CommandBus,
  DeleteLayerCommand,
  GroupLayersCommand,
  History,
  MoveLayerCommand,
  ReorderLayerCommand,
  ReplaceLayerSourceCommand,
  SetCanvasSizeCommand,
  SetLayerMaskCommand,
  SetLayerPropsCommand,
  SetLayersPropsCommand,
  SetTransformCommand,
  UngroupLayersCommand,
  UpdateTextLayerCommand,
} from "./commands";
import {
  BlendMode,
  CanvasSize,
  LayerGraph,
  RasterSource,
} from "./layer-graph";
import { Renderer } from "./render";
import {
  ExportFormat,
  ClipboardPayload,
  SelectionRect,
  AdjustmentOptions,
  DetectedRegion,
  FilterKind,
  applyAdjustments,
  applyFilter,
  canvasToSource,
  DEFAULT_TEXT_STYLE,
  clearRectOnSource,
  cloneLayerSource,
  cropRegion,
  detectRegions,
  downloadBlob,
  flattenToBlob,
  trimCanvas,
  scaleCanvas,
  fillBackground,
  gridRegions,
  isSupportedImage,
  loadImageAsSource,
  loadProject,
  renderTextSource,
  saveProject,
  sourceToCanvas,
  StrokeStyle,
  createEmptyMask,
  invertMask,
  maskBounds,
  maskIsEmpty,
  buildPath2D,
  penPathToMask,
  type SelectionMask,
} from "./file-io";
import { PointerSample, ToolContext, ToolId, ToolManager, WandStyle } from "./tools";

export interface PenApplyOptions {
  stroke: boolean;
  strokeColor: string;
  strokeWidth: number;
  fill: boolean;
  fillColor: string;
}

export interface ImportOptions {
  fitCanvasToImage?: boolean;
}

export interface ExportOptions {
  quality?: number;
  scale?: number;
  /** CSS color to paint behind the image, or "transparent" to keep alpha. */
  background?: string;
}

export interface ExportLayersOptions extends ExportOptions {
  /** Only export layers that are currently visible. */
  visibleOnly?: boolean;
  /** Crop each exported layer to the bounds of its own content. */
  trimToContent?: boolean;
}

export interface TextLayerPatch {
  text?: string;
  fontSize?: number;
  fillColor?: string;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

export interface NewDocumentOptions {
  name?: string;
  width: number;
  height: number;
  background?: "transparent" | string;
}

function hexToRgbLocal(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function transparentSource(width: number, height: number): Promise<RasterSource> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  return canvasToSource(canvas);
}

/**
 * The framework-agnostic orchestrator. Owns the Document (LayerGraph), the
 * Command/History system, the Tool manager and a reference to the Renderer.
 */
export class EditorEngine {
  readonly graph: LayerGraph;
  readonly history: History;
  readonly bus: CommandBus;
  private renderer: Renderer | null = null;
  private tools: ToolManager | null = null;
  private clipboard: ClipboardPayload | null = null;

  constructor(canvas: CanvasSize = { width: 1280, height: 720 }, name = "Untitled") {
    this.graph = new LayerGraph(canvas, name);
    this.history = new History(100);
    this.bus = new CommandBus(this.graph, this.history);
  }

  /**
   * Bind this engine to a (possibly shared) renderer. Re-points the renderer at
   * this engine's graph. Tools are created once and reused so switching between
   * documents on one canvas keeps a stable tool set. The caller decides the
   * viewport (fit vs. restore) after attaching.
   */
  attachRenderer(renderer: Renderer): void {
    this.renderer = renderer;
    renderer.attachGraph(this.graph);
    if (!this.tools) {
      this.tools = new ToolManager({ graph: this.graph, bus: this.bus, renderer });
    }
  }

  getRenderer(): Renderer | null {
    return this.renderer;
  }

  getTools(): ToolManager {
    if (!this.tools) throw new Error("Tools require an attached renderer");
    return this.tools;
  }

  setTool(id: ToolId): void {
    this.tools?.setActive(id);
  }

  setLockAspect(lock: boolean): void {
    this.tools?.setLockAspect(lock);
  }

  setPaintStyle(patch: Partial<StrokeStyle>): void {
    this.tools?.setPaintStyle(patch);
  }

  getPaintStyle(): StrokeStyle | null {
    return this.tools?.getPaintStyle() ?? null;
  }

  setWandStyle(patch: Partial<WandStyle>): void {
    this.tools?.setWandStyle(patch);
  }

  getWandStyle(): WandStyle | null {
    return this.tools?.getWandStyle() ?? null;
  }

  // ---- pixel selection (magic wand mask) ----------------------------------

  hasSelectionMask(): boolean {
    return this.renderer?.hasSelectionMask() ?? false;
  }

  deselect(): void {
    this.renderer?.setSelectionMask(null);
  }

  selectAll(): void {
    if (!this.renderer) return;
    const { width, height } = this.graph.getCanvasSize();
    const mask = createEmptyMask(width, height);
    mask.data.fill(255);
    this.renderer.setSelectionMask(mask);
  }

  invertSelection(): void {
    if (!this.renderer) return;
    const { width, height } = this.graph.getCanvasSize();
    const existing = this.renderer.getSelectionMask();
    if (!existing) {
      this.selectAll();
      return;
    }
    // Re-fit to the current canvas size, then invert.
    const mask =
      existing.width === width && existing.height === height
        ? { ...existing, data: Uint8Array.from(existing.data) }
        : createEmptyMask(width, height);
    invertMask(mask);
    this.renderer.setSelectionMask(maskIsEmpty(mask) ? null : mask);
  }

  /** Delete the selected pixels from the active layer (respects feather). */
  async deleteSelectionContents(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    const mask = this.renderer?.getSelectionMask();
    if (!layer || layer.type === "group" || !mask || maskIsEmpty(mask)) return false;
    const canvas = sourceToCanvas(layer.source);
    this.eraseThroughMask(canvas, layer.transform, mask);
    const source = await canvasToSource(canvas);
    this.bus.dispatch(new ReplaceLayerSourceCommand(layer.id, source, "Delete selection"));
    return true;
  }

  /** Fill the selected pixels of the active layer with a solid color. */
  async fillSelection(color: string): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    const mask = this.renderer?.getSelectionMask();
    if (!layer || layer.type === "group" || !mask || maskIsEmpty(mask)) return false;
    const canvas = sourceToCanvas(layer.source);
    this.fillThroughMask(canvas, layer.transform, mask, color);
    const source = await canvasToSource(canvas);
    this.bus.dispatch(new ReplaceLayerSourceCommand(layer.id, source, "Fill selection"));
    return true;
  }

  /** Map a doc-space mask onto layer-local pixels and multiply out alpha. */
  private eraseThroughMask(
    canvas: HTMLCanvasElement,
    t: { x: number; y: number; scaleX: number; scaleY: number },
    mask: SelectionMask,
  ): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let ly = 0; ly < canvas.height; ly++) {
      for (let lx = 0; lx < canvas.width; lx++) {
        const dx = Math.round(t.x + lx * t.scaleX);
        const dy = Math.round(t.y + ly * t.scaleY);
        if (dx < 0 || dy < 0 || dx >= mask.width || dy >= mask.height) continue;
        const cov = mask.data[dy * mask.width + dx];
        if (cov === 0) continue;
        const i = (ly * canvas.width + lx) * 4;
        d[i + 3] = Math.round((d[i + 3] * (255 - cov)) / 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  private fillThroughMask(
    canvas: HTMLCanvasElement,
    t: { x: number; y: number; scaleX: number; scaleY: number },
    mask: SelectionMask,
    color: string,
  ): void {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const fill = hexToRgbLocal(color);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    for (let ly = 0; ly < canvas.height; ly++) {
      for (let lx = 0; lx < canvas.width; lx++) {
        const dx = Math.round(t.x + lx * t.scaleX);
        const dy = Math.round(t.y + ly * t.scaleY);
        if (dx < 0 || dy < 0 || dx >= mask.width || dy >= mask.height) continue;
        const cov = mask.data[dy * mask.width + dx] / 255;
        if (cov === 0) continue;
        const i = (ly * canvas.width + lx) * 4;
        d[i] = Math.round(d[i] * (1 - cov) + fill.r * cov);
        d[i + 1] = Math.round(d[i + 1] * (1 - cov) + fill.g * cov);
        d[i + 2] = Math.round(d[i + 2] * (1 - cov) + fill.b * cov);
        d[i + 3] = Math.max(d[i + 3], Math.round(255 * cov));
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---- layer masks ---------------------------------------------------------

  hasLayerMask(): boolean {
    const layer = this.graph.getActiveLayer();
    return !!layer && !!layer.mask;
  }

  /** Add a mask to the active layer: reveal-all, hide-all, or from the selection. */
  async addLayerMask(mode: "reveal" | "hide" | "selection" = "reveal"): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer || layer.type === "group") return false;
    const selection = mode === "selection" ? this.renderer?.getSelectionMask() ?? null : null;
    const canvas = this.buildMaskCanvas(layer, mode, selection);
    const source = await canvasToSource(canvas);
    this.bus.dispatch(new SetLayerMaskCommand(layer.id, source, "Add mask"));
    if (selection) this.renderer?.setSelectionMask(null);
    return true;
  }

  removeLayerMask(): boolean {
    const layer = this.graph.getActiveLayer();
    if (!layer || !layer.mask) return false;
    this.setMaskEditTarget(null);
    this.bus.dispatch(new SetLayerMaskCommand(layer.id, null, "Delete mask"));
    return true;
  }

  /** Bake the mask into the layer pixels, then drop the mask. */
  async applyLayerMask(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer || !layer.mask) return false;
    const canvas = sourceToCanvas(layer.source);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(layer.mask.bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-over";
    }
    const source = await canvasToSource(canvas);
    this.setMaskEditTarget(null);
    this.bus.dispatch(new ReplaceLayerSourceCommand(layer.id, source, "Apply mask"));
    this.bus.dispatch(new SetLayerMaskCommand(layer.id, null, "Apply mask"));
    return true;
  }

  setMaskEnabled(enabled: boolean): void {
    const layer = this.graph.getActiveLayer();
    if (!layer || !layer.mask) return;
    this.bus.dispatch(
      new SetLayerPropsCommand(layer.id, { maskEnabled: enabled }, enabled ? "Enable mask" : "Disable mask"),
    );
  }

  setClip(clip: boolean): void {
    const layer = this.graph.getActiveLayer();
    if (!layer || layer.type === "group") return;
    this.bus.dispatch(
      new SetLayerPropsCommand(layer.id, { clip }, clip ? "Create clipping mask" : "Release clipping mask"),
    );
  }

  /** Route paint/eraser strokes onto a layer's mask instead of its pixels. */
  setMaskEditTarget(layerId: string | null): void {
    this.tools?.setMaskEditTarget(layerId);
  }

  getMaskEditTarget(): string | null {
    return this.tools?.getMaskEditTarget() ?? null;
  }

  private buildMaskCanvas(
    layer: { source: RasterSource; transform: { x: number; y: number; scaleX: number; scaleY: number } },
    mode: "reveal" | "hide" | "selection",
    selection: SelectionMask | null,
  ): HTMLCanvasElement {
    const w = layer.source.width;
    const h = layer.source.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    if (mode === "selection" && selection) {
      const t = layer.transform;
      for (let ly = 0; ly < h; ly++) {
        for (let lx = 0; lx < w; lx++) {
          const dx = Math.round(t.x + lx * t.scaleX);
          const dy = Math.round(t.y + ly * t.scaleY);
          const inBounds = dx >= 0 && dy >= 0 && dx < selection.width && dy < selection.height;
          const cov = inBounds ? selection.data[dy * selection.width + dx] : 0;
          const i = (ly * w + lx) * 4;
          d[i] = 255;
          d[i + 1] = 255;
          d[i + 2] = 255;
          d[i + 3] = cov;
        }
      }
    } else {
      const a = mode === "hide" ? 0 : 255;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
        d[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  // ---- pen tool ------------------------------------------------------------

  private toolCtx(): ToolContext | null {
    if (!this.renderer) return null;
    return { graph: this.graph, bus: this.bus, renderer: this.renderer };
  }

  penInfo(): { hasPath: boolean; closed: boolean } {
    const path = this.tools?.getPenTool().getPath();
    return { hasPath: !!path, closed: !!path?.closed };
  }

  closePenPath(): void {
    const ctx = this.toolCtx();
    if (ctx) this.tools?.getPenTool().close(ctx);
  }

  clearPenPath(): void {
    const ctx = this.toolCtx();
    this.tools?.getPenTool().reset(ctx ?? undefined);
  }

  /** Stroke and/or fill the current pen path onto a new raster layer. */
  async rasterizePenPath(opts: PenApplyOptions): Promise<boolean> {
    const pen = this.tools?.getPenTool();
    const path = pen?.getPath();
    if (!path) return false;
    const { width, height } = this.graph.getCanvasSize();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const p2d = buildPath2D(path);
    if (opts.fill) {
      ctx.fillStyle = opts.fillColor;
      ctx.fill(p2d);
    }
    if (opts.stroke && opts.strokeWidth > 0) {
      ctx.strokeStyle = opts.strokeColor;
      ctx.lineWidth = opts.strokeWidth;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(p2d);
    }
    const source = await canvasToSource(canvas);
    const layer = this.graph.createRasterLayer("Path", source, { x: 0, y: 0 });
    this.bus.dispatch(new AddLayerCommand(layer));
    this.clearPenPath();
    return true;
  }

  /** Convert the current pen path into a pixel selection. */
  penPathToSelection(): boolean {
    const pen = this.tools?.getPenTool();
    const path = pen?.getPath();
    if (!path || !this.renderer) return false;
    const { width, height } = this.graph.getCanvasSize();
    const mask = penPathToMask(width, height, path);
    this.renderer.setSelectionMask(mask);
    this.clearPenPath();
    return true;
  }

  setShowGuides(show: boolean): void {
    this.renderer?.setShowGuides(show);
  }

  pointerDown(pt: PointerSample): void {
    this.tools?.pointerDown(pt);
  }

  pointerMove(pt: PointerSample): void {
    this.tools?.pointerMove(pt);
  }

  pointerUp(pt: PointerSample): void {
    this.tools?.pointerUp(pt);
  }

  zoomAt(canvasX: number, canvasY: number, factor: number): void {
    if (!this.renderer) return;
    const v = this.renderer.getViewport();
    const newZoom = Math.max(0.05, Math.min(32, v.zoom * factor));
    const wx = (canvasX - v.x) / v.zoom;
    const wy = (canvasY - v.y) / v.zoom;
    this.renderer.setViewport({
      zoom: newZoom,
      x: canvasX - wx * newZoom,
      y: canvasY - wy * newZoom,
    });
  }

  fitToView(): void {
    this.renderer?.fitToView();
  }

  undo(): void {
    this.bus.undo();
  }

  redo(): void {
    this.bus.redo();
  }

  async newDocument(opts: NewDocumentOptions): Promise<void> {
    const meta = {
      name: opts.name || "Untitled",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      background: opts.background ?? "transparent",
    };
    this.graph.replaceWith([], { width: opts.width, height: opts.height }, meta);
    this.history.clear();
    this.renderer?.fitToView();
  }

  async importFile(file: File, options: ImportOptions = {}): Promise<void> {
    if (!isSupportedImage(file)) throw new Error(`Unsupported file: ${file.name}`);
    const source = await loadImageAsSource(file);
    const name = file.name.replace(/\.[^.]+$/, "") || "Layer";
    const isFirst = this.graph.getLayersBottomUp().length === 0;
    const fit = options.fitCanvasToImage !== false && isFirst;

    if (fit) {
      this.bus.dispatch(new SetCanvasSizeCommand({ width: source.width, height: source.height }));
      const layer = this.graph.createRasterLayer(name, source, { x: 0, y: 0 });
      this.bus.dispatch(new AddLayerCommand(layer));
      this.renderer?.fitToView();
      return;
    }

    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(name, source, {
      x: Math.round((canvas.width - source.width) / 2),
      y: Math.round((canvas.height - source.height) / 2),
    });
    this.bus.dispatch(new AddLayerCommand(layer));
  }

  async addEmptyLayer(name = "Layer"): Promise<void> {
    const size = this.graph.getCanvasSize();
    const source = await transparentSource(size.width, size.height);
    const layer = this.graph.createRasterLayer(name, source, { x: 0, y: 0 });
    this.bus.dispatch(new AddLayerCommand(layer));
  }

  async addTextLayer(text = "Text"): Promise<void> {
    const style = { ...DEFAULT_TEXT_STYLE };
    const source = await renderTextSource(text, style);
    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(text, source, {
      x: Math.round((canvas.width - source.width) / 2),
      y: Math.round((canvas.height - source.height) / 2),
    });
    layer.type = "text";
    layer.text = text;
    layer.fontSize = style.fontSize;
    layer.fontFamily = style.fontFamily;
    layer.fillColor = style.fillColor;
    layer.bold = style.bold;
    layer.italic = style.italic;
    layer.align = style.align;
    layer.strokeColor = style.strokeColor;
    layer.strokeWidth = style.strokeWidth;
    layer.shadowColor = style.shadowColor;
    layer.shadowBlur = style.shadowBlur;
    this.bus.dispatch(new AddLayerCommand(layer));
  }

  async updateTextLayer(id: string, patch: TextLayerPatch): Promise<void> {
    const layer = this.graph.getLayer(id);
    if (!layer || layer.type !== "text") return;
    const text = patch.text ?? layer.text ?? "Text";
    const fontSize = patch.fontSize ?? layer.fontSize ?? DEFAULT_TEXT_STYLE.fontSize;
    const fontFamily = patch.fontFamily ?? layer.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily;
    const fillColor = patch.fillColor ?? layer.fillColor ?? DEFAULT_TEXT_STYLE.fillColor;
    const bold = patch.bold ?? layer.bold ?? false;
    const italic = patch.italic ?? layer.italic ?? false;
    const align = patch.align ?? layer.align ?? "left";
    const strokeColor = patch.strokeColor ?? layer.strokeColor ?? "";
    const strokeWidth = patch.strokeWidth ?? layer.strokeWidth ?? 0;
    const shadowColor = patch.shadowColor ?? layer.shadowColor ?? "";
    const shadowBlur = patch.shadowBlur ?? layer.shadowBlur ?? 0;
    const source = await renderTextSource(text, {
      fontSize,
      fontFamily,
      fillColor,
      bold,
      italic,
      align,
      strokeColor,
      strokeWidth,
      shadowColor,
      shadowBlur,
    });
    // Keep the layer visually anchored at its current top-left while the bitmap resizes.
    this.bus.dispatch(
      new UpdateTextLayerCommand(id, {
        source,
        text,
        fontSize,
        fontFamily,
        fillColor,
        bold,
        italic,
        align,
        strokeColor,
        strokeWidth,
        shadowColor,
        shadowBlur,
        name: text.split("\n")[0].slice(0, 40) || "Text",
      }),
    );
    this.renderer?.invalidateLayer(id);
  }

  async addShapeLayer(kind: "rect" | "ellipse", color = "#6366f1"): Promise<void> {
    const size = 200;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d")!;
    ctx.fillStyle = color;
    if (kind === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2, size / 2 - 2, size / 2 - 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, size, size);
    }
    const source = await canvasToSource(canvasEl);
    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(kind === "ellipse" ? "Ellipse" : "Rectangle", source, {
      x: Math.round((canvas.width - size) / 2),
      y: Math.round((canvas.height - size) / 2),
    });
    this.bus.dispatch(new AddLayerCommand(layer));
  }

  fitCanvasToLayer(layerId: string): void {
    const layer = this.graph.getLayer(layerId);
    if (!layer) return;
    const w = Math.max(1, Math.round(layer.source.width * layer.transform.scaleX));
    const h = Math.max(1, Math.round(layer.source.height * layer.transform.scaleY));
    const pinned = { ...layer.transform, x: 0, y: 0 };
    this.bus.dispatch(new SetCanvasSizeCommand({ width: w, height: h }));
    this.bus.dispatch(new SetTransformCommand(layerId, pinned));
    this.renderer?.fitToView();
  }

  deleteLayer(id: string): void {
    const layer = this.graph.getLayer(id);
    if (layer?.type === "group") {
      this.bus.dispatch(new UngroupLayersCommand(id));
      return;
    }
    this.bus.dispatch(new DeleteLayerCommand(id));
  }

  async duplicateLayer(id: string): Promise<void> {
    const layer = this.graph.getLayer(id);
    if (!layer || layer.type === "group") return;
    const payload = await cloneLayerSource(layer);
    const copy = this.graph.createRasterLayer(`${layer.name} copy`, payload.source, {
      ...layer.transform,
      x: layer.transform.x + 16,
      y: layer.transform.y + 16,
    });
    copy.opacity = layer.opacity;
    copy.blendMode = layer.blendMode;
    copy.visible = layer.visible;
    copy.type = layer.type;
    if (layer.type === "text") {
      copy.text = layer.text;
      copy.fontSize = layer.fontSize;
      copy.fontFamily = layer.fontFamily;
      copy.fillColor = layer.fillColor;
      copy.bold = layer.bold;
      copy.italic = layer.italic;
      copy.align = layer.align;
      copy.strokeColor = layer.strokeColor;
      copy.strokeWidth = layer.strokeWidth;
      copy.shadowColor = layer.shadowColor;
      copy.shadowBlur = layer.shadowBlur;
    }
    this.bus.dispatch(new AddLayerCommand(copy));
  }

  /** Group the given layer ids under a new folder layer. */
  async groupLayers(childIds: string[]): Promise<void> {
    const ids = [...new Set(childIds)].filter((id) => {
      const layer = this.graph.getLayer(id);
      return layer && layer.type !== "group";
    });
    if (ids.length < 1) return;
    const placeholder = await transparentSource(1, 1);
    const group = this.graph.createGroupLayer("Group", ids, placeholder);
    this.bus.dispatch(new GroupLayersCommand(group, ids));
  }

  ungroupLayer(groupId: string): void {
    this.bus.dispatch(new UngroupLayersCommand(groupId));
  }

  reorderLayer(id: string, toIndex: number): void {
    this.bus.dispatch(new ReorderLayerCommand(id, toIndex));
  }

  setActiveLayer(id: string): void {
    this.graph.setActiveLayer(id);
  }

  setLayerOpacity(id: string, opacity: number): void {
    this.bus.dispatch(new SetLayerPropsCommand(id, { opacity }, "Change opacity"));
  }

  setLayerVisibility(id: string, visible: boolean): void {
    const ids = this.groupTargets(id);
    const label = visible ? "Show layer" : "Hide layer";
    if (ids.length > 1) {
      this.bus.dispatch(new SetLayersPropsCommand(ids, { visible }, label));
    } else {
      this.bus.dispatch(new SetLayerPropsCommand(id, { visible }, label));
    }
  }

  /** A layer id plus its children if it's a group (for cascading eye/lock). */
  private groupTargets(id: string): string[] {
    const layer = this.graph.getLayer(id);
    if (!layer || layer.type !== "group") return [id];
    const children = this.graph
      .getLayersBottomUp()
      .filter((l) => l.parentId === id)
      .map((l) => l.id);
    return [id, ...children];
  }

  setLayerBlendMode(id: string, blendMode: BlendMode): void {
    this.bus.dispatch(new SetLayerPropsCommand(id, { blendMode }, "Change blend mode"));
  }

  renameLayer(id: string, name: string): void {
    this.bus.dispatch(new SetLayerPropsCommand(id, { name }, "Rename layer"));
  }

  setLayerLocked(id: string, locked: boolean): void {
    const ids = this.groupTargets(id);
    const label = locked ? "Lock layer" : "Unlock layer";
    if (ids.length > 1) {
      this.bus.dispatch(new SetLayersPropsCommand(ids, { locked }, label));
    } else {
      this.bus.dispatch(new SetLayerPropsCommand(id, { locked }, label));
    }
  }

  nudgeActiveLayer(dx: number, dy: number): void {
    const id = this.graph.getActiveLayerId();
    if (!id) return;
    const layer = this.graph.getLayer(id);
    if (!layer || layer.locked) return;
    this.bus.dispatch(new MoveLayerCommand(id, dx, dy));
  }

  async applyLayerAdjustments(id: string, opts: AdjustmentOptions): Promise<void> {
    const layer = this.graph.getLayer(id);
    if (!layer || layer.type === "group") return;
    const canvas = sourceToCanvas(layer.source);
    applyAdjustments(canvas, opts);
    const source = await canvasToSource(canvas);
    this.bus.dispatch(new ReplaceLayerSourceCommand(id, source, "Adjustments"));
  }

  async applyLayerFilter(id: string, kind: FilterKind): Promise<void> {
    const layer = this.graph.getLayer(id);
    if (!layer || layer.type === "group") return;
    const canvas = sourceToCanvas(layer.source);
    applyFilter(canvas, kind);
    const source = await canvasToSource(canvas);
    const label = `Filter: ${kind}`;
    this.bus.dispatch(new ReplaceLayerSourceCommand(id, source, label));
  }

  /**
   * Split the active layer into per-region layers.
   * "regions" auto-detects bordered blobs; "grid" cuts an even rows×cols grid.
   * Returns the number of layers created.
   */
  async autoLayersFromActive(opts: {
    mode: "regions" | "grid";
    rows?: number;
    cols?: number;
    hideSource?: boolean;
    threshold?: number;
    group?: boolean;
    separation?: number;
    split?: boolean;
  }): Promise<number> {
    const layer = this.graph.getActiveLayer();
    if (!layer || layer.type === "group") return 0;

    let regions: DetectedRegion[];
    if (opts.mode === "grid") {
      regions = gridRegions(
        layer.source.width,
        layer.source.height,
        Math.max(1, opts.rows ?? 2),
        Math.max(1, opts.cols ?? 2),
      );
    } else {
      regions = detectRegions(layer.source, {
        threshold: opts.threshold,
        separation: opts.separation,
        split: opts.split,
      });
    }
    if (regions.length === 0) return 0;

    const baseX = layer.transform.x;
    const baseY = layer.transform.y;
    const sx = layer.transform.scaleX;
    const sy = layer.transform.scaleY;
    const created: string[] = [];

    for (let i = 0; i < regions.length; i++) {
      const region = regions[i];
      const cropped = cropRegion(layer.source, region);
      const source = await canvasToSource(cropped);
      const newLayer = this.graph.createRasterLayer(`Region ${i + 1}`, source, {
        x: baseX + region.x * sx,
        y: baseY + region.y * sy,
        scaleX: sx,
        scaleY: sy,
        rotation: layer.transform.rotation,
      });
      this.bus.dispatch(new AddLayerCommand(newLayer));
      created.push(newLayer.id);
    }

    if (opts.hideSource !== false) {
      this.bus.dispatch(new SetLayerPropsCommand(layer.id, { visible: false }, "Hide source"));
    }
    if (opts.group && created.length > 1) {
      const placeholder = await transparentSource(1, 1);
      const group = this.graph.createGroupLayer("Sliced layers", created, placeholder);
      this.bus.dispatch(new GroupLayersCommand(group, created));
    }
    return created.length;
  }

  // ---- clipboard ----------------------------------------------------------

  async copy(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer || layer.type === "group") return false;
    // Pixel selection (magic wand) takes priority when present.
    const mask = this.renderer?.getSelectionMask();
    if (mask && !maskIsEmpty(mask)) {
      const payload = await this.copyThroughMask(layer.id, layer.name, mask);
      if (payload) {
        this.clipboard = payload;
        return true;
      }
    }
    const selection = this.renderer?.getSelection();
    if (selection && selection.width > 1 && selection.height > 1) {
      const cropped = await this.copyRectFromDoc(layer.id, layer.name, selection);
      if (!cropped) return false;
      this.clipboard = cropped;
      return true;
    }
    // Whole layer: keep the original pixels but remember the current transform,
    // opacity and blend so paste reproduces it exactly as it looks now.
    const clone = await cloneLayerSource(layer);
    this.clipboard = {
      ...clone,
      scaleX: layer.transform.scaleX,
      scaleY: layer.transform.scaleY,
      rotation: layer.transform.rotation,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
    };
    return true;
  }

  /** Crop a doc-space selection from the layer as it's rendered (transform baked in). */
  private async copyRectFromDoc(
    layerId: string,
    name: string,
    sel: SelectionRect,
  ): Promise<ClipboardPayload | null> {
    if (!this.renderer) return null;
    const doc = await this.renderer.extractLayerCanvas(layerId);
    const x = Math.max(0, Math.floor(sel.x));
    const y = Math.max(0, Math.floor(sel.y));
    const wsel = Math.min(doc.width - x, Math.round(sel.width));
    const hsel = Math.min(doc.height - y, Math.round(sel.height));
    if (wsel <= 0 || hsel <= 0) return null;
    const out = document.createElement("canvas");
    out.width = wsel;
    out.height = hsel;
    const octx = out.getContext("2d");
    if (!octx) return null;
    octx.drawImage(doc, x, y, wsel, hsel, 0, 0, wsel, hsel);
    return { name: `${name} copy`, source: await canvasToSource(out) };
  }

  /** Crop the active layer to a mask (doc-space render → mask alpha → bbox). */
  private async copyThroughMask(
    layerId: string,
    name: string,
    mask: SelectionMask,
  ): Promise<ClipboardPayload | null> {
    if (!this.renderer) return null;
    const bounds = maskBounds(mask);
    if (!bounds) return null;
    const docCanvas = await this.renderer.extractLayerCanvas(layerId);
    const out = document.createElement("canvas");
    out.width = bounds.width;
    out.height = bounds.height;
    const octx = out.getContext("2d", { willReadFrequently: true });
    if (!octx) return null;
    octx.drawImage(docCanvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    const img = octx.getImageData(0, 0, bounds.width, bounds.height);
    const d = img.data;
    for (let y = 0; y < bounds.height; y++) {
      for (let x = 0; x < bounds.width; x++) {
        const cov = mask.data[(bounds.y + y) * mask.width + (bounds.x + x)];
        const i = (y * bounds.width + x) * 4;
        d[i + 3] = Math.round((d[i + 3] * cov) / 255);
      }
    }
    octx.putImageData(img, 0, 0);
    return { name: `${name} copy`, source: await canvasToSource(out) };
  }

  async cut(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer || layer.type === "group") return false;
    const mask = this.renderer?.getSelectionMask();
    const selection = this.renderer?.getSelection();
    const ok = await this.copy();
    if (!ok) return false;

    if (mask && !maskIsEmpty(mask)) {
      const canvas = sourceToCanvas(layer.source);
      this.eraseThroughMask(canvas, layer.transform, mask);
      const source = await canvasToSource(canvas);
      this.bus.dispatch(new ReplaceLayerSourceCommand(layer.id, source, "Cut selection"));
      return true;
    }

    if (selection && selection.width >= 2 && selection.height >= 2) {
      // Clear the selected region from the active layer (destructive cut).
      const t = layer.transform;
      const sx = Math.max(0, Math.floor((selection.x - t.x) / t.scaleX));
      const sy = Math.max(0, Math.floor((selection.y - t.y) / t.scaleY));
      const sw = Math.ceil(selection.width / t.scaleX);
      const sh = Math.ceil(selection.height / t.scaleY);
      const cleared = clearRectOnSource(layer.source, sx, sy, sw, sh);
      const source = await canvasToSource(cleared);
      this.bus.dispatch(new ReplaceLayerSourceCommand(layer.id, source, "Cut selection"));
    } else {
      this.bus.dispatch(new DeleteLayerCommand(layer.id));
    }
    this.renderer?.setSelection(null);
    return true;
  }

  paste(): boolean {
    if (!this.clipboard) return false;
    const c = this.clipboard;
    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(c.name, c.source, {
      x: Math.round((canvas.width - c.source.width) / 2) + 16,
      y: Math.round((canvas.height - c.source.height) / 2) + 16,
      scaleX: c.scaleX ?? 1,
      scaleY: c.scaleY ?? 1,
      rotation: c.rotation ?? 0,
    });
    if (c.opacity != null) layer.opacity = c.opacity;
    if (c.blendMode) layer.blendMode = c.blendMode;
    this.bus.dispatch(new AddLayerCommand(layer));
    return true;
  }

  async pasteFromSystemClipboard(): Promise<boolean> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        const file = new File([blob], "clipboard.png", { type });
        await this.importFile(file, { fitCanvasToImage: false });
        return true;
      }
    } catch {
      // Permissions or empty clipboard — ignore.
    }
    return false;
  }

  clearSelection(): void {
    this.renderer?.setSelection(null);
    this.renderer?.setSelectionMask(null);
  }

  async exportAs(format: ExportFormat, options: ExportOptions = {}): Promise<void> {
    if (!this.renderer) throw new Error("Renderer not ready");
    const blob = await flattenToBlob(this.renderer, format, {
      quality: options.quality ?? 0.92,
      scale: options.scale ?? 1,
      background: options.background,
    });
    const name = this.graph.getMeta().name || "export";
    downloadBlob(blob, `${name}.${format === "jpeg" ? "jpg" : format}`);
  }

  /**
   * Export each layer as its own image file, packaged into a single .zip.
   * Groups are skipped; their child layers export individually. Each layer is
   * rendered on a document-sized transparent canvas so positions line up.
   */
  async exportLayersBatch(
    format: ExportFormat,
    options: ExportLayersOptions = {},
  ): Promise<number> {
    if (!this.renderer) throw new Error("Renderer not ready");
    const JSZip = (await import("jszip")).default;
    const quality = options.quality ?? 0.92;
    const scale = options.scale ?? 1;
    const ext = format === "jpeg" ? "jpg" : format;
    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    // JPEG has no alpha; default to white unless a background was chosen.
    const bg = options.background ?? (format === "jpeg" ? "#ffffff" : "transparent");

    const layers = this.graph
      .getLayersBottomUp()
      .filter((l) => l.type !== "group" && (options.visibleOnly !== true || l.visible));
    if (layers.length === 0) return 0;

    const zip = new JSZip();
    const usedNames = new Set<string>();
    let index = 0;
    for (const layer of layers) {
      index++;
      let canvas = await this.renderer.extractLayerCanvas(layer.id);
      // Crop to the layer's own content before scaling/background so each file
      // is sized to the object, not the whole document.
      if (options.trimToContent) canvas = trimCanvas(canvas);
      if (scale !== 1) canvas = scaleCanvas(canvas, scale);
      if (bg !== "transparent") canvas = fillBackground(canvas, bg);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, quality),
      );
      if (!blob) continue;
      const safe = (layer.name || "layer").replace(/[^a-z0-9_\-]+/gi, "_").slice(0, 40) || "layer";
      let name = `${String(index).padStart(2, "0")}_${safe}`;
      while (usedNames.has(name)) name = `${name}_`;
      usedNames.add(name);
      zip.file(`${name}.${ext}`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const docName = this.graph.getMeta().name || "layers";
    downloadBlob(zipBlob, `${docName}-layers.zip`);
    return index;
  }

  async saveProjectFile(): Promise<void> {
    const blob = await saveProject(this.graph);
    const name = this.graph.getMeta().name || "project";
    downloadBlob(blob, `${name}.cpe`);
  }

  /** Serialize the document to a `.cpe` Blob (for autosave — no download). */
  async serialize(): Promise<Blob> {
    return saveProject(this.graph);
  }

  /** Restore a document from a `.cpe` Blob (for autosave restore). */
  async deserialize(blob: Blob): Promise<void> {
    await loadProject(blob, this.graph);
    this.history.clear();
  }

  async loadProjectFile(file: File): Promise<void> {
    await loadProject(file, this.graph);
    this.history.clear();
    this.renderer?.fitToView();
  }

  destroy(): void {
    this.renderer?.destroy();
    this.renderer = null;
  }
}
