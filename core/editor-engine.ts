import {
  AddLayerCommand,
  CommandBus,
  DeleteLayerCommand,
  History,
  ReorderLayerCommand,
  SetLayerPropsCommand,
} from "./commands";
import { BlendMode, CanvasSize, LayerGraph } from "./layer-graph";
import { Renderer } from "./render";
import {
  ExportFormat,
  downloadBlob,
  flattenToBlob,
  isSupportedImage,
  loadImageAsSource,
  loadProject,
  saveProject,
} from "./file-io";
import { PointerSample, ToolId, ToolManager } from "./tools";

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

  // ---- tools + pointer ----------------------------------------------------

  setTool(id: ToolId): void {
    this.tools?.setActive(id);
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
    // Keep the point under the cursor stable while zooming.
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

  // ---- history ------------------------------------------------------------

  undo(): void {
    this.bus.undo();
  }

  redo(): void {
    this.bus.redo();
  }

  // ---- import / layers ----------------------------------------------------

  async importFile(file: File): Promise<void> {
    if (!isSupportedImage(file)) throw new Error(`Unsupported file: ${file.name}`);
    const source = await loadImageAsSource(file);
    const name = file.name.replace(/\.[^.]+$/, "") || "Layer";
    // Center the new layer on the canvas.
    const canvas = this.graph.getCanvasSize();
    const layer = this.graph.createRasterLayer(name, source, {
      x: Math.round((canvas.width - source.width) / 2),
      y: Math.round((canvas.height - source.height) / 2),
    });
    this.bus.dispatch(new AddLayerCommand(layer));
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
    this.bus.dispatch(new SetLayerPropsCommand(id, { locked }, locked ? "Lock layer" : "Unlock layer"));
  }

  // ---- export / save / load ----------------------------------------------

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
