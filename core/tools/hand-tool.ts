import { PointerSample, Tool, ToolContext } from "./tool";

/** Pan the viewport by dragging. Does not touch the LayerGraph at all. */
export class HandTool implements Tool {
  readonly id = "hand" as const;
  readonly label = "Pan";
  readonly hint = "Drag to pan the canvas. Hold Space with any tool to pan too. (H)";
  readonly cursor = "grab";

  private panning = false;
  private start = { x: 0, y: 0 };
  private startView = { x: 0, y: 0 };

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    this.panning = true;
    this.start = { x: pt.canvasX, y: pt.canvasY };
    const v = ctx.renderer.getViewport();
    this.startView = { x: v.x, y: v.y };
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (!this.panning) return;
    ctx.renderer.setViewport({
      x: this.startView.x + (pt.canvasX - this.start.x),
      y: this.startView.y + (pt.canvasY - this.start.y),
    });
  }

  onPointerUp(): void {
    this.panning = false;
  }
}
