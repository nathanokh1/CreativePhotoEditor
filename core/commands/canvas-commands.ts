import { CanvasSize, LayerGraph } from "../layer-graph";
import { Command } from "./command";

/** Resize the Document canvas. Used by first-import fit and manual resize. */
export class SetCanvasSizeCommand implements Command {
  readonly label = "Resize canvas";
  private before?: CanvasSize;

  constructor(private readonly after: CanvasSize) {}

  execute(graph: LayerGraph): void {
    if (!this.before) this.before = graph.getCanvasSize();
    graph.setCanvasSize(this.after);
  }

  undo(graph: LayerGraph): void {
    if (this.before) graph.setCanvasSize(this.before);
  }
}
