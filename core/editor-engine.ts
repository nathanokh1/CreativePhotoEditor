import {
  AddLayerCommand,
  CommandBus,
  DeleteLayerCommand,
  History,
  ReorderLayerCommand,
  SetCanvasSizeCommand,
  SetLayerPropsCommand,
  SetTransformCommand,
} from "./commands";
import { BlendMode, CanvasSize, LayerGraph } from "./layer-graph";
import { Renderer } from "./render";
import {
  ExportFormat,
  ClipboardPayload,
  cloneLayerSource,
  cropLayerToSelection,
  downloadBlob,
  flattenToBlob,
  isSupportedImage,
  loadImageAsSource,
  loadProject,
  saveProject,
} from "./file-io";
import { PointerSample, ToolId, ToolManager } from "./tools";

export interface ImportOptions {
  /** When true and this is the first layer, resize the Document to match the image. */
  fitCanvasToImage?: boolean;
}

/**
 * The framework-agnostic orchestrator. Owns the Document (LayerGraph), the
 * Command/History system, the Tool manager and a reference to the Renderer.
 * The React shell talks to this — it never reaches into the sub-systems directly.
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

  attachRenderer(renderer: Renderer): void {
    this.renderer = renderer;
    renderer.attachGraph(this.graph);
    this.tools = new ToolManager({ graph: this.graph, bus: this.bus, renderer });
    renderer.fitToView();
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

  async importFile(file: File, options: ImportOptions = {}): Promise<void> {
    if (!isSupportedImage(file)) throw new Error(`Unsupported file: ${file.name}`);
    const source = await loadImageAsSource(file);
    const name = file.name.replace(/\.[^.]+$/, "") || "Layer";
    const isFirst = this.graph.getLayersBottomUp().length === 0;
    const fit = options.fitCanvasToImage !== false && isFirst;

    if (fit) {
      this.bus.dispatch(
        new SetCanvasSizeCommand({ width: source.width, height: source.height }),
      );
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

  /** Resize the Document canvas to match a layer's current visual bounds. */
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
    this.bus.dispatch(new DeleteLayerCommand(id));
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
    this.bus.dispatch(
      new SetLayerPropsCommand(id, { visible }, visible ? "Show layer" : "Hide layer"),
    );
  }

  setLayerBlendMode(id: string, blendMode: BlendMode): void {
    this.bus.dispatch(new SetLayerPropsCommand(id, { blendMode }, "Change blend mode"));
  }

  renameLayer(id: string, name: string): void {
    this.bus.dispatch(new SetLayerPropsCommand(id, { name }, "Rename layer"));
  }

  setLayerLocked(id: string, locked: boolean): void {
    this.bus.dispatch(
      new SetLayerPropsCommand(id, { locked }, locked ? "Lock layer" : "Unlock layer"),
    );
  }

  // ---- clipboard ----------------------------------------------------------

  async copy(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer) return false;
    const selection = this.renderer?.getSelection();
    if (selection && selection.width > 1 && selection.height > 1) {
      const cropped = await cropLayerToSelection(layer, selection);
      if (!cropped) return false;
      this.clipboard = cropped;
      return true;
    }
    this.clipboard = await cloneLayerSource(layer);
    return true;
  }

  async cut(): Promise<boolean> {
    const layer = this.graph.getActiveLayer();
    if (!layer) return false;
    const ok = await this.copy();
    if (!ok) return false;
    // Selection cut: paste-as-new is the crop; delete whole layer for layer-level cut.
    const selection = this.renderer?.getSelection();
    if (!selection || selection.width < 2 || selection.height < 2) {
      this.bus.dispatch(new DeleteLayerCommand(layer.id));
    }
    this.renderer?.setSelection(null);
    return true;
  }

  paste(): boolean {
    if (!this.clipboard) return false;
    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(this.clipboard.name, this.clipboard.source, {
      x: Math.round((canvas.width - this.clipboard.source.width) / 2) + 16,
      y: Math.round((canvas.height - this.clipboard.source.height) / 2) + 16,
    });
    this.bus.dispatch(new AddLayerCommand(layer));
    return true;
  }

  clearSelection(): void {
    this.renderer?.setSelection(null);
  }

  async exportAs(format: ExportFormat): Promise<void> {
    if (!this.renderer) throw new Error("Renderer not ready");
    const blob = await flattenToBlob(this.renderer, format);
    const name = this.graph.getMeta().name || "export";
    downloadBlob(blob, `${name}.${format === "jpeg" ? "jpg" : format}`);
  }

  async saveProjectFile(): Promise<void> {
    const blob = await saveProject(this.graph);
    const name = this.graph.getMeta().name || "project";
    downloadBlob(blob, `${name}.cpe`);
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
