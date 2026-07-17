import { SetTransformCommand } from "../commands";
import { Transform } from "../layer-graph";
import { PointerSample, Tool, ToolContext } from "./tool";
import { HandleId, handleCursor, resizeFromHandle } from "./transform-math";
/**
 * Transform tool with 8 resize handles (corners + edges).
 * - Corners: scale; aspect locked by default (Shift = free).
 * - Edges: stretch one axis.
 * - Drag inside the layer (not on a handle): move it.
 * Lock-aspect default is flipped when Settings.lockAspectRatio is false.
 */
export class TransformTool implements Tool {
  readonly id = "transform" as const;
  readonly label = "Transform";
  readonly hint =
    "Drag corner/edge handles to resize. Hold Shift to toggle aspect lock. Drag inside to move. (T)";
  readonly cursor = "default";

  /** When true (default), corner handles keep proportions unless Shift is held. */
  lockAspect = true;

  private mode: "idle" | "resize" | "move" = "idle";
  private handle: HandleId | null = null;
  private layerId: string | null = null;
  private startTransform: Transform | null = null;
  private startDoc = { x: 0, y: 0 };
  private nextTransform: Transform | null = null;
  private moveDelta = { dx: 0, dy: 0 };

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const active = ctx.graph.getActiveLayer();
    // Prefer handle hit on the active layer, then layer hit.
    if (active && active.visible && !active.locked) {
      const handle = ctx.renderer.hitTestHandle(pt.canvasX, pt.canvasY, active.id);
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

    // Clicking a different layer: select it and show handles; don't start a move
    // until the next drag on that selection (feels more predictable).
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
    // Update cursor when hovering handles.
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

    if (this.mode === "resize" && this.handle) {
      // Shift flips the lock-aspect preference for this gesture.
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

    if (this.mode === "resize" && this.nextTransform) {
      ctx.graph.setTransform(id, start);
      ctx.bus.dispatch(new SetTransformCommand(id, this.nextTransform));
    } else if (this.mode === "move") {
      const { dx, dy } = this.moveDelta;
      ctx.renderer.clearPreview(id);
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
        const end: Transform = {
          ...start,
          x: start.x + dx,
          y: start.y + dy,
        };
        ctx.bus.dispatch(new SetTransformCommand(id, end));
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

  private reset(): void {
    this.mode = "idle";
    this.handle = null;
    this.layerId = null;
    this.startTransform = null;
    this.nextTransform = null;
    this.moveDelta = { dx: 0, dy: 0 };
  }
}
