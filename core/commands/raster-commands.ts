import { Layer, RasterSource } from "../layer-graph";
import { Command } from "./command";

/** Replace a layer's raster bitmap (paint strokes, adjustments, erase, etc.). */
export class ReplaceLayerSourceCommand implements Command {
  readonly label: string;
  private before?: RasterSource;

  constructor(
    private readonly layerId: string,
    private readonly after: RasterSource,
    label = "Edit pixels",
  ) {
    this.label = label;
  }

  execute(graph: LayerGraphLike): void {
    const layer = graph.getLayer(this.layerId);
    if (!layer) return;
    if (!this.before) this.before = layer.source;
    graph.replaceLayerSource(this.layerId, this.after);
  }

  undo(graph: LayerGraphLike): void {
    if (this.before) graph.replaceLayerSource(this.layerId, this.before);
  }
}

/** Set or clear a layer's mask bitmap (add/edit/remove mask) — undoable. */
export class SetLayerMaskCommand implements Command {
  readonly label: string;
  private before?: RasterSource | null;
  private captured = false;

  constructor(
    private readonly layerId: string,
    private readonly after: RasterSource | null,
    label = "Edit mask",
  ) {
    this.label = label;
  }

  execute(graph: MaskGraphLike): void {
    const layer = graph.getLayer(this.layerId);
    if (!layer) return;
    if (!this.captured) {
      this.before = layer.mask ?? null;
      this.captured = true;
    }
    graph.updateLayer(this.layerId, { mask: this.after, maskEnabled: true });
  }

  undo(graph: MaskGraphLike): void {
    graph.updateLayer(this.layerId, { mask: this.before ?? null });
  }
}

interface MaskGraphLike {
  getLayer(id: string): Layer | undefined;
  updateLayer(id: string, patch: Partial<Pick<Layer, "mask" | "maskEnabled">>): void;
}

export interface TextLayerSnapshot {
  source: RasterSource;
  text: string;
  fontSize: number;
  fontFamily: string;
  fillColor: string;
  name: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

/** Update text content + re-rasterize in one undoable step. */
export class UpdateTextLayerCommand implements Command {
  readonly label = "Edit text";
  private before?: TextLayerSnapshot;

  constructor(
    private readonly layerId: string,
    private readonly after: TextLayerSnapshot,
  ) {}

  execute(graph: TextGraphLike): void {
    const layer = graph.getLayer(this.layerId);
    if (!layer) return;
    if (!this.before) {
      this.before = {
        source: layer.source,
        text: layer.text ?? "Text",
        fontSize: layer.fontSize ?? 48,
        fontFamily: layer.fontFamily ?? "Inter, sans-serif",
        fillColor: layer.fillColor ?? "#ffffff",
        name: layer.name,
        bold: layer.bold,
        italic: layer.italic,
        align: layer.align,
        strokeColor: layer.strokeColor,
        strokeWidth: layer.strokeWidth,
        shadowColor: layer.shadowColor,
        shadowBlur: layer.shadowBlur,
      };
    }
    graph.replaceLayerSource(this.layerId, this.after.source);
    graph.updateLayer(this.layerId, this.textProps(this.after));
  }

  undo(graph: TextGraphLike): void {
    if (!this.before) return;
    graph.replaceLayerSource(this.layerId, this.before.source);
    graph.updateLayer(this.layerId, this.textProps(this.before));
  }

  private textProps(s: TextLayerSnapshot) {
    return {
      text: s.text,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      fillColor: s.fillColor,
      name: s.name,
      bold: s.bold,
      italic: s.italic,
      align: s.align,
      strokeColor: s.strokeColor,
      strokeWidth: s.strokeWidth,
      shadowColor: s.shadowColor,
      shadowBlur: s.shadowBlur,
    };
  }
}

interface LayerGraphLike {
  getLayer(id: string): Layer | undefined;
  replaceLayerSource(id: string, source: RasterSource): void;
}

interface TextGraphLike extends LayerGraphLike {
  updateLayer(
    id: string,
    patch: Partial<
      Pick<
        Layer,
        | "text"
        | "fontSize"
        | "fontFamily"
        | "fillColor"
        | "name"
        | "bold"
        | "italic"
        | "align"
        | "strokeColor"
        | "strokeWidth"
        | "shadowColor"
        | "shadowBlur"
      >
    >,
  ): void;
}
