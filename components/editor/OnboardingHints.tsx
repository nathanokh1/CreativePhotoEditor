"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "cpe-onboarding-dismissed";

export function OnboardingHints() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 w-[min(420px,92vw)] -translate-x-1/2">
      <div className="pointer-events-auto animate-fade-in rounded-2xl border border-panel-border bg-panel/95 p-4 shadow-panel backdrop-blur">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Quick start</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-dim">
              Import or drop an image. Use <kbd className="rounded bg-panel-sunken px-1">V</kbd> to
              move, <kbd className="rounded bg-panel-sunken px-1">T</kbd> to transform,{" "}
              <kbd className="rounded bg-panel-sunken px-1">B</kbd> to paint. Hover any button for
              tips — toggle them in Settings.
            </p>
          </div>
          <button
            aria-label="Dismiss"
            className="text-ink-dim hover:text-ink"
            onClick={() => {
              try {
                localStorage.setItem(STORAGE_KEY, "1");
              } catch {
                /* ignore */
              }
              setOpen(false);
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
