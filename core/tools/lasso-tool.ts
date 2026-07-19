import { combineMask, polygonMask } from "../file-io/selection";
import { PointerSample, Tool, ToolContext } from "./tool";

/** Freeform lasso — drag a path; on release it becomes a real pixel selection mask. */
export class LassoTool implements Tool {
  readonly id = "lasso" as const;
  readonly label = "Lasso";
  readonly hint = "Drag a freeform outline to select. Shift = add, Alt = subtract. (L)";
  readonly cursor = "crosshair";

  private dragging = false;
  private points: { x: number; y: number }[] = [];

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    this.points = [doc];
    this.dragging = true;
    ctx.renderer.setLassoPath([...this.points]);
    ctx.renderer.setSelection(null);
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    this.points.push(doc);
    ctx.renderer.setLassoPath([...this.points]);
  }

  onPointerUp(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return;
    this.dragging = false;
    ctx.renderer.setLassoPath(null);
    const points = this.points;
    this.points = [];
    if (points.length < 3) return;

    const { width, height } = ctx.graph.getCanvasSize();
    const mask = polygonMask(width, height, points);

    const existing = ctx.renderer.getSelectionMask();
    if (existing && existing.width === width && existing.height === height && (pt.shiftKey || pt.altKey)) {
      combineMask(existing, mask, pt.shiftKey ? "add" : "subtract");
      ctx.renderer.setSelectionMask({ ...existing });
      return;
    }
    ctx.renderer.setSelectionMask(mask);
  }
}
