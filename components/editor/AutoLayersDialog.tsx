"use client";

import { useState } from "react";
import { Grid2x2, ScanSearch, X } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { cn } from "@/components/ui/cn";
import { Slider } from "@/components/ui/Slider";

interface AutoLayersDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AutoLayersDialog({ open, onClose }: AutoLayersDialogProps) {
  const autoLayers = useEditor((s) => s.autoLayers);
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const [mode, setMode] = useState<"regions" | "grid">("regions");
  const [rows, setRows] = useState(4);
  const [cols, setCols] = useState(3);
  const [threshold, setThreshold] = useState(32);
  const [separation, setSeparation] = useState(0);
  const [split, setSplit] = useState(true);
  const [hideSource, setHideSource] = useState(true);
  const [group, setGroup] = useState(true);
  const [result, setResult] = useState<string | null>(null);

  if (!open) return null;

  const run = async () => {
    setResult(null);
    const n = await autoLayers({ mode, rows, cols, threshold, separation, split, hideSource, group });
    setResult(n > 0 ? `Created ${n} layer${n === 1 ? "" : "s"}.` : "No regions detected — try lowering the threshold or use Grid mode.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg animate-fade-in rounded-2xl border border-panel-border bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Auto-Layers / Slice</h2>
            <p className="mt-0.5 text-xs text-ink-dim">
              Split the active layer into separate layers — no AI, runs on your device.
            </p>
          </div>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {!activeLayerId && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              Select a layer first (import or pick one in the Layers panel).
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("regions")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                mode === "regions"
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-panel-border bg-panel-sunken text-ink-dim hover:text-ink",
              )}
            >
              <ScanSearch size={16} /> Detect regions
            </button>
            <button
              onClick={() => setMode("grid")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm",
                mode === "grid"
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-panel-border bg-panel-sunken text-ink-dim hover:text-ink",
              )}
            >
              <Grid2x2 size={16} /> Even grid
            </button>
          </div>

          {mode === "regions" ? (
            <div>
              <div className="mb-1 flex justify-between text-[11px] text-ink-dim">
                <span>Background sensitivity</span>
                <span>{threshold}</span>
              </div>
              <Slider min={8} max={96} step={1} value={threshold} onChange={setThreshold} />
              <p className="mt-1 text-[11px] text-ink-faint">
                Higher = treats more near-background colors as separators. Good for grids of
                bordered cards (like note flashcards).
              </p>

              <div className="mb-1 mt-3 flex justify-between text-[11px] text-ink-dim">
                <span>Separation strength</span>
                <span>{separation}px</span>
              </div>
              <Slider min={0} max={4} step={1} value={separation} onChange={setSeparation} />
              <p className="mt-1 text-[11px] text-ink-faint">
                Leave at 0 for normal detection. Only raise it if separate items get merged into
                one layer — it erodes thin borders/lines that bridge touching boxes.
              </p>

              <label className="mt-3 flex items-center gap-2 text-xs text-ink-dim">
                <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
                Separate merged cells (recommended for grids)
              </label>
              <p className="mt-1 text-[11px] text-ink-faint">
                Measures the typical card size and splits any oversized blob into that many cells —
                recovers cards that got joined by a label, watermark, or touching border.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-ink-dim">
                Rows
                <input
                  type="number"
                  min={1}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-panel-border bg-panel-sunken px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
                />
              </label>
              <label className="block text-xs text-ink-dim">
                Columns
                <input
                  type="number"
                  min={1}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full rounded-lg border border-panel-border bg-panel-sunken px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
                />
              </label>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-ink-dim">
              <input type="checkbox" checked={hideSource} onChange={(e) => setHideSource(e.target.checked)} />
              Hide the original layer after slicing
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-dim">
              <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
              Put the new layers in a group
            </label>
          </div>

          {result && <p className="text-xs text-ink-dim">{result}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-panel-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-ink-dim hover:text-ink">
            Close
          </button>
          <button
            disabled={!activeLayerId}
            onClick={() => void run()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            Slice into layers
          </button>
        </div>
      </div>
    </div>
  );
}
