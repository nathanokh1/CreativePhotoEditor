import { ReplaceLayerSourceCommand } from "../commands/raster-commands";
import {
  canvasToSource,
  documentToLayerLocal,
  sourceToCanvas,
  StrokeStyle,
} from "../file-io/raster-edit";
import { RasterSource } from "../layer-graph";
import { PointerSample, Tool, ToolContext } from "./tool";

/**
 * Clone stamp: Alt/Option-click to set the source point, then drag to paint a
 * copy of the source area (offset locked at the first paint stroke).
 */
export class CloneTool implements Tool {
  readonly id = "clone" as const;
  readonly label = "Clone stamp";
  readonly hint = "Alt/Option-click to set the source, then drag to clone. (K)";
  readonly cursor = "crosshair";

  private painting = false;
  private layerId: string | null = null;
  private base: HTMLCanvasElement | null = null;
  private work: HTMLCanvasElement | null = null;
  private workCtx: CanvasRenderingContext2D | null = null;
  private beforeSource: RasterSource | null = null;
  private sourcePoint: { x: number; y: number } | null = null;
  private offset: { dx: number; dy: number } | null = null;
  private lastLocal: { x: number; y: number } | null = null;
  private previewQueued = false;

  constructor(private getStyle: () => StrokeStyle) {}

  /** Map layer-local coords back to document space (rotation ignored, per MVP). */
  private localToDoc(
    layer: { transform: { x: number; y: number; scaleX: number; scaleY: number } },
    lx: number,
    ly: number,
  ): { x: number; y: number } {
    return {
      x: layer.transform.x + lx * layer.transform.scaleX,
      y: layer.transform.y + ly * layer.transform.scaleY,
    };
  }

  /** Refresh the on-canvas anchor + brush ring so the user can see what will clone. */
  private updateCursor(
    ctx: ToolContext,
    layer: { transform: { x: number; y: number; scaleX: number; scaleY: number } },
    local: { x: number; y: number },
  ): void {
    const style = this.getStyle();
    const rDoc = Math.max(1, (style.size / 2) * Math.abs(layer.transform.scaleX || 1));
    const brushDoc = this.localToDoc(layer, local.x, local.y);
    const state: {
      brush?: { x: number; y: number; r: number };
      cloneSource?: { x: number; y: number; r: number };
      anchor?: { x: number; y: number };
    } = { brush: { x: brushDoc.x, y: brushDoc.y, r: rDoc } };

    if (this.painting && this.offset) {
      const srcDoc = this.localToDoc(layer, local.x - this.offset.dx, local.y - this.offset.dy);
      state.cloneSource = { x: srcDoc.x, y: srcDoc.y, r: rDoc };
    } else if (this.sourcePoint) {
      const anchorDoc = this.localToDoc(layer, this.sourcePoint.x, this.sourcePoint.y);
      state.anchor = { x: anchorDoc.x, y: anchorDoc.y };
    }
    ctx.renderer.setToolCursor(state);
  }

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const layer = ctx.graph.getActiveLayer();
    if (!layer || layer.locked || layer.type === "group") return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const local = documentToLayerLocal(layer, doc.x, doc.y);

    // Alt-click sets the clone source anchor.
    if (pt.altKey) {
      this.sourcePoint = local;
      this.offset = null;
      this.updateCursor(ctx, layer, local);
      return;
    }
    if (!this.sourcePoint) return; // need a source first

    this.layerId = layer.id;
    this.beforeSource = {
      width: layer.source.width,
      height: layer.source.height,
      bitmap: layer.source.bitmap,
    };
    this.base = sourceToCanvas(layer.source);
    this.work = sourceToCanvas(layer.source);
    this.workCtx = this.work.getContext("2d", { willReadFrequently: true });
    if (!this.workCtx) return;

    this.offset = { dx: local.x - this.sourcePoint.x, dy: local.y - this.sourcePoint.y };
    this.painting = true;
    this.lastLocal = local;
    this.stampAt(local);
    this.pushPreview(ctx);
    this.updateCursor(ctx, layer, local);
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    // Hover: keep the anchor + brush ring visible even when not painting.
    if (!this.painting) {
      const hoverLayer = ctx.graph.getActiveLayer();
      if (hoverLayer && hoverLayer.type !== "group") {
        const doc0 = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
        this.updateCursor(ctx, hoverLayer, documentToLayerLocal(hoverLayer, doc0.x, doc0.y));
      }
      return;
    }
    if (!this.layerId || !this.lastLocal) return;
    const layer = ctx.graph.getLayer(this.layerId);
    if (!layer) return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const local = documentToLayerLocal(layer, doc.x, doc.y);
    const dist = Math.hypot(local.x - this.lastLocal.x, local.y - this.lastLocal.y);
    const style = this.getStyle();
    const step = Math.max(1, style.size * 0.2);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.stampAt({
        x: this.lastLocal.x + (local.x - this.lastLocal.x) * t,
        y: this.lastLocal.y + (local.y - this.lastLocal.y) * t,
      });
    }
    this.lastLocal = local;
    this.pushPreview(ctx);
    this.updateCursor(ctx, layer, local);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.painting || !this.work || !this.layerId || !this.beforeSource) {
      this.painting = false;
      return;
    }
    const id = this.layerId;
    const before = this.beforeSource;
    const work = this.work;
    const layer = ctx.graph.getLayer(id);
    if (layer) layer.source = before;
    this.painting = false;
    this.previewQueued = false;

    void canvasToSource(work).then((source) => {
      const current = ctx.graph.getLayer(id);
      if (!current) return;
      current.source = before;
      ctx.bus.dispatch(new ReplaceLayerSourceCommand(id, source, "Clone stamp"));
      ctx.renderer.invalidateLayer(id);
    });
  }

  private stampAt(local: { x: number; y: number }): void {
    if (!this.workCtx || !this.base || !this.offset) return;
    const style = this.getStyle();
    const radius = Math.max(1, style.size / 2);
    const srcX = local.x - this.offset.dx;
    const srcY = local.y - this.offset.dy;
    const ctx = this.workCtx;
    ctx.save();
    ctx.beginPath();
    ctx.arc(local.x, local.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = Math.min(1, Math.max(0.05, style.opacity));
    ctx.drawImage(
      this.base,
      srcX - radius,
      srcY - radius,
      radius * 2,
      radius * 2,
      local.x - radius,
      local.y - radius,
      radius * 2,
      radius * 2,
    );
    ctx.restore();
  }

  private pushPreview(ctx: ToolContext): void {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => {
      this.previewQueued = false;
      if (!this.painting || !this.work || !this.layerId) return;
      const layer = ctx.graph.getLayer(this.layerId);
      if (!layer) return;
      layer.source = { width: this.work.width, height: this.work.height, bitmap: this.work };
      ctx.renderer.refreshLayerFromBitmap(this.layerId);
    });
  }
}
