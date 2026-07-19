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
  /**
   * When importing the first image into an empty Document, resize the canvas
   * to match the image dimensions.
   */
  fitCanvasToFirstImport: boolean;
  /** Corner handles keep aspect ratio unless Shift is held (Transform tool). */
  lockAspectRatio: boolean;
  /** Show lightweight grid guides on the canvas. */
  showGuides: boolean;
  setShowTooltips: (v: boolean) => void;
  setTooltipDelay: (v: number) => void;
  setPixelSnap: (v: boolean) => void;
  setFitCanvasToFirstImport: (v: boolean) => void;
  setLockAspectRatio: (v: boolean) => void;
  setShowGuides: (v: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      showTooltips: true,
      tooltipDelay: 350,
      pixelSnap: true,
      fitCanvasToFirstImport: true,
      lockAspectRatio: true,
      showGuides: false,
      setShowTooltips: (v) => set({ showTooltips: v }),
      setTooltipDelay: (v) => set({ tooltipDelay: v }),
      setPixelSnap: (v) => set({ pixelSnap: v }),
      setFitCanvasToFirstImport: (v) => set({ fitCanvasToFirstImport: v }),
      setLockAspectRatio: (v) => set({ lockAspectRatio: v }),
      setShowGuides: (v) => set({ showGuides: v }),
    }),
    { name: "cpe-settings" },
  ),
);
