import { AddLayerCommand } from "../commands/layer-commands";
import { ReplaceLayerSourceCommand, SetLayerMaskCommand } from "../commands/raster-commands";
import {
  canvasToSource,
  documentToLayerLocal,
  sourceToCanvas,
  strokeSegment,
  StrokeStyle,
} from "../file-io/raster-edit";
import { RasterSource } from "../layer-graph";
import { PointerSample, Tool, ToolContext, ToolId } from "./tool";

/**
 * Brush / Pencil / Eraser — paints onto the Active Layer's raster, or onto the
 * layer's mask when that layer's mask is the active edit target.
 *
 * Model: the stroke is accumulated on a transparent stroke buffer, then
 * composited over the committed base each frame (source-over for paint,
 * destination-out for eraser) at the stroke's opacity. This gives proper
 * opacity semantics with no dark overlap seams, and a smooth live preview.
 *
 * In mask mode the "base" is the mask bitmap (white RGBA, alpha = coverage), so
 * a brush stroke reveals and an eraser stroke hides — exactly like Photoshop.
 */
export class PaintTool implements Tool {
  readonly label: string;
  readonly hint: string;
  readonly cursor = "crosshair";

  private painting = false;
  private layerId: string | null = null;
  private maskMode = false;
  private base: HTMLCanvasElement | null = null;
  private stroke: HTMLCanvasElement | null = null;
  private strokeCtx: CanvasRenderingContext2D | null = null;
  private result: HTMLCanvasElement | null = null;
  private resultCtx: CanvasRenderingContext2D | null = null;
  private lastLocal: { x: number; y: number } | null = null;
  private beforeSource: RasterSource | null = null;
  private style: StrokeStyle;
  private previewQueued = false;

  constructor(
    readonly id: Extract<ToolId, "brush" | "pencil" | "eraser">,
    private getStyle: () => StrokeStyle,
    private getMaskTarget: () => string | null = () => null,
  ) {
    this.style = getStyle();
    if (id === "brush") {
      this.label = "Brush";
      this.hint = "Paint soft strokes on the active layer. (B)";
    } else if (id === "pencil") {
      this.label = "Pencil";
      this.hint = "Hard pixel strokes on the active layer. (P)";
    } else {
      this.label = "Eraser";
      this.hint = "Erase pixels on the active layer. (E)";
    }
  }

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    let layer = ctx.graph.getActiveLayer();
    if (layer?.locked || layer?.type === "group") return;

    const maskTargetId = this.getMaskTarget();
    this.maskMode = !!layer && !!layer.mask && layer.id === maskTargetId;

    if (!layer && !this.maskMode) {
      const size = ctx.graph.getCanvasSize();
      const blank = document.createElement("canvas");
      blank.width = size.width;
      blank.height = size.height;
      const source: RasterSource = { width: blank.width, height: blank.height, bitmap: blank };
      layer = ctx.graph.createRasterLayer("Paint", source, { x: 0, y: 0 });
      ctx.bus.dispatch(new AddLayerCommand(layer));
    }
    if (!layer) return;

    // Painting a mask always deposits white (reveal); the eraser hides.
    this.style = this.maskMode
      ? { ...this.getStyle(), mode: this.id, color: "#ffffff" }
      : { ...this.getStyle(), mode: this.id };
    this.layerId = layer.id;

    const baseSource = this.maskMode && layer.mask ? layer.mask : layer.source;
    this.beforeSource = this.maskMode
      ? null
      : { width: layer.source.width, height: layer.source.height, bitmap: layer.source.bitmap };

    const w = baseSource.width;
    const h = baseSource.height;
    this.base = sourceToCanvas(baseSource);
    this.stroke = document.createElement("canvas");
    this.stroke.width = w;
    this.stroke.height = h;
    this.strokeCtx = this.stroke.getContext("2d", { willReadFrequently: true });
    this.result = document.createElement("canvas");
    this.result.width = w;
    this.result.height = h;
    this.resultCtx = this.result.getContext("2d");
    if (!this.strokeCtx || !this.resultCtx) return;

    this.painting = true;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const local = documentToLayerLocal(layer, doc.x, doc.y);
    this.lastLocal = local;
    strokeSegment(this.strokeCtx, local.x, local.y, local.x, local.y, this.style);
    this.pushPreview(ctx);
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.painting || !this.strokeCtx || !this.layerId || !this.lastLocal) return;
    const layer = ctx.graph.getLayer(this.layerId);
    if (!layer) return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const local = documentToLayerLocal(layer, doc.x, doc.y);
    strokeSegment(this.strokeCtx, this.lastLocal.x, this.lastLocal.y, local.x, local.y, this.style);
    this.lastLocal = local;
    this.pushPreview(ctx);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.painting || !this.result || !this.layerId) {
      this.reset();
      return;
    }
    this.recompose();
    const id = this.layerId;
    const result = this.result;

    if (this.maskMode) {
      this.reset();
      void canvasToSource(result).then((source) => {
        ctx.bus.dispatch(new SetLayerMaskCommand(id, source, "Paint mask"));
        ctx.renderer.setMaskPreview(id, null);
      });
      return;
    }

    const before = this.beforeSource;
    if (!before) {
      this.reset();
      return;
    }
    const label =
      this.id === "brush" ? "Brush stroke" : this.id === "pencil" ? "Pencil stroke" : "Erase";
    const layer = ctx.graph.getLayer(id);
    if (layer) layer.source = before;
    this.reset();

    void canvasToSource(result).then((source) => {
      const current = ctx.graph.getLayer(id);
      if (!current) return;
      current.source = before;
      ctx.bus.dispatch(new ReplaceLayerSourceCommand(id, source, label));
      ctx.renderer.invalidateLayer(id);
    });
  }

  /** Recompose base + stroke buffer into the result canvas. */
  private recompose(): void {
    const r = this.resultCtx;
    if (!r || !this.base || !this.stroke || !this.result) return;
    r.globalCompositeOperation = "source-over";
    r.globalAlpha = 1;
    r.clearRect(0, 0, this.result.width, this.result.height);
    r.drawImage(this.base, 0, 0);
    r.globalAlpha = Math.min(1, Math.max(0, this.style.opacity));
    r.globalCompositeOperation = this.style.mode === "eraser" ? "destination-out" : "source-over";
    r.drawImage(this.stroke, 0, 0);
    r.globalAlpha = 1;
    r.globalCompositeOperation = "source-over";
  }

  /** Sync GPU texture from the result canvas once per animation frame. */
  private pushPreview(ctx: ToolContext): void {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => {
      this.previewQueued = false;
      if (!this.painting || !this.result || !this.layerId) return;
      this.recompose();
      if (this.maskMode) {
        ctx.renderer.setMaskPreview(this.layerId, this.result);
        return;
      }
      const layer = ctx.graph.getLayer(this.layerId);
      if (!layer) return;
      layer.source = { width: this.result.width, height: this.result.height, bitmap: this.result };
      ctx.renderer.refreshLayerFromBitmap(this.layerId);
    });
  }

  private reset(): void {
    this.painting = false;
    this.layerId = null;
    this.maskMode = false;
    this.base = null;
    this.stroke = null;
    this.strokeCtx = null;
    this.result = null;
    this.resultCtx = null;
    this.lastLocal = null;
    this.beforeSource = null;
    this.previewQueued = false;
  }
}
