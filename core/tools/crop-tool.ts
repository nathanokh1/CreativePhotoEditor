import { SetCanvasSizeCommand } from "../commands";
import { SetTransformCommand } from "../commands";
import { PointerSample, Tool, ToolContext } from "./tool";

/**
 * Document-level crop: drag a rectangle, release to resize the canvas to that
 * region and shift all layers so the crop origin becomes (0,0).
 */
export class CropTool implements Tool {
  readonly id = "crop" as const;
  readonly label = "Crop";
  readonly hint = "Drag a rectangle, then release to crop the document to that region. (C)";
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
    ctx.renderer.setSelection({
      x,
      y,
      width: Math.abs(doc.x - this.start.x),
      height: Math.abs(doc.y - this.start.y),
    });
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    if (!this.dragging) return;
    this.dragging = false;
    const sel = ctx.renderer.getSelection();
    ctx.renderer.setSelection(null);
    if (!sel || sel.width < 4 || sel.height < 4) return;

    const x = Math.round(sel.x);
    const y = Math.round(sel.y);
    const w = Math.max(1, Math.round(sel.width));
    const h = Math.max(1, Math.round(sel.height));

    // Shift every layer so the crop top-left becomes the new origin.
    for (const layer of ctx.graph.getLayersBottomUp()) {
      if (layer.type === "group") continue;
      ctx.bus.dispatch(
        new SetTransformCommand(layer.id, {
          ...layer.transform,
          x: layer.transform.x - x,
          y: layer.transform.y - y,
        }),
      );
    }
    ctx.bus.dispatch(new SetCanvasSizeCommand({ width: w, height: h }));
    ctx.renderer.fitToView();
  }
}
