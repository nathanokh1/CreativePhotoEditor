"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { cn } from "@/components/ui/cn";

const PRESETS: { label: string; width: number; height: number }[] = [
  { label: "HD 16:9", width: 1920, height: 1080 },
  { label: "Square", width: 1080, height: 1080 },
  { label: "Portrait 4:5", width: 1080, height: 1350 },
  { label: "Story 9:16", width: 1080, height: 1920 },
  { label: "A4 @150dpi", width: 1240, height: 1754 },
  { label: "Web default", width: 1280, height: 720 },
];

interface NewDocumentDialogProps {
  open: boolean;
  onClose: () => void;
}

export function NewDocumentDialog({ open, onClose }: NewDocumentDialogProps) {
  const newDocument = useEditor((s) => s.newDocument);
  const [name, setName] = useState("Untitled");
  const [width, setWidth] = useState(1280);
  const [height, setHeight] = useState(720);
  const [background, setBackground] = useState<"transparent" | string>("transparent");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg animate-fade-in rounded-2xl border border-panel-border bg-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <h2 className="text-base font-semibold text-ink">New document</h2>
          <button onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block text-xs text-ink-dim">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-panel-border bg-panel-sunken px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-ink-dim">
              Width
              <input
                type="number"
                min={1}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-panel-border bg-panel-sunken px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
              />
            </label>
            <label className="block text-xs text-ink-dim">
              Height
              <input
                type="number"
                min={1}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-panel-border bg-panel-sunken px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
              />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs text-ink-dim">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setWidth(p.width);
                    setHeight(p.height);
                  }}
                  className="rounded-md border border-panel-border bg-panel-sunken px-2.5 py-1 text-xs text-ink-dim hover:border-accent/50 hover:text-ink"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs text-ink-dim">Background</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBackground("transparent")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs",
                  background === "transparent"
                    ? "bg-accent/20 text-ink"
                    : "bg-panel-sunken text-ink-dim",
                )}
              >
                Transparent
              </button>
              <input
                type="color"
                value={background === "transparent" ? "#181a1f" : background}
                onChange={(e) => setBackground(e.target.value)}
                className="h-7 w-10 cursor-pointer rounded border border-panel-border bg-transparent"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-panel-border px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-ink-dim hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              void newDocument({ name, width, height, background });
              onClose();
            }}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
