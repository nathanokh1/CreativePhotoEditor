"use client";

import { useSettings } from "@/state/settings-store";
import { useEditor } from "@/state/editor-store";
import { cn } from "@/components/ui/cn";
import { Tooltip } from "@/components/ui/Tooltip";

/** Floating options shown while the Transform tool is active. */
export function TransformOptionsBar() {
  const activeTool = useEditor((s) => s.activeTool);
  const setLockAspect = useEditor((s) => s.setLockAspect);
  const fitCanvasToActiveLayer = useEditor((s) => s.fitCanvasToActiveLayer);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const lockAspectRatio = useSettings((s) => s.lockAspectRatio);

  if (activeTool !== "transform") return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-panel-border bg-panel/95 px-3 py-2 shadow-panel backdrop-blur">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Transform</span>
        <div className="h-4 w-px bg-panel-border" />
        <Tooltip
          label="Lock aspect ratio"
          description="Corner handles keep proportions. Hold Shift while dragging to temporarily free-transform."
          side="bottom"
        >
          <button
            onClick={() => setLockAspect(!lockAspectRatio)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs transition-colors",
              lockAspectRatio
                ? "bg-accent/20 text-ink"
                : "bg-panel-sunken text-ink-dim hover:text-ink",
            )}
          >
            {lockAspectRatio ? "Aspect locked" : "Free transform"}
          </button>
        </Tooltip>
        <Tooltip
          label="Fit canvas to layer"
          description="Resize the document canvas to match the active layer's current size."
          side="bottom"
        >
          <button
            disabled={!activeLayerId}
            onClick={fitCanvasToActiveLayer}
            className="rounded-md bg-panel-sunken px-2.5 py-1 text-xs text-ink-dim transition-colors hover:text-ink disabled:opacity-40"
          >
            Fit canvas
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
