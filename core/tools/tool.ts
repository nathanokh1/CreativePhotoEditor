import { CommandBus } from "../commands";
import { LayerGraph } from "../layer-graph";
import { Renderer } from "../render";

/** Everything a Tool needs to translate pointer input into Commands. */
export interface ToolContext {
  graph: LayerGraph;
  bus: CommandBus;
  renderer: Renderer;
}

/** Normalized pointer sample in canvas-relative (CSS pixel) coordinates. */
export interface PointerSample {
  canvasX: number;
  canvasY: number;
  shiftKey: boolean;
  altKey: boolean;
}

export type ToolId =
  | "move"
  | "transform"
  | "hand"
  | "select"
  | "lasso"
  | "wand"
  | "crop"
  | "brush"
  | "pencil"
  | "eraser"
  | "pen"
  | "clone"
  | "heal";

/**
 * A Tool is a mode that decides what pointer input does on the Canvas. Exactly
 * one Tool is active at a time. Tools NEVER mutate the LayerGraph directly —
 * they dispatch Commands through the bus (live drag feedback goes through the
 * renderer's preview channel, which does not touch the graph).
 */
export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  readonly hint: string;
  readonly cursor: string;
  onPointerDown(pt: PointerSample, ctx: ToolContext): void;
  onPointerMove(pt: PointerSample, ctx: ToolContext): void;
  onPointerUp(pt: PointerSample, ctx: ToolContext): void;
}
