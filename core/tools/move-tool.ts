import { MoveLayerCommand } from "../commands";
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

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const hit = ctx.renderer.hitTest(pt.canvasX, pt.canvasY);
    if (hit) {
      ctx.graph.setActiveLayer(hit);
      this.layerId = hit;
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
    this.lastDelta = { dx, dy };
    ctx.renderer.setPreviewOffset(this.layerId, dx, dy);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging || !this.layerId) return;
    const { dx, dy } = this.lastDelta;
    const id = this.layerId;
    this.dragging = false;
    this.layerId = null;
    ctx.renderer.clearPreview(id);
    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      ctx.bus.dispatch(new MoveLayerCommand(id, dx, dy));
    }
  }
}
