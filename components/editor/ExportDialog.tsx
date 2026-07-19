"use client";

import { useState } from "react";
import { X, Image as ImageIcon, Layers as LayersIcon } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { cn } from "@/components/ui/cn";

type Mode = "flatten" | "layers";
type Format = "png" | "jpeg" | "webp";
type Bg = "transparent" | string;

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

const SCALES = [0.5, 1, 2, 3];

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const exportAs = useEditor((s) => s.exportAs);
  const exportLayers = useEditor((s) => s.exportLayers);

  const [mode, setMode] = useState<Mode>("flatten");
  const [format, setFormat] = useState<Format>("png");
  const [scale, setScale] = useState(1);
  const [quality, setQuality] = useState(0.92);
  const [bg, setBg] = useState<Bg>("transparent");
  const [trimToContent, setTrimToContent] = useState(true);
  const [visibleOnly, setVisibleOnly] = useState(false);

  if (!open) return null;

  // JPEG can't be transparent — force an opaque backdrop for the color picker.
  const noAlpha = format === "jpeg";
  const effectiveBg: Bg = noAlpha && bg === "transparent" ? "#ffffff" : bg;

  const run = () => {
    const background = effectiveBg;
    if (mode === "flatten") {
      void exportAs(format, { scale, quality: format === "png" ? 1 : quality, background });
    } else {
      void exportLayers(format, {
        scale,
        quality: format === "png" ? 1 : quality,
        background,
        trimToContent,
        visibleOnly,
      });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md animate-fade-in rounded-2xl border border-panel-border bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">Export</h2>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Mode */}
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              active={mode === "flatten"}
              icon={<ImageIcon size={16} />}
              title="Single image"
              subtitle="Flatten all visible layers"
              onClick={() => setMode("flatten")}
            />
            <ModeCard
              active={mode === "layers"}
              icon={<LayersIcon size={16} />}
              title="Each layer"
              subtitle="Separate files in a .zip"
              onClick={() => setMode("layers")}
            />
          </div>

          {/* Format */}
          <div>
            <p className="mb-1.5 text-xs text-ink-dim">Format</p>
            <div className="flex gap-2">
              {(["png", "jpeg", "webp"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-xs uppercase",
                    format === f
                      ? "border-accent/60 bg-accent/15 text-ink"
                      : "border-panel-border bg-panel-sunken text-ink-dim hover:text-ink",
                  )}
                >
                  {f === "jpeg" ? "jpg" : f}
                </button>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div>
            <p className="mb-1.5 text-xs text-ink-dim">Scale</p>
            <div className="flex gap-2">
              {SCALES.map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-1.5 text-xs",
                    scale === s
                      ? "border-accent/60 bg-accent/15 text-ink"
                      : "border-panel-border bg-panel-sunken text-ink-dim hover:text-ink",
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          {format !== "png" && (
            <label className="block text-xs text-ink-dim">
              Quality · <span className="text-ink">{Math.round(quality * 100)}%</span>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="mt-1 w-full"
              />
            </label>
          )}

          {/* Background */}
          <div>
            <p className="mb-1.5 text-xs text-ink-dim">Background</p>
            <div className="flex items-center gap-2">
              <button
                disabled={noAlpha}
                onClick={() => setBg("transparent")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  bg === "transparent" && !noAlpha
                    ? "bg-accent/20 text-ink"
                    : "bg-panel-sunken text-ink-dim",
                  noAlpha && "cursor-not-allowed opacity-40",
                )}
              >
                Transparent
              </button>
              <button
                onClick={() => setBg("#ffffff")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  effectiveBg === "#ffffff" ? "bg-accent/20 text-ink" : "bg-panel-sunken text-ink-dim",
                )}
              >
                White
              </button>
              <button
                onClick={() => setBg("#000000")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  effectiveBg === "#000000" ? "bg-accent/20 text-ink" : "bg-panel-sunken text-ink-dim",
                )}
              >
                Black
              </button>
              <input
                type="color"
                value={effectiveBg === "transparent" ? "#ffffff" : effectiveBg}
                onChange={(e) => setBg(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-panel-border bg-transparent"
                aria-label="Custom background color"
              />
            </div>
            {noAlpha && (
              <p className="mt-1 text-[10px] text-ink-faint">JPG has no transparency — a solid color is required.</p>
            )}
          </div>

          {/* Per-layer options */}
          {mode === "layers" && (
            <div className="space-y-2 rounded-lg border border-panel-border bg-panel-sunken/60 p-3">
              <Toggle
                checked={trimToContent}
                onChange={setTrimToContent}
                label="Resize each file to the layer's content"
                hint="Crops away empty space so each object exports at its own size."
              />
              <Toggle
                checked={visibleOnly}
                onChange={setVisibleOnly}
                label="Visible layers only"
                hint="Skip hidden layers."
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-panel-border px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-ink-dim hover:text-ink">
            Cancel
          </button>
          <button
            onClick={run}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-accent/60 bg-accent/10"
          : "border-panel-border bg-panel-sunken hover:border-panel-border/80",
      )}
    >
      <span className={cn("flex items-center gap-2 text-sm", active ? "text-ink" : "text-ink-dim")}>
        {icon}
        {title}
      </span>
      <span className="text-[11px] text-ink-faint">{subtitle}</span>
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-accent"
      />
      <span>
        <span className="block text-xs text-ink">{label}</span>
        {hint && <span className="block text-[10px] text-ink-faint">{hint}</span>}
      </span>
    </label>
  );
}
