import { combineMask, featherMask, magicWandMask } from "../file-io/selection";
import { PointerSample, Tool, ToolContext } from "./tool";

export interface WandStyle {
  /** Color match tolerance 0..255 (euclidean RGBA distance). */
  tolerance: number;
  /** Edge softening radius in px (0 = crisp). */
  feather: number;
  /** true = flood-fill connected region (wand); false = whole-image by color. */
  contiguous: boolean;
}

export const DEFAULT_WAND_STYLE: WandStyle = {
  tolerance: 32,
  feather: 0,
  contiguous: true,
};

/**
 * Magic wand / select-by-color. Click to select pixels of the active layer that
 * match the clicked color; Shift adds, Alt/Option subtracts. Produces a pixel
 * selection mask (doc-space) that Cut/Copy/Delete/Fill honour.
 */
export class MagicWandTool implements Tool {
  readonly id = "wand" as const;
  readonly label = "Magic wand";
  readonly hint = "Click to select by color. Shift = add, Alt = subtract. (W)";
  readonly cursor = "crosshair";

  constructor(private getStyle: () => WandStyle) {}

  onPointerDown(pt: PointerSample, ctx: ToolContext): void {
    void this.run(pt, ctx);
  }

  onPointerMove(): void {}
  onPointerUp(): void {}

  private async run(pt: PointerSample, ctx: ToolContext): Promise<void> {
    const layer = ctx.graph.getActiveLayer();
    if (!layer || layer.type === "group") return;
    const doc = ctx.renderer.screenToDocument(pt.canvasX, pt.canvasY);
    const canvas = await ctx.renderer.extractLayerCanvas(layer.id);
    const c2d = canvas.getContext("2d", { willReadFrequently: true });
    if (!c2d) return;
    const img = c2d.getImageData(0, 0, canvas.width, canvas.height);

    const style = this.getStyle();
    let mask = magicWandMask(img, doc.x, doc.y, style.tolerance, style.contiguous);
    if (style.feather > 0) mask = featherMask(mask, style.feather);

    const existing = ctx.renderer.getSelectionMask();
    if (existing && existing.width === mask.width && existing.height === mask.height) {
      if (pt.shiftKey) {
        combineMask(existing, mask, "add");
        ctx.renderer.setSelectionMask({ ...existing });
        return;
      }
      if (pt.altKey) {
        combineMask(existing, mask, "subtract");
        ctx.renderer.setSelectionMask({ ...existing });
        return;
      }
    }
    ctx.renderer.setSelectionMask(mask);
  }
}
