"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSettings } from "@/state/settings-store";
import { cn } from "./cn";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Short title shown in bold. */
  label: string;
  /** Longer "what this does" description. This is the toggleable info layer. */
  description?: string;
  /** Optional shortcut hint, rendered as a key cap. */
  shortcut?: string;
  side?: Side;
  children: ReactNode;
  className?: string;
}

/**
 * Hover tooltip that surfaces both a label and a "what this button does"
 * description. The description layer is globally toggleable via Settings
 * (useSettings.showTooltips). When off, tooltips are suppressed entirely.
 */
export function Tooltip({
  label,
  description,
  shortcut,
  side = "bottom",
  children,
  className,
}: TooltipProps) {
  const showTooltips = useSettings((s) => s.showTooltips);
  const delay = useSettings((s) => s.tooltipDelay);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 10;
    let x = r.left + r.width / 2;
    let y = r.bottom + gap;
    if (side === "top") y = r.top - gap;
    if (side === "left") {
      x = r.left - gap;
      y = r.top + r.height / 2;
    }
    if (side === "right") {
      x = r.right + gap;
      y = r.top + r.height / 2;
    }
    setCoords({ x, y });
  };

  const onEnter = () => {
    if (!showTooltips) return;
    timer.current = setTimeout(() => {
      place();
      setOpen(true);
    }, delay);
  };

  const onLeave = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
  };

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const translate =
    side === "top"
      ? "translate(-50%, -100%)"
      : side === "bottom"
        ? "translate(-50%, 0)"
        : side === "left"
          ? "translate(-100%, -50%)"
          : "translate(0, -50%)";

  return (
    <div
      ref={wrapRef}
      className={cn("inline-flex", className)}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseDown={onLeave}
    >
      {children}
      {mounted &&
        open &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: coords.x, top: coords.y, transform: translate }}
            className="pointer-events-none fixed z-[100] max-w-[240px] animate-fade-in rounded-lg border border-panel-border bg-panel-raised/95 px-3 py-2 text-left shadow-panel backdrop-blur"
          >
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-ink">{label}</span>
              {shortcut && (
                <kbd className="rounded border border-panel-border bg-panel-sunken px-1.5 py-0.5 text-[10px] font-medium text-ink-dim">
                  {shortcut}
                </kbd>
              )}
            </div>
            {description && (
              <p className="mt-1 text-[12px] leading-snug text-ink-dim">{description}</p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
