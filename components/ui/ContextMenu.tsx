"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  /** Draw a divider above this item. */
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

/** Lightweight right-click menu, positioned at (x, y) and clamped to the viewport. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measure after the portal has mounted, then clamp fully inside the viewport
    // (so a menu opened near the bottom/right edge flips up/left instead of
    // being cut off).
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const nx = Math.min(x, window.innerWidth - rect.width - pad);
    const ny = Math.min(y, window.innerHeight - rect.height - pad);
    setPos({ x: Math.max(pad, nx), y: Math.max(pad, ny) });
  }, [x, y, mounted]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("contextmenu", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("contextmenu", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[100] max-h-[calc(100vh-16px)] min-w-[184px] animate-fade-in overflow-y-auto rounded-lg border border-panel-border bg-panel/98 py-1 shadow-panel backdrop-blur"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`}>
          {item.separator && <div className="my-1 h-px bg-panel-border" />}
          <button
            disabled={item.disabled}
            onClick={() => {
              if (item.disabled) return;
              item.onClick?.();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs",
              item.disabled
                ? "cursor-default text-ink-faint/50"
                : item.danger
                  ? "text-red-400 hover:bg-red-500/15"
                  : "text-ink-dim hover:bg-accent/15 hover:text-ink",
            )}
          >
            {item.icon && <span className="flex w-4 justify-center">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
