"use client";

import { useState } from "react";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/components/ui/cn";

/** Options bar for the Pen tool: stroke/fill a path, or turn it into a selection. */
export function PenOptionsBar() {
  const activeTool = useEditor((s) => s.activeTool);
  const penHasPath = useEditor((s) => s.penHasPath);
  const penClosed = useEditor((s) => s.penClosed);
  const rasterizePenPath = useEditor((s) => s.rasterizePenPath);
  const penPathToSelection = useEditor((s) => s.penPathToSelection);
  const closePenPath = useEditor((s) => s.closePenPath);
  const clearPenPath = useEditor((s) => s.clearPenPath);

  const [stroke, setStroke] = useState(true);
  const [fill, setFill] = useState(false);
  const [strokeColor, setStrokeColor] = useState("#ffffff");
  const [fillColor, setFillColor] = useState("#6366f1");
  const [strokeWidth, setStrokeWidth] = useState(4);

  if (activeTool !== "pen") return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[min(94vw,860px)] flex-wrap items-center gap-3 rounded-xl border border-panel-border bg-panel/95 px-3 py-2 shadow-panel backdrop-blur">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Pen</span>

        {!penHasPath ? (
          <span className="text-[11px] text-ink-dim">
            Click to add points · drag for curves · click the first point to close
          </span>
        ) : (
          <>
            <label className="flex items-center gap-1.5 text-[11px] text-ink-dim">
              <input type="checkbox" checked={stroke} onChange={(e) => setStroke(e.target.checked)} />
              Stroke
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                className="h-5 w-6 cursor-pointer rounded border border-panel-border bg-transparent"
              />
            </label>

            <div className="flex w-28 items-center gap-2">
              <span className="text-[10px] text-ink-faint">W</span>
              <Slider min={1} max={60} step={1} value={strokeWidth} onChange={setStrokeWidth} />
              <span className="w-6 text-[10px] text-ink-faint">{strokeWidth}</span>
            </div>

            <label className="flex items-center gap-1.5 text-[11px] text-ink-dim">
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} />
              Fill
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="h-5 w-6 cursor-pointer rounded border border-panel-border bg-transparent"
              />
            </label>

            <div className="mx-1 h-6 w-px bg-panel-border" />

            {!penClosed && (
              <Btn onClick={closePenPath}>Close path</Btn>
            )}
            <Btn
              accent
              onClick={() =>
                void rasterizePenPath({ stroke, strokeColor, strokeWidth, fill, fillColor })
              }
            >
              Rasterize
            </Btn>
            <Btn onClick={penPathToSelection}>To selection</Btn>
            <Btn onClick={clearPenPath}>Clear</Btn>
          </>
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px]",
        accent
          ? "border-accent bg-accent/20 text-ink hover:bg-accent/30"
          : "border-panel-border bg-panel-sunken text-ink-dim hover:border-accent/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
