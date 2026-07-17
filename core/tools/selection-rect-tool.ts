import { PointerSample, Tool, ToolContext } from "./tool";

/**
 * Rectangle selection tool. Drag to define a document-space Selection that
 * constrains Cut/Copy. Does not mutate the LayerGraph.
 */
export class SelectionRectTool implements Tool {
  readonly id = "select" as const;
  readonly label = "Select";
  readonly hint = "Drag a rectangle to select a region for Cut/Copy. (M)";
  readonly cursor = "crosshair";

  private dragging = false;
  private start = { x: 0, y: 0 };

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    this.start = doc;
    this.dragging = true;
    ctx.renderer.setSelection({ x: doc.x, y: doc.y, width: 0, height: 0 });
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const x = Math.min(this.start.x, doc.x);
    const y = Math.min(this.start.y, doc.y);
    const width = Math.abs(doc.x - this.start.x);
    const height = Math.abs(doc.y - this.start.y);
    ctx.renderer.setSelection({ x, y, width, height });
  }

  onPointerUp(pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return;
    this.dragging = false;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const x = Math.min(this.start.x, doc.x);
    const y = Math.min(this.start.y, doc.y);
    const width = Math.abs(doc.x - this.start.x);
    const height = Math.abs(doc.y - this.start.y);
    if (width < 2 || height < 2) {
      ctx.renderer.setSelection(null);
    } else {
      ctx.renderer.setSelection({ x, y, width, height });
    }
  }
}
