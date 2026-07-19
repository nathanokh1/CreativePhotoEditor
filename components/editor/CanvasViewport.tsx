"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Copy, Scissors, ClipboardPaste, Trash2 } from "lucide-react";
import { useEditor } from "@/state/editor-store";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";

/** Hosts the PixiJS canvas and translates DOM input into engine tool events. */
export function CanvasViewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const attachCanvas = useEditor((s) => s.attachCanvas);
  const importFiles = useEditor((s) => s.importFiles);
  const refresh = useEditor((s) => s.refresh);
  const ready = useEditor((s) => s.ready);
  const layerCount = useEditor((s) => s.layers.length);
  const copy = useEditor((s) => s.copy);
  const cut = useEditor((s) => s.cut);
  const paste = useEditor((s) => s.paste);
  const duplicateLayer = useEditor((s) => s.duplicateLayer);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const initialized = useRef(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const canvasMenuItems = useCallback((): ContextMenuItem[] => {
    const s = useEditor.getState();
    const active = s.layers.find((l) => l.id === s.activeLayerId);
    const hasLayer = !!active && active.type !== "group";
    return [
      { label: "Copy", icon: <Copy size={13} />, disabled: !hasLayer, onClick: () => void copy() },
      { label: "Cut", icon: <Scissors size={13} />, disabled: !hasLayer, onClick: () => void cut() },
      { label: "Paste", icon: <ClipboardPaste size={13} />, onClick: () => paste() },
      { label: "Duplicate", icon: <Copy size={13} />, disabled: !active, separator: true, onClick: () => active && void duplicateLayer(active.id) },
      { label: "Delete", icon: <Trash2 size={13} />, danger: true, disabled: !active, onClick: () => active && deleteLayer(active.id) },
    ];
  }, [copy, cut, paste, duplicateLayer, deleteLayer]);

  useEffect(() => {
    if (initialized.current || !canvasRef.current) return;
    initialized.current = true;
    void attachCanvas(canvasRef.current);
  }, [attachCanvas]);

  // Keep the Pixi renderer sized to its container.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const engine = useEditor.getState().engine;
      const r = engine?.getRenderer();
      if (r && wrap.clientWidth > 0) r.resize(wrap.clientWidth, wrap.clientHeight);
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  const toCanvasPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const engine = useEditor.getState().engine;
      if (!engine) return;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      const p = toCanvasPoint(e);
      engine.pointerDown({ canvasX: p.x, canvasY: p.y, shiftKey: e.shiftKey, altKey: e.altKey });
    },
    [toCanvasPoint],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const engine = useEditor.getState().engine;
      if (!engine) return;
      const p = toCanvasPoint(e);
      engine.pointerMove({ canvasX: p.x, canvasY: p.y, shiftKey: e.shiftKey, altKey: e.altKey });
    },
    [toCanvasPoint],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const engine = useEditor.getState().engine;
      if (!engine) return;
      const p = toCanvasPoint(e);
      engine.pointerUp({ canvasX: p.x, canvasY: p.y, shiftKey: e.shiftKey, altKey: e.altKey });
      refresh();
    },
    [toCanvasPoint, refresh],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => {
      const engine = useEditor.getState().engine;
      if (!engine) return;
      const p = toCanvasPoint(e);
      engine.pointerUp({ canvasX: p.x, canvasY: p.y, shiftKey: e.shiftKey, altKey: e.altKey });
      refresh();
    },
    [toCanvasPoint, refresh],
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const engine = useEditor.getState().engine;
    if (!engine) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    engine.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    useEditor.getState().refresh();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files?.length) void importFiles(e.dataTransfer.files);
    },
    [importFiles],
  );

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden bg-panel-sunken"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => {
          // End stroke if the pointer leaves while captured buttons are down.
          if (e.buttons === 0) return;
          onPointerUp(e);
        }}
        onWheel={onWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
      />

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={canvasMenuItems()} onClose={() => setMenu(null)} />
      )}

      {ready && layerCount === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-panel-border bg-panel-raised/60 text-accent">
            <ImagePlus size={30} />
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Drop an image to start</p>
            <p className="text-xs text-ink-dim">or use Import in the top bar · PNG, JPG, WebP</p>
          </div>
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed border-accent/70 bg-accent/5" />
      )}
    </div>
  );
}
