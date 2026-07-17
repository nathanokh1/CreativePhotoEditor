import { Command } from "./command";

/**
 * In-memory History Stack (MVP). Holds executed Commands and supports
 * undo/redo. Depth is capped to avoid unbounded memory growth on long sessions.
 */
export class History {
  private past: Command[] = [];
  private future: Command[] = [];
  private readonly limit: number;
  private listeners = new Set<() => void>();

  constructor(limit = 100) {
    this.limit = limit;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  push(cmd: Command): void {
    this.past.push(cmd);
    if (this.past.length > this.limit) this.past.shift();
    // A fresh action invalidates the redo branch.
    this.future = [];
    this.notify();
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undoLabel(): string | null {
    return this.past.length ? this.past[this.past.length - 1].label : null;
  }

  redoLabel(): string | null {
    return this.future.length ? this.future[this.future.length - 1].label : null;
  }

  takeUndo(): Command | null {
    const cmd = this.past.pop();
    if (!cmd) return null;
    this.future.push(cmd);
    this.notify();
    return cmd;
  }

  takeRedo(): Command | null {
    const cmd = this.future.pop();
    if (!cmd) return null;
    this.past.push(cmd);
    this.notify();
    return cmd;
  }

  clear(): void {
    this.past = [];
    this.future = [];
    this.notify();
  }
}
