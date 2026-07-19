"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FilterKind } from "@/core";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/components/ui/cn";

const NEUTRAL = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  temperature: 0,
  tint: 0,
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
};

type Adj = typeof NEUTRAL;

const SLIDERS: { key: keyof Adj; label: string; min: number; max: number; step: number }[] = [
  { key: "exposure", label: "Exposure", min: -1, max: 1, step: 0.01 },
  { key: "brightness", label: "Brightness", min: -1, max: 1, step: 0.01 },
  { key: "contrast", label: "Contrast", min: -1, max: 1, step: 0.01 },
  { key: "saturation", label: "Saturation", min: -1, max: 1, step: 0.01 },
  { key: "hue", label: "Hue", min: -180, max: 180, step: 1 },
  { key: "temperature", label: "Temperature", min: -1, max: 1, step: 0.01 },
  { key: "tint", label: "Tint", min: -1, max: 1, step: 0.01 },
  { key: "blackPoint", label: "Black point", min: 0, max: 0.9, step: 0.01 },
  { key: "whitePoint", label: "White point", min: 0.1, max: 1, step: 0.01 },
  { key: "gamma", label: "Gamma", min: 0.2, max: 3, step: 0.01 },
];

const FILTERS: { kind: FilterKind; label: string }[] = [
  { kind: "grayscale", label: "B&W" },
  { kind: "sepia", label: "Sepia" },
  { kind: "invert", label: "Invert" },
  { kind: "blur", label: "Blur" },
  { kind: "sharpen", label: "Sharpen" },
  { kind: "vignette", label: "Vignette" },
];

export function AdjustmentsPanel() {
  const activeLayerId = useEditor((s) => s.activeLayerId);
  const applyAdjustments = useEditor((s) => s.applyAdjustments);
  const applyFilter = useEditor((s) => s.applyFilter);
  const [open, setOpen] = useState(false);
  const [adj, setAdj] = useState<Adj>(NEUTRAL);

  if (!activeLayerId) return null;

  const format = (key: keyof Adj, v: number) =>
    key === "hue" ? `${Math.round(v)}°` : key === "gamma" || key === "whitePoint" || key === "blackPoint" ? v.toFixed(2) : Math.round(v * 100);

  return (
    <div className="border-b border-panel-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-ink-faint hover:text-ink"
      >
        Adjust & Filters
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-3">
          {SLIDERS.map(({ key, label, min, max, step }) => (
            <div key={key}>
              <div className="mb-1 flex justify-between text-[11px] text-ink-dim">
                <span>{label}</span>
                <span>{format(key, adj[key])}</span>
              </div>
              <Slider
                min={min}
                max={max}
                step={step}
                value={adj[key]}
                onChange={(v) => setAdj((a) => ({ ...a, [key]: v }))}
              />
            </div>
          ))}

          <div className="flex gap-2">
            <button
              onClick={() => {
                void applyAdjustments(adj).then(() => setAdj(NEUTRAL));
              }}
              className="flex-1 rounded-md bg-accent/20 py-1.5 text-xs font-medium text-ink hover:bg-accent/30"
            >
              Apply to layer
            </button>
            <button
              onClick={() => setAdj(NEUTRAL)}
              className="rounded-md bg-panel-sunken px-3 py-1.5 text-xs text-ink-dim hover:text-ink"
            >
              Reset
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] text-ink-faint">Filters</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FILTERS.map(({ kind, label }) => (
                <button
                  key={kind}
                  onClick={() => void applyFilter(kind)}
                  className="rounded-md border border-panel-border bg-panel-sunken py-1.5 text-xs text-ink-dim hover:border-accent/50 hover:text-ink"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
