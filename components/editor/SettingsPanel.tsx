"use client";

import { X } from "lucide-react";
import { useSettings } from "@/state/settings-store";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { cn } from "@/components/ui/cn";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-dim">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-panel-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const {
    showTooltips,
    tooltipDelay,
    pixelSnap,
    fitCanvasToFirstImport,
    lockAspectRatio,
    setShowTooltips,
    setTooltipDelay,
    setPixelSnap,
    setFitCanvasToFirstImport,
    setLockAspectRatio,
  } = useSettings();
  const setLockAspect = useEditor((s) => s.setLockAspect);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md animate-fade-in rounded-2xl border border-panel-border bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Settings</h2>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close settings">
            <X size={18} />
          </button>
        </div>

        <div className="divide-y divide-panel-border px-5 py-2">
          <Toggle
            label="Show info tooltips"
            description="Hover over any button to see what it does. Turn this off for a cleaner, distraction-free workspace."
            checked={showTooltips}
            onChange={setShowTooltips}
          />

          <div className={cn("py-3", !showTooltips && "pointer-events-none opacity-40")}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Tooltip delay</p>
              <span className="text-xs text-ink-dim">{tooltipDelay} ms</span>
            </div>
            <Slider
              aria-label="Tooltip delay"
              min={0}
              max={1000}
              step={50}
              value={tooltipDelay}
              onChange={(v) => setTooltipDelay(v)}
            />
          </div>

          <Toggle
            label="Fit canvas to first import"
            description="When you import the first image into an empty document, resize the canvas to match that image. Turn off to keep the default canvas size."
            checked={fitCanvasToFirstImport}
            onChange={setFitCanvasToFirstImport}
          />

          <Toggle
            label="Lock aspect ratio (Transform)"
            description="Corner handles keep proportions. Hold Shift while dragging to temporarily free-transform. Edge handles always stretch one axis."
            checked={lockAspectRatio}
            onChange={(v) => {
              setLockAspectRatio(v);
              setLockAspect(v);
            }}
          />

          <Toggle
            label="Snap to pixels"
            description="Keep layer positions aligned to whole pixels while moving."
            checked={pixelSnap}
            onChange={setPixelSnap}
          />
        </div>

        <div className="border-t border-panel-border px-5 py-3 text-center text-[11px] text-ink-faint">
          CreativePhotoEditor · free & open · your images never leave your device
        </div>
      </div>
    </div>
  );
}
