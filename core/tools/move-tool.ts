import { MoveLayerCommand } from "../commands";
import { layerBounds } from "./transform-math";
import { PointerSample, Tool, ToolContext } from "./tool";

/** Select and drag the topmost layer under the pointer. */
export class MoveTool implements Tool {
  readonly id = "move" as const;
  readonly label = "Move";
  readonly hint = "Click a layer to select it, then drag to reposition it. (V)";
  readonly cursor = "move";

  private dragging = false;
  private layerId: string | null = null;
  private startDoc = { x: 0, y: 0 };
  private lastDelta = { dx: 0, dy: 0 };

  constructor(private readonly snapEnabled: () => boolean = () => true) {}

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    // Alpha-aware topmost hit, but keep a selected text layer draggable even when a
    // full-frame photo sits above it in z-order.
    const active = ctx.graph.getActiveLayer();
    const inActive =
      !!active &&
      !active.locked &&
      active.type !== "group" &&
      ctx.renderer.hitTestLayer(active.id, pt.canvasX, pt.canvasY);
    const hit = ctx.renderer.hitTest(pt.canvasX, pt.canvasY);

    let target: string | null = null;
    if (inActive && active!.type === "text") target = active!.id;
    else if (hit) target = hit;
    else if (inActive) target = active!.id;

    if (target) {
      ctx.graph.setActiveLayer(target);
      this.layerId = target;
      this.dragging = true;
      this.startDoc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
      this.lastDelta = { dx: 0, dy: 0 };
    } else {
      this.layerId = null;
      this.dragging = false;
    }
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.layerId) return;
    const now = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    let dx = now.x - this.startDoc.x;
    let dy = now.y - this.startDoc.y;
    if (pt.shiftKey) {
      // Constrain to the dominant axis.
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }

    // Snap the moving layer's edges/center to canvas edges + center. Alt bypasses.
    const lines: { axis: "x" | "y"; pos: number }[] = [];
    if (this.snapEnabled() && !pt.altKey) {
      const layer = ctx.graph.getLayer(this.layerId);
      if (layer) {
        const b = layerBounds(layer);
        const zoom = ctx.renderer.getViewport().zoom || 1;
        const threshold = 6 / zoom; // ~6 screen px
        const size = ctx.graph.getCanvasSize();
        const snapX = this.bestSnap(
          [b.x + dx, b.x + dx + b.width / 2, b.x + dx + b.width],
          [0, size.width / 2, size.width],
          threshold,
        );
        const snapY = this.bestSnap(
          [b.y + dy, b.y + dy + b.height / 2, b.y + dy + b.height],
          [0, size.height / 2, size.height],
          threshold,
        );
        if (snapX) {
          dx += snapX.shift;
          lines.push({ axis: "x", pos: snapX.target });
        }
        if (snapY) {
          dy += snapY.shift;
          lines.push({ axis: "y", pos: snapY.target });
        }
      }
    }

    this.lastDelta = { dx, dy };
    ctx.renderer.setSnapLines(lines);
    ctx.renderer.setPreviewOffset(this.layerId, dx, dy);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.layerId) return;
    const { dx, dy } = this.lastDelta;
    const id = this.layerId;
    this.dragging = false;
    this.layerId = null;
    ctx.renderer.setSnapLines([]);
    ctx.renderer.clearPreview(id);
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      ctx.bus.dispatch(new MoveLayerCommand(id, dx, dy));
    }
  }

  /** Find the closest (feature → target) pair within threshold; returns the shift to apply. */
  private bestSnap(
    features: number[],
    targets: number[],
    threshold: number,
  ): { shift: number; target: number } | null {
    let best: { shift: number; target: number; dist: number } | null = null;
    for (const f of features) {
      for (const t of targets) {
        const dist = Math.abs(f - t);
        if (dist <= threshold && (!best || dist < best.dist)) {
          best = { shift: t - f, target: t, dist };
        }
      }
    }
    return best ? { shift: best.shift, target: best.target } : null;
  }
}
