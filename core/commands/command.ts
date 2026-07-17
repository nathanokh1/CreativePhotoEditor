import { LayerGraph } from "../layer-graph";

/**
 * A Command is an undoable unit of work. Every mutation to the LayerGraph is
 * expressed as a Command so that undo/redo is a first-class part of the model,
 * not a bolt-on. See ARCHITECTURE.md §Command System.
 */
export interface Command {
  /** Human-readable label, used in UI history / debugging. */
  readonly label: string;
  execute(graph: LayerGraph): void;
  undo(graph: LayerGraph): void;
}
