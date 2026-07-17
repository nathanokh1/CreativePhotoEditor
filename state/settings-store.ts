"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  /** Master toggle for the hover info tooltips across the app. */
  showTooltips: boolean;
  /** Delay in ms before a tooltip appears on hover. */
  tooltipDelay: number;
  /** Snap layer dragging to whole pixels. */
  pixelSnap: boolean;
  setShowTooltips: (v: boolean) => void;
  setTooltipDelay: (v: number) => void;
  setPixelSnap: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      showTooltips: true,
      tooltipDelay: 350,
      pixelSnap: true,
      setShowTooltips: (v) => set({ showTooltips: v }),
      setTooltipDelay: (v) => set({ tooltipDelay: v }),
      setPixelSnap: (v) => set({ pixelSnap: v }),
    }),
    { name: "cpe-settings" },
  ),
);
