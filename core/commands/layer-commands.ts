import { BlendMode, Layer, LayerGraph, Transform } from "../layer-graph";
import { Command } from "./command";

/** Add an already-constructed Layer to the graph. */
export class AddLayerCommand implements Command {
  readonly label: string;
  private index?: number;

  constructor(private readonly layer: Layer) {
    this.label = `Add layer "${layer.name}"`;
  }

  execute(graph: LayerGraph): void {
    graph.addLayer(this.layer, this.index);
    this.index = graph.indexOf(this.layer.id);
  }

  undo(graph: LayerGraph): void {
    this.index = graph.indexOf(this.layer.id);
    graph.removeLayer(this.layer.id);
  }
}

/** Delete a layer, remembering its slot so undo restores order. */
export class DeleteLayerCommand implements Command {
  readonly label = "Delete layer";
  private removed?: Layer;
  private index = -1;

  constructor(private readonly layerId: string) {}

  execute(graph: LayerGraph): void {
    this.index = graph.indexOf(this.layerId);
    this.removed = graph.removeLayer(this.layerId);
  }

  undo(graph: LayerGraph): void {
    if (this.removed) graph.addLayer(this.removed, this.index);
  }
}

/** Move a layer by a delta. Undo applies the inverse delta. */
export class MoveLayerCommand implements Command {
  readonly label = "Move layer";

  constructor(
    private readonly layerId: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {}

  execute(graph: LayerGraph): void {
    graph.translate(this.layerId, this.dx, this.dy);
  }

  undo(graph: LayerGraph): void {
    graph.translate(this.layerId, -this.dx, -this.dy);
  }
}

/** Set a layer's full transform, capturing the previous one for undo. */
export class SetTransformCommand implements Command {
  readonly label = "Transform layer";
  private before?: Transform;

  constructor(
    private readonly layerId: string,
    private readonly after: Transform,
  ) {}

  execute(graph: LayerGraph): void {
    if (!this.before) {
      const layer = graph.getLayer(this.layerId);
      if (layer) this.before = { ...layer.transform };
    }
    graph.setTransform(this.layerId, this.after);
  }

  undo(graph: LayerGraph): void {
    if (this.before) graph.setTransform(this.layerId, this.before);
  }
}

/** Reorder a layer within the stack. */
export class ReorderLayerCommand implements Command {
  readonly label = "Reorder layer";
  private fromIndex = -1;

  constructor(
    private readonly layerId: string,
    private readonly toIndex: number,
  ) {}

  execute(graph: LayerGraph): void {
    this.fromIndex = graph.indexOf(this.layerId);
    graph.moveLayer(this.layerId, this.toIndex);
  }

  undo(graph: LayerGraph): void {
    graph.moveLayer(this.layerId, this.fromIndex);
  }
}

type LayerProps = Partial<Pick<Layer, "name" | "opacity" | "visible" | "blendMode" | "locked">>;

/** Generic property change (opacity, visibility, name, blend mode, lock). */
export class SetLayerPropsCommand implements Command {
  readonly label: string;
  private before: LayerProps = {};

  constructor(
    private readonly layerId: string,
    private readonly after: LayerProps,
    label = "Edit layer",
  ) {
    this.label = label;
  }

  execute(graph: LayerGraph): void {
    const layer = graph.getLayer(this.layerId);
    if (!layer) return;
    this.before = {};
    for (const key of Object.keys(this.after) as (keyof LayerProps)[]) {
      // Snapshot previous value for undo.
      (this.before as Record<string, unknown>)[key] = layer[key];
    }
    graph.updateLayer(this.layerId, this.after);
  }

  undo(graph: LayerGraph): void {
    graph.updateLayer(this.layerId, this.before);
  }
}

export type BlendModeValue = BlendMode;
