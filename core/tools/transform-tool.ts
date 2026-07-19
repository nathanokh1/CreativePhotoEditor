import { SetTransformCommand } from "../commands";
import { Transform } from "../layer-graph";
import { PointerSample, Tool, ToolContext } from "./tool";
import { HandleId, handleCursor, layerBounds, resizeFromHandle } from "./transform-math";

/**
 * Transform tool with 8 resize handles + a rotation handle above the top edge.
 */
export class TransformTool implements Tool {
  readonly id = "transform" as const;
  readonly label = "Transform";
  readonly hint =
    "Drag corner/edge handles to resize, the top handle to rotate. Hold Shift to toggle aspect lock. (T)";
  readonly cursor = "default";

  lockAspect = true;

  private mode: "idle" | "resize" | "move" | "rotate" = "idle";
  private handle: HandleId | null = null;
  private layerId: string | null = null;
  private startTransform: Transform | null = null;
  private startDoc = { x: 0, y: 0 };
  private startAngle = 0;
  private nextTransform: Transform | null = null;
  private moveDelta = { dx: 0, dy: 0 };

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const active = ctx.graph.getActiveLayer();
    if (active && active.visible && !active.locked) {
      const handle = ctx.renderer.hitTestHandle(pt.canvasX, pt.canvasY, active.id);
      if (handle === "rotate") {
        this.beginRotate(active.id, pt, ctx);
        return;
      }
      if (handle) {
        this.beginResize(active.id, handle, pt, ctx);
        return;
      }
    }

    const hit = ctx.renderer.hitTest(pt.canvasX, pt.canvasY);
    const target = hit ?? active?.id ?? null;
    if (!target) {
      this.reset();
      return;
    }
    ctx.graph.setActiveLayer(target);
    const layer = ctx.graph.getLayer(target);
    if (!layer || layer.locked) return;

    if (active?.id !== target) {
      this.reset();
      ctx.renderer.setShowTransformHandles(true);
      return;
    }

    this.layerId = target;
    this.startTransform = { ...layer.transform };
    this.startDoc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    this.mode = "move";
    this.moveDelta = { dx: 0, dy: 0 };
    this.nextTransform = null;
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (this.mode === "idle") {
      const active = ctx.graph.getActiveLayer();
      if (active) {
        const h = ctx.renderer.hitTestHandle(pt.canvasX, pt.canvasY, active.id);
        ctx.renderer.setCursorOverride(h ? handleCursor(h) : null);
      }
      return;
    }

    if (!this.layerId || !this.startTransform) return;
    const now = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const layer = ctx.graph.getLayer(this.layerId);
    if (!layer) return;

    if (this.mode === "rotate") {
      const b = layerBounds({ ...layer, transform: this.startTransform });
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const angle = Math.atan2(now.y - cy, now.x - cx);
      const next: Transform = {
        ...this.startTransform,
        rotation: this.startTransform.rotation + (angle - this.startAngle),
      };
      this.nextTransform = next;
      ctx.graph.setTransform(this.layerId, next);
      return;
    }

    if (this.mode === "resize" && this.handle) {
      const lock = pt.shiftKey ? !this.lockAspect : this.lockAspect;
      const next = resizeFromHandle(layer, this.startTransform, this.handle, now, lock);
      this.nextTransform = next;
      ctx.graph.setTransform(this.layerId, next);
      return;
    }

    if (this.mode === "move") {
      let dx = now.x - this.startDoc.x;
      let dy = now.y - this.startDoc.y;
      if (pt.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      this.moveDelta = { dx, dy };
      ctx.renderer.setPreviewOffset(this.layerId, dx, dy);
    }
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.layerId || !this.startTransform) {
      this.reset();
      ctx.renderer.setShowTransformHandles(true);
      return;
    }
    const id = this.layerId;
    const start = this.startTransform;

    if ((this.mode === "resize" || this.mode === "rotate") && this.nextTransform) {
      ctx.graph.setTransform(id, start);
      ctx.bus.dispatch(new SetTransformCommand(id, this.nextTransform));
    } else if (this.mode === "move") {
      const { dx, dy } = this.moveDelta;
      ctx.renderer.clearPreview(id);
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        ctx.bus.dispatch(
          new SetTransformCommand(id, { ...start, x: start.x + dx, y: start.y + dy }),
        );
      }
    }

    this.reset();
    ctx.renderer.setShowTransformHandles(true);
  }

  private beginResize(layerId: string, handle: HandleId, pt: PointerSample, ctx: ToolContext): void {
    const layer = ctx.graph.getLayer(layerId);
    if (!layer) return;
    this.layerId = layerId;
    this.handle = handle;
    this.startTransform = { ...layer.transform };
    this.startDoc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    this.mode = "resize";
    this.nextTransform = null;
    ctx.renderer.setCursorOverride(handleCursor(handle));
  }

  private beginRotate(layerId: string, pt: PointerSample, ctx: ToolContext): void {
    const layer = ctx.graph.getLayer(layerId);
    if (!layer) return;
    this.layerId = layerId;
    this.handle = "rotate";
    this.startTransform = { ...layer.transform };
    this.startDoc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const b = layerBounds(layer);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    this.startAngle = Math.atan2(this.startDoc.y - cy, this.startDoc.x - cx);
    this.mode = "rotate";
    this.nextTransform = null;
    ctx.renderer.setCursorOverride("grabbing");
  }

  private reset(): void {
    this.mode = "idle";
    this.handle = null;
    this.layerId = null;
    this.startTransform = null;
    this.nextTransform = null;
    this.moveDelta = { dx: 0, dy: 0 };
  }
}
