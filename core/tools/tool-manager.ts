import { HandTool } from "./hand-tool";
import { MoveTool } from "./move-tool";
import { SelectionRectTool } from "./selection-rect-tool";
import { PointerSample, Tool, ToolContext, ToolId } from "./tool";
import { TransformTool } from "./transform-tool";

/** Holds the registered Tools and routes pointer events to the active one. */
export class ToolManager {
  private tools = new Map<ToolId, Tool>();
  private activeId: ToolId;
  private transformTool: TransformTool;

  constructor(private ctx: ToolContext) {
    this.transformTool = new TransformTool();
    this.register(new MoveTool());
    this.register(this.transformTool);
    this.register(new SelectionRectTool());
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
    if (!this.tools.has(id)) return;
    this.activeId = id;
    const showHandles = id === "transform";
    this.ctx.renderer.setShowTransformHandles(showHandles);
    if (!showHandles) this.ctx.renderer.setCursorOverride(null);
  }

  setLockAspect(lock: boolean): void {
    this.transformTool.lockAspect = lock;
  }

  getLockAspect(): boolean {
    return this.transformTool.lockAspect;
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
