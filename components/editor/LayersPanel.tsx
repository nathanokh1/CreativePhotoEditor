"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Layers, Trash2 } from "lucide-react";
import { BlendMode } from "@/core";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/components/ui/cn";

const BLEND_MODES: BlendMode[] = ["normal", "multiply", "screen", "overlay"];

export function LayersPanel() {
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const selectLayer = useEditor((s) => s.selectLayer);
  const toggleVisibility = useEditor((s) => s.toggleVisibility);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const setOpacity = useEditor((s) => s.setOpacity);
  const setBlendMode = useEditor((s) => s.setBlendMode);
  const renameLayer = useEditor((s) => s.renameLayer);
  const reorderLayer = useEditor((s) => s.reorderLayer);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [liveOpacity, setLiveOpacity] = useState<{ id: string; v: number } | null>(null);

  const active = layers.find((l) => l.id === activeId);

  return (
    <div className="flex h-full w-72 flex-col border-l border-panel-border bg-panel">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <Layers size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-ink">Layers</h2>
        <span className="ml-auto text-xs text-ink-faint">{layers.length}</span>
      </div>

      {/* Active layer properties */}
      {active && (
        <div className="space-y-3 border-b border-panel-border px-4 py-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wide text-ink-faint">Opacity</span>
              <span className="text-[11px] text-ink-dim">
                {Math.round((liveOpacity?.id === active.id ? liveOpacity.v : active.opacity) * 100)}%
              </span>
            </div>
            <Slider
              aria-label="Layer opacity"
              value={liveOpacity?.id === active.id ? liveOpacity.v : active.opacity}
              onChange={(v) => {
                setLiveOpacity({ id: active.id, v });
                const r = useEditor.getState().engine?.getRenderer();
                const layer = useEditor.getState().engine?.graph.getLayer(active.id);
                // Live visual feedback without spamming the history stack.
                if (layer && r) {
                  layer.opacity = v;
                  r.clearPreview();
                }
              }}
              onCommit={(v) => {
                setLiveOpacity(null);
                setOpacity(active.id, v);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">Blend</span>
            <Tooltip
              label="Blend mode"
              description="How this layer's colors mix with the layers beneath it."
              side="left"
            >
              <select
                value={active.blendMode}
                onChange={(e) => setBlendMode(active.id, e.target.value as BlendMode)}
                className="rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-xs capitalize text-ink outline-none focus:border-accent/60"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Layer list (top-most first) */}
      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-ink-faint">
            No layers yet. Import an image to create your first layer.
          </p>
        )}
        <ul className="space-y-1">
          {layers.map((layer, index) => {
            const isActive = layer.id === activeId;
            return (
              <li
                key={layer.id}
                onClick={() => selectLayer(layer.id)}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors",
                  isActive
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent hover:border-panel-border hover:bg-panel-raised/50",
                )}
              >
                <Tooltip label={layer.visible ? "Hide layer" : "Show layer"} side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisibility(layer.id);
                    }}
                    className="text-ink-dim hover:text-ink"
                    aria-label="Toggle visibility"
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </Tooltip>

                {editingId === layer.id ? (
                  <input
                    autoFocus
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={() => {
                      if (draftName.trim()) renameLayer(layer.id, draftName.trim());
                      setEditingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (draftName.trim()) renameLayer(layer.id, draftName.trim());
                        setEditingId(null);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded border border-accent/50 bg-panel-sunken px-1.5 py-0.5 text-xs text-ink outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingId(layer.id);
                      setDraftName(layer.name);
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate text-xs",
                      layer.visible ? "text-ink" : "text-ink-faint line-through",
                    )}
                    title="Double-click to rename"
                  >
                    {layer.name}
                  </span>
                )}

                <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayer(layer.id, Math.max(0, index - 1));
                    }}
                    disabled={index === 0}
                    className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30"
                    aria-label="Move layer up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reorderLayer(layer.id, Math.min(layers.length - 1, index + 1));
                    }}
                    disabled={index === layers.length - 1}
                    className="p-0.5 text-ink-faint hover:text-ink disabled:opacity-30"
                    aria-label="Move layer down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteLayer(layer.id);
                    }}
                    className="p-0.5 text-ink-faint hover:text-red-400"
                    aria-label="Delete layer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
