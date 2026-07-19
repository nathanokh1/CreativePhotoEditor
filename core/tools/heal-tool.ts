import { ReplaceLayerSourceCommand } from "../commands/raster-commands";
import {
  canvasToSource,
  contentAwareFill,
  documentToLayerLocal,
  sourceToCanvas,
  StrokeStyle,
} from "../file-io/raster-edit";
import { RasterSource } from "../layer-graph";
import { PointerSample, Tool, ToolContext } from "./tool";

/**
 * Spot heal / cleanup ("magic eraser"): brush over a blemish or object; on
 * release the painted region is filled by diffusing surrounding pixels inward.
 * Fully client-side, no AI. Best for small-to-medium areas on a busy-ish or
 * smooth background.
 */
export class HealTool implements Tool {
  readonly id = "heal" as const;
  readonly label = "Cleanup / Heal";
  readonly hint = "Brush over a spot or object to remove it. Releases to fill from surroundings. (J)";
  readonly cursor = "crosshair";

  private painting = false;
  private layerId: string | null = null;
  private work: HTMLCanvasElement | null = null;
  private overlay: HTMLCanvasElement | null = null;
  private overlayCtx: CanvasRenderingContext2D | null = null;
  private beforeSource: RasterSource | null = null;
  private lastLocal: { x: number; y: number } | null = null;
  private mask: Uint8Array | null = null;
  private bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
  private previewQueued = false;

  constructor(private getStyle: () => StrokeStyle) {}

  /** Draw a brush-size ring at the cursor so the footprint is visible. */
  private updateCursor(
    ctx: ToolContext,
    layer: { transform: { x: number; y: number; scaleX: number; scaleY: number } },
    local: { x: number; y: number },
  ): void {
    const style = this.getStyle();
    const r = Math.max(1, (style.size / 2) * Math.abs(layer.transform.scaleX || 1));
    ctx.renderer.setToolCursor({
      brush: {
        x: layer.transform.x + local.x * layer.transform.scaleX,
        y: layer.transform.y + local.y * layer.transform.scaleY,
        r,
      },
    });
  }

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const layer = ctx.graph.getActiveLayer();
    if (!layer || layer.locked || layer.type === "group") return;
    this.layerId = layer.id;
    this.beforeSource = {
      width: layer.source.width,
      height: layer.source.height,
      bitmap: layer.source.bitmap,
    };
    const w = layer.source.width;
    const h = layer.source.height;
    this.work = sourceToCanvas(layer.source);
    this.overlay = document.createElement("canvas");
    this.overlay.width = w;
    this.overlay.height = h;
    this.overlayCtx = this.overlay.getContext("2d");
    this.mask = new Uint8Array(w * h);
    this.bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
    if (!this.overlayCtx) return;

    this.painting = true;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const local = documentToLayerLocal(layer, doc.x, doc.y);
    this.lastLocal = local;
    this.paintMask(local, local);
    this.pushPreview(ctx);
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
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
    this.paintMask(this.lastLocal, local);
    this.lastLocal = local;
    this.pushPreview(ctx);
    this.updateCursor(ctx, layer, local);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.painting || !this.work || !this.layerId || !this.beforeSource || !this.mask) {
      this.reset();
      return;
    }
    const id = this.layerId;
    const before = this.beforeSource;
    const work = this.work;
    const mask = this.mask;
    const b = this.bounds;

    const layer = ctx.graph.getLayer(id);
    if (layer) layer.source = before;

    if (b.minX <= b.maxX && b.minY <= b.maxY) {
      const pad = 6;
      contentAwareFill(work, mask, {
        x: b.minX - pad,
        y: b.minY - pad,
        width: b.maxX - b.minX + pad * 2,
        height: b.maxY - b.minY + pad * 2,
      });
      void canvasToSource(work).then((source) => {
        const current = ctx.graph.getLayer(id);
        if (!current) return;
        current.source = before;
        ctx.bus.dispatch(new ReplaceLayerSourceCommand(id, source, "Cleanup / Heal"));
        ctx.renderer.invalidateLayer(id);
      });
    } else {
      ctx.renderer.invalidateLayer(id);
    }
    this.reset();
  }

  private paintMask(from: { x: number; y: number }, to: { x: number; y: number }): void {
    if (!this.mask || !this.overlayCtx || !this.overlay || !this.work) return;
    const style = this.getStyle();
    const radius = Math.max(2, style.size / 2);
    const w = this.work.width;
    const h = this.work.height;

    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const step = Math.max(1, radius * 0.5);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let s = 0; s <= n; s++) {
      const t = n === 0 ? 0 : s / n;
      const cx = from.x + (to.x - from.x) * t;
      const cy = from.y + (to.y - from.y) * t;
      const x0 = Math.max(0, Math.floor(cx - radius));
      const x1 = Math.min(w - 1, Math.ceil(cx + radius));
      const y0 = Math.max(0, Math.floor(cy - radius));
      const y1 = Math.min(h - 1, Math.ceil(cy + radius));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
            this.mask[y * w + x] = 1;
            if (x < this.bounds.minX) this.bounds.minX = x;
            if (y < this.bounds.minY) this.bounds.minY = y;
            if (x > this.bounds.maxX) this.bounds.maxX = x;
            if (y > this.bounds.maxY) this.bounds.maxY = y;
          }
        }
      }
    }

    // Show a translucent overlay marking what will be cleaned.
    const octx = this.overlayCtx;
    octx.strokeStyle = "rgba(99,102,241,0.9)";
    octx.fillStyle = "rgba(99,102,241,0.35)";
    octx.lineWidth = radius * 2;
    octx.lineCap = "round";
    octx.lineJoin = "round";
    octx.beginPath();
    octx.moveTo(from.x, from.y);
    octx.lineTo(to.x, to.y);
    octx.stroke();
  }

  private pushPreview(ctx: ToolContext): void {
    if (this.previewQueued) return;
    this.previewQueued = true;
    requestAnimationFrame(() => {
      this.previewQueued = false;
      if (!this.painting || !this.work || !this.overlay || !this.layerId) return;
      // Composite the marker overlay over the base for live feedback.
      const preview = document.createElement("canvas");
      preview.width = this.work.width;
      preview.height = this.work.height;
      const pctx = preview.getContext("2d");
      if (!pctx) return;
      pctx.drawImage(this.work, 0, 0);
      pctx.drawImage(this.overlay, 0, 0);
      const layer = ctx.graph.getLayer(this.layerId);
      if (!layer) return;
      layer.source = { width: preview.width, height: preview.height, bitmap: preview };
      ctx.renderer.invalidateLayer(this.layerId);
    });
  }

  private reset(): void {
    this.painting = false;
    this.layerId = null;
    this.work = null;
    this.overlay = null;
    this.overlayCtx = null;
    this.beforeSource = null;
    this.lastLocal = null;
    this.mask = null;
    this.bounds = { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 };
    this.previewQueued = false;
  }
}
