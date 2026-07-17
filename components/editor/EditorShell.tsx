"use client";

import { useEffect, useState } from "react";
import { useEditor } from "@/state/editor-store";
import { CanvasViewport } from "./CanvasViewport";
import { LayersPanel } from "./LayersPanel";
import { SettingsPanel } from "./SettingsPanel";
import { Toolbar } from "./Toolbar";
import { TopBar } from "./TopBar";
import { TransformOptionsBar } from "./TransformOptionsBar";

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
        paste();
        return;
      }
      if (mod) return;
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
        case "h":
          setTool("hand");
          break;
        case "escape":
          useEditor.getState().engine?.clearSelection();
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
  }, [setTool, undo, redo, zoomIn, zoomOut, fitToView, saveProject, copy, cut, paste]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-panel-sunken text-ink">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <main className="relative min-w-0 flex-1">
          <CanvasViewport />
          <TransformOptionsBar />
        </main>
        <LayersPanel />
      </div>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
