import { PenNode, PenPath } from "../file-io/pen";
import { PointerSample, Tool, ToolContext } from "./tool";

/** Distance (screen px) within which clicking the first anchor closes the path. */
const CLOSE_HIT_PX = 10;

/**
 * Pen — draw a bezier path point by point.
 *
 * - Click to drop a corner anchor.
 * - Click and drag to pull symmetric bezier handles (smooth point).
 * - Click the first anchor (or the options bar) to close the path.
 *
 * The path is stored on the tool; the Pen options bar reads it to stroke/fill
 * it to a new layer or convert it to a selection.
 */
export class PenTool implements Tool {
  readonly id = "pen" as const;
  readonly label = "Pen";
  readonly hint = "Click to add points, drag for curves, click the first point to close. (Enter to finish)";
  readonly cursor = "crosshair";

  private nodes: PenNode[] = [];
  private closed = false;
  private dragging = false;
  private cursor2: { x: number; y: number } | null = null;

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    if (this.closed) {
      // Starting a fresh path after one was finished.
      this.reset();
    }
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);

    // Clicking near the first anchor closes the path.
    if (this.nodes.length >= 2) {
      const first = this.nodes[0];
      const z = ctx.renderer.getViewport().zoom;
      const distPx = Math.hypot(first.x - doc.x, first.y - doc.y) * z;
      if (distPx <= CLOSE_HIT_PX) {
        this.closed = true;
        this.dragging = false;
        this.cursor2 = null;
        this.pushPreview(ctx);
        return;
      }
    }

    this.nodes.push({ x: doc.x, y: doc.y, inX: doc.x, inY: doc.y, outX: doc.x, outY: doc.y });
    this.dragging = true;
    this.pushPreview(ctx);
  }

  onPointerMove(pt: PointerSample, ctx: ToolContext): void {
    if (this.closed) return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    if (this.dragging && this.nodes.length > 0) {
      const node = this.nodes[this.nodes.length - 1];
      node.outX = doc.x;
      node.outY = doc.y;
      // Mirror handle for a smooth anchor.
      node.inX = node.x - (doc.x - node.x);
      node.inY = node.y - (doc.y - node.y);
    } else {
      this.cursor2 = doc;
    }
    this.pushPreview(ctx);
  }

  onPointerUp(_pt: PointerSample, ctx: ToolContext): void {
    this.dragging = false;
    this.pushPreview(ctx);
  }

  /** Current path, or null if there aren't enough points yet. */
  getPath(): PenPath | null {
    if (this.nodes.length < 2) return null;
    return { nodes: this.nodes.map((n) => ({ ...n })), closed: this.closed };
  }

  finish(ctx: ToolContext): void {
    if (this.nodes.length >= 2) {
      this.closed = false; // "finish" leaves the path open; close via first anchor
      this.cursor2 = null;
      this.pushPreview(ctx);
    }
  }

  close(ctx: ToolContext): void {
    if (this.nodes.length >= 2) {
      this.closed = true;
      this.cursor2 = null;
      this.pushPreview(ctx);
    }
  }

  reset(ctx?: ToolContext): void {
    this.nodes = [];
    this.closed = false;
    this.dragging = false;
    this.cursor2 = null;
    ctx?.renderer.setPenPreview(null);
  }

  private pushPreview(ctx: ToolContext): void {
    if (this.nodes.length === 0) {
      ctx.renderer.setPenPreview(null);
      return;
    }
    ctx.renderer.setPenPreview({
      nodes: this.nodes.map((n) => ({ ...n })),
      closed: this.closed,
      cursor: this.closed ? null : this.cursor2,
    });
  }
}
