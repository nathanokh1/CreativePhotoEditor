import { HandTool } from "./hand-tool";
import { MoveTool } from "./move-tool";
import { PointerSample, Tool, ToolContext, ToolId } from "./tool";
import { TransformTool } from "./transform-tool";

/** Holds the registered Tools and routes pointer events to the active one. */
export class ToolManager {
  private tools = new Map<ToolId, Tool>();
  private activeId: ToolId;

  constructor(private ctx: ToolContext) {
    this.register(new MoveTool());
    this.register(new TransformTool());
    this.register(new HandTool());
    this.activeId = "move";
  }

  private register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  getActive(): Tool {
    return this.tools.get(this.activeId)!;
  }

  getActiveId(): ToolId {
    return this.activeId;
  }

  setActive(id: ToolId): void {
    if (this.tools.has(id)) this.activeId = id;
  }

  pointerDown(pt: PointerSample): void {
    this.getActive().onPointerDown(pt, this.ctx);
  }

  pointerMove(pt: PointerSample): void {
    this.getActive().onPointerMove(pt, this.ctx);
  }

  pointerUp(pt: PointerSample): void {
    this.getActive().onPointerUp(pt, this.ctx);
  }
}
