"use client";

import { ButtonHTMLAttributes, forwardRef, ReactNode } from "react";
import { Tooltip } from "./Tooltip";
import { cn } from "./cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  description?: string;
  shortcut?: string;
  active?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/** Square icon button with a built-in info tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, description, shortcut, active, tooltipSide = "right", className, ...rest },
  ref,
) {
  return (
    <Tooltip label={label} description={description} shortcut={shortcut} side={tooltipSide}>
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "group relative flex h-10 w-10 items-center justify-center rounded-lg border text-ink-dim transition-all duration-150",
          "hover:-translate-y-[1px] hover:border-accent/60 hover:text-ink hover:shadow-glow",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
          "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-panel-border disabled:hover:shadow-none",
          active
            ? "border-accent/70 bg-accent/15 text-ink shadow-glow"
            : "border-transparent bg-panel-raised/60",
          className,
        )}
        {...rest}
      >
        {icon}
      </button>
    </Tooltip>
  );
});
