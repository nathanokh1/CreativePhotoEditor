import { LayerGraph } from "../layer-graph";
import { Command } from "./command";
import { History } from "./history";

/**
 * The CommandBus is the ONLY sanctioned path for mutating the LayerGraph.
 * It executes a Command against the graph and records it on the History Stack.
 */
export class CommandBus {
  constructor(
    private readonly graph: LayerGraph,
    private readonly history: History,
  ) {}

  dispatch(cmd: Command): void {
    cmd.execute(this.graph);
    this.history.push(cmd);
  }

  undo(): void {
    const cmd = this.history.takeUndo();
    if (cmd) cmd.undo(this.graph);
  }

  redo(): void {
    const cmd = this.history.takeRedo();
    if (cmd) cmd.execute(this.graph);
  }

  /** Jump the history to a given number of applied commands (undo/redo in bulk). */
  jumpTo(targetApplied: number): void {
    let steps = this.history.stepsTo(targetApplied);
    while (steps < 0) {
      this.undo();
      steps++;
    }
    while (steps > 0) {
      this.redo();
      steps--;
    }
  }

  getHistory(): History {
    return this.history;
  }

  getGraph(): LayerGraph {
    return this.graph;
  }
}
