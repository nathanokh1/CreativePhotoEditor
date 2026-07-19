"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/state/editor-store";
import { CanvasViewport } from "./CanvasViewport";
import { LayersPanel } from "./LayersPanel";
import { OnboardingHints } from "./OnboardingHints";
import { PaintOptionsBar } from "./PaintOptionsBar";
import { SettingsPanel } from "./SettingsPanel";
import { TextOptionsBar } from "./TextOptionsBar";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { TransformOptionsBar } from "./TransformOptionsBar";
import { WandOptionsBar } from "./WandOptionsBar";
import { PenOptionsBar } from "./PenOptionsBar";

export function EditorShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const setTool = useEditor((s) => s.setTool);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const zoomIn = useEditor((s) => s.zoomIn);
  const zoomOut = useEditor((s) => s.zoomOut);
  const fitToView = useEditor((s) => s.fitToView);
  const saveProject = useEditor((s) => s.saveProject);
  const copy = useEditor((s) => s.copy);
  const cut = useEditor((s) => s.cut);
  const paste = useEditor((s) => s.paste);
  const nudge = useEditor((s) => s.nudge);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const deselect = useEditor((s) => s.deselect);
  const invertSelection = useEditor((s) => s.invertSelection);
  const deleteSelectionContents = useEditor((s) => s.deleteSelectionContents);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        void copy();
        return;
      }
      if (mod && e.key.toLowerCase() === "x") {
        e.preventDefault();
        void cut();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void (async () => {
          const engine = useEditor.getState().engine;
          if (!engine) return;
          const fromOs = await engine.pasteFromSystemClipboard();
          if (!fromOs) paste();
        })();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        deselect();
        return;
      }
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        useEditor.getState().selectAll();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        invertSelection();
        return;
      }
      if (mod) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        // With an active pixel selection, delete just the selected pixels.
        if (useEditor.getState().engine?.hasSelectionMask()) {
          void deleteSelectionContents();
          return;
        }
        const id = useEditor.getState().activeLayerId;
        if (id) deleteLayer(id);
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudge(dx, dy);
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("move");
          break;
        case "t":
          setTool("transform");
          break;
        case "m":
          setTool("select");
          break;
        case "l":
          setTool("lasso");
          break;
        case "w":
          setTool("wand");
          break;
        case "c":
          setTool("crop");
          break;
        case "b":
          setTool("brush");
          break;
        case "p":
          setTool("pencil");
          break;
        case "e":
          setTool("eraser");
          break;
        case "n":
          setTool("pen");
          break;
        case "enter":
          if (useEditor.getState().activeTool === "pen") {
            useEditor.getState().closePenPath();
          }
          break;
        case "k":
          setTool("clone");
          break;
        case "j":
          setTool("heal");
          break;
        case "h":
          setTool("hand");
          break;
        case "escape":
          if (useEditor.getState().activeTool === "pen") {
            useEditor.getState().clearPenPath();
          } else {
            useEditor.getState().engine?.clearSelection();
          }
          break;
        case "=":
        case "+":
          zoomIn();
          break;
        case "-":
          zoomOut();
          break;
        case "0":
          fitToView();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setTool,
    undo,
    redo,
    zoomIn,
    zoomOut,
    fitToView,
    saveProject,
    copy,
    cut,
    paste,
    nudge,
    deleteLayer,
    deselect,
    invertSelection,
    deleteSelectionContents,
  ]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-panel-sunken text-ink">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <TabBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <main className="relative min-w-0 flex-1">
          <CanvasViewport />
          <TransformOptionsBar />
          <PaintOptionsBar />
          <TextOptionsBar />
          <WandOptionsBar />
          <PenOptionsBar />
          <OnboardingHints />
        </main>
        <LayersPanel />
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
