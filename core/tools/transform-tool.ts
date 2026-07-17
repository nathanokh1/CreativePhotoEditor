import { SetTransformCommand } from "../commands";
import { Transform } from "../layer-graph";
import { PointerSample, Tool, ToolContext } from "./tool";

/**
 * MVP transform: drag to scale the active layer about its center. Hold Shift for
 * uniform scaling (default), Alt to also allow horizontal-only stretch. Rotation
 * handles are a Phase 2 addition — kept intentionally simple here.
 */
export class TransformTool implements Tool {
  readonly id = "transform" as const;
  readonly label = "Transform";
  readonly hint = "Drag to scale the active layer from its center. (T)";
  readonly cursor = "nwse-resize";

  private dragging = false;
  private layerId: string | null = null;
  private startDoc = { x: 0, y: 0 };
  private startTransform: Transform | null = null;
  private center = { x: 0, y: 0 };
  private startDist = 1;
  private nextTransform: Transform | null = null;

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const active = ctx.graph.getActiveLayer();
    const hit = ctx.renderer.hitTest(pt.canvasX, pt.canvasY);
    const target = hit ?? active?.id ?? null;
    if (!target) return;
    ctx.graph.setActiveLayer(target);
    const layer = ctx.graph.getLayer(target);
    if (!layer) return;
    this.layerId = target;
    this.startTransform = { ...layer.transform };
    this.startDoc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    // Layer center in document space.
    this.center = {
      x: layer.transform.x + (layer.source.width * layer.transform.scaleX) / 2,
      y: layer.transform.y + (layer.source.height * layer.transform.scaleY) / 2,
    };
    this.startDist = Math.max(
      1,
      Math.hypot(this.startDoc.x - this.center.x, this.startDoc.y - this.center.y),
    );
    this.dragging = true;
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.layerId || !this.startTransform) return;
    const now = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const dist = Math.hypot(now.x - this.center.x, now.y - this.center.y);
    const factor = Math.max(0.05, dist / this.startDist);
    const layer = ctx.graph.getLayer(this.layerId);
    if (!layer) return;
    const newScaleX = this.startTransform.scaleX * factor;
    const newScaleY = this.startTransform.scaleY * factor;
    // Keep the layer center fixed while scaling.
    const next: Transform = {
      ...this.startTransform,
      scaleX: newScaleX,
      scaleY: newScaleY,
      x: this.center.x - (layer.source.width * newScaleX) / 2,
      y: this.center.y - (layer.source.height * newScaleY) / 2,
    };
    this.nextTransform = next;
    // Transient preview: the renderer's preview channel is position-only, so for
    // smooth scale feedback we apply to the graph directly during the drag. This
    // is NOT recorded — on release we rewind to `start` and dispatch one
    // SetTransformCommand, so the History Stack only ever sees the final result.
    ctx.graph.setTransform(this.layerId, next);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.layerId || !this.startTransform) {
      this.reset();
      return;
    }
    const id = this.layerId;
    const start = this.startTransform;
    const end = this.nextTransform;
    this.reset();
    if (end) {
      // Restore to start, then dispatch a single undoable command to reach end.
      ctx.graph.setTransform(id, start);
      ctx.bus.dispatch(new SetTransformCommand(id, end));
    }
  }

  private reset(): void {
    this.dragging = false;
    this.layerId = null;
    this.startTransform = null;
    this.nextTransform = null;
  }
}
