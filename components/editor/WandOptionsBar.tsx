"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/components/ui/cn";

/** Options bar for the Magic Wand / select-by-color tool. */
export function WandOptionsBar() {
  const activeTool = useEditor((s) => s.activeTool);
  const engine = useEditor((s) => s.engine);
  const setWandStyle = useEditor((s) => s.setWandStyle);
  const deselect = useEditor((s) => s.deselect);
  const selectAll = useEditor((s) => s.selectAll);
  const invertSelection = useEditor((s) => s.invertSelection);
  const deleteSelectionContents = useEditor((s) => s.deleteSelectionContents);
  const fillSelection = useEditor((s) => s.fillSelection);

  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(0);
  const [contiguous, setContiguous] = useState(true);
  const [fillColor, setFillColor] = useState("#ffffff");

  useEffect(() => {
    if (activeTool !== "wand" || !engine) return;
    const s = engine.getWandStyle();
    if (s) {
      setTolerance(s.tolerance);
      setFeather(s.feather);
      setContiguous(s.contiguous);
    }
  }, [activeTool, engine]);

  const isWand = activeTool === "wand";
  const isSelectionTool = isWand || activeTool === "lasso";
  if (!isSelectionTool) return null;

  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
      <div className="pointer-events-auto flex max-w-[min(94vw,820px)] flex-wrap items-center gap-3 rounded-xl border border-panel-border bg-panel/95 px-3 py-2 shadow-panel backdrop-blur">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {isWand ? "Wand" : "Select"}
        </span>

        {isWand && (
          <>
            <div className="flex items-center gap-1">
              <Seg active={contiguous} onClick={() => { setContiguous(true); setWandStyle({ contiguous: true }); }}>
                Contiguous
              </Seg>
              <Seg active={!contiguous} onClick={() => { setContiguous(false); setWandStyle({ contiguous: false }); }}>
                By color
              </Seg>
            </div>

            <div className="w-32">
              <div className="mb-0.5 flex justify-between text-[10px] text-ink-faint">
                <span>Tolerance</span>
                <span>{tolerance}</span>
              </div>
              <Slider min={0} max={128} step={1} value={tolerance} onChange={(v) => { setTolerance(v); setWandStyle({ tolerance: v }); }} />
            </div>

            <div className="w-24">
              <div className="mb-0.5 flex justify-between text-[10px] text-ink-faint">
                <span>Feather</span>
                <span>{feather}px</span>
              </div>
              <Slider min={0} max={40} step={1} value={feather} onChange={(v) => { setFeather(v); setWandStyle({ feather: v }); }} />
            </div>

            <div className="mx-1 h-6 w-px bg-panel-border" />
          </>
        )}

        <Btn onClick={selectAll}>All</Btn>
        <Btn onClick={invertSelection}>Invert</Btn>
        <Btn onClick={deselect}>Deselect</Btn>
        <Btn onClick={() => void deleteSelectionContents()}>Delete</Btn>

        <div className="flex items-center gap-1">
          <Btn onClick={() => void fillSelection(fillColor)}>Fill</Btn>
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            className="h-6 w-7 cursor-pointer rounded border border-panel-border bg-transparent"
            title="Fill color"
          />
        </div>
      </div>
    </div>
  );
}

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] transition-colors",
        active ? "border-accent/60 bg-accent/15 text-ink" : "border-panel-border bg-panel-sunken text-ink-dim hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-panel-border bg-panel-sunken px-2.5 py-1 text-xs text-ink-dim hover:border-accent/50 hover:text-ink"
    >
      {children}
    </button>
  );
}
