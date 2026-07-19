"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  FolderOpen,
  Layers,
  Lock,
  Trash2,
  Unlock,
  SquarePlus,
  Paintbrush,
  Check,
  X,
  ChevronsDownUp,
  Scissors,
  ClipboardPaste,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { BlendMode } from "@/core";
import { useEditor } from "@/state/editor-store";
import { Slider } from "@/components/ui/Slider";
import { Tooltip } from "@/components/ui/Tooltip";
import { ContextMenu, ContextMenuItem } from "@/components/ui/ContextMenu";
import { cn } from "@/components/ui/cn";
import { AdjustmentsPanel } from "./AdjustmentsPanel";

const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
];

export function LayersPanel() {
  const layers = useEditor((s) => s.layers);
  const activeId = useEditor((s) => s.activeLayerId);
  const selectedLayerIds = useEditor((s) => s.selectedLayerIds);
  const selectLayer = useEditor((s) => s.selectLayer);
  const toggleVisibility = useEditor((s) => s.toggleVisibility);
  const toggleLock = useEditor((s) => s.toggleLock);
  const deleteLayer = useEditor((s) => s.deleteLayer);
  const duplicateLayer = useEditor((s) => s.duplicateLayer);
  const groupSelectedLayers = useEditor((s) => s.groupSelectedLayers);
  const ungroupLayer = useEditor((s) => s.ungroupLayer);
  const setOpacity = useEditor((s) => s.setOpacity);
  const setBlendMode = useEditor((s) => s.setBlendMode);
  const renameLayer = useEditor((s) => s.renameLayer);
  const reorderLayer = useEditor((s) => s.reorderLayer);
  const addLayerMask = useEditor((s) => s.addLayerMask);
  const removeLayerMask = useEditor((s) => s.removeLayerMask);
  const applyLayerMask = useEditor((s) => s.applyLayerMask);
  const setMaskEnabled = useEditor((s) => s.setMaskEnabled);
  const setMaskEditTarget = useEditor((s) => s.setMaskEditTarget);
  const setClip = useEditor((s) => s.setClip);
  const maskEditLayerId = useEditor((s) => s.maskEditLayerId);
  const copy = useEditor((s) => s.copy);
  const cut = useEditor((s) => s.cut);
  const paste = useEditor((s) => s.paste);

  const [menu, setMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);

  const openMenu = (e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Keep an existing multi-selection if right-clicking inside it (so "Group"
    // groups all of them); otherwise select just the clicked layer.
    const sel = selectedLayerIds;
    if (!(sel.length > 1 && sel.includes(layerId))) {
      selectLayer(layerId, { additive: false });
    }
    setMenu({ x: e.clientX, y: e.clientY, layerId });
  };

  const menuItems = (): ContextMenuItem[] => {
    if (!menu) return [];
    const layer = layers.find((l) => l.id === menu.layerId);
    if (!layer) return [];
    const uiIndex = layers.findIndex((l) => l.id === menu.layerId);
    const isGroup = layer.type === "group";
    const multi = selectedLayerIds.length > 1;
    return [
      { label: "Duplicate", icon: <Copy size={13} />, onClick: () => void duplicateLayer(layer.id) },
      { label: "Copy", icon: <Copy size={13} />, disabled: isGroup, onClick: () => void copy() },
      { label: "Cut", icon: <Scissors size={13} />, disabled: isGroup, onClick: () => void cut() },
      { label: "Paste", icon: <ClipboardPaste size={13} />, onClick: () => paste() },
      { label: "Bring to front", icon: <ArrowUpToLine size={13} />, separator: true, disabled: uiIndex <= 0, onClick: () => reorderLayer(layer.id, 0) },
      { label: "Bring forward", icon: <ArrowUp size={13} />, disabled: uiIndex <= 0, onClick: () => reorderLayer(layer.id, uiIndex - 1) },
      { label: "Send backward", icon: <ArrowDown size={13} />, disabled: uiIndex >= layers.length - 1, onClick: () => reorderLayer(layer.id, uiIndex + 1) },
      { label: "Send to back", icon: <ArrowDownToLine size={13} />, disabled: uiIndex >= layers.length - 1, onClick: () => reorderLayer(layer.id, layers.length - 1) },
      ...(!isGroup
        ? [{
            label: multi ? `Group ${selectedLayerIds.length} layers` : "Group into folder",
            icon: <FolderPlus size={13} />,
            separator: true,
            onClick: () => void groupSelectedLayers(),
          } as ContextMenuItem]
        : []),
      ...(isGroup
        ? [{ label: "Ungroup", icon: <FolderOpen size={13} />, separator: true, onClick: () => ungroupLayer(layer.id) } as ContextMenuItem]
        : []),
      ...(!isGroup && !layer.hasMask
        ? [{ label: "Add mask", separator: true, onClick: () => void addLayerMask("reveal") } as ContextMenuItem]
        : []),
      ...(!isGroup && layer.hasMask
        ? [{ label: "Delete mask", separator: true, onClick: () => removeLayerMask() } as ContextMenuItem]
        : []),
      { label: layer.visible ? "Hide" : "Show", separator: true, onClick: () => toggleVisibility(layer.id) },
      { label: layer.locked ? "Unlock" : "Lock", onClick: () => toggleLock(layer.id) },
      { label: "Delete", icon: <Trash2 size={13} />, danger: true, separator: true, onClick: () => deleteLayer(layer.id) },
    ];
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [liveOpacity, setLiveOpacity] = useState<{ id: string; v: number } | null>(null);

  // Layer drag-to-reorder. `dragId` is the row being dragged; `dropIns` is the
  // live insertion slot (0..count) shown as a highlighted line between rows.
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIns, setDropIns] = useState<number | null>(null);

  const active = layers.find((l) => l.id === activeId);

  return (
    <div className="flex h-full w-72 flex-col border-l border-panel-border bg-panel">
      <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
        <Layers size={16} className="text-accent" />
        <h2 className="text-sm font-semibold text-ink">Layers</h2>
        <span className="ml-auto text-xs text-ink-faint">{layers.length}</span>
      </div>

      <div className="flex items-center gap-1 border-b border-panel-border px-2 py-1.5">
        <Tooltip label="Duplicate layer" description="Make a copy of the active layer." side="left">
          <button
            disabled={!activeId}
            onClick={() => activeId && void duplicateLayer(activeId)}
            className="rounded p-1.5 text-ink-dim hover:bg-panel-raised hover:text-ink disabled:opacity-30"
            aria-label="Duplicate layer"
          >
            <Copy size={14} />
          </button>
        </Tooltip>
        <Tooltip
          label="Group"
          description="Group selected layers (Ctrl/Cmd+click to multi-select)."
          side="left"
        >
          <button
            onClick={() => void groupSelectedLayers()}
            className="rounded p-1.5 text-ink-dim hover:bg-panel-raised hover:text-ink"
            aria-label="Group layers"
          >
            <FolderPlus size={14} />
          </button>
        </Tooltip>
        <Tooltip label="Ungroup" description="Dissolve the active group folder." side="left">
          <button
            disabled={!active || active.type !== "group"}
            onClick={() => activeId && ungroupLayer(activeId)}
            className="rounded p-1.5 text-ink-dim hover:bg-panel-raised hover:text-ink disabled:opacity-30"
            aria-label="Ungroup"
          >
            <FolderOpen size={14} />
          </button>
        </Tooltip>
        <Tooltip label="Delete layer" description="Remove the active layer. Shortcut: Delete." side="left">
          <button
            disabled={!activeId}
            onClick={() => activeId && deleteLayer(activeId)}
            className="rounded p-1.5 text-ink-dim hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30"
            aria-label="Delete layer"
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      </div>

      {active && active.type !== "group" && (
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
                className="max-w-[9rem] rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-xs capitalize text-ink outline-none focus:border-accent/60"
              >
                {BLEND_MODES.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m}
                  </option>
                ))}
              </select>
            </Tooltip>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">Mask</span>
            {!active.hasMask ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tooltip label="Add layer mask" description="Non-destructively hide parts of this layer by painting on a mask." side="left">
                  <button
                    onClick={() => void addLayerMask("reveal")}
                    className="flex items-center gap-1 rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-[11px] text-ink-dim hover:border-accent/60 hover:text-ink"
                  >
                    <SquarePlus size={13} /> Add mask
                  </button>
                </Tooltip>
                <Tooltip label="Mask from selection" description="Turn the current selection into a mask (selected area stays visible)." side="left">
                  <button
                    onClick={() => void addLayerMask("selection")}
                    className="rounded-md border border-panel-border bg-panel-sunken px-2 py-1 text-[11px] text-ink-dim hover:border-accent/60 hover:text-ink"
                  >
                    From selection
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                <Tooltip
                  label={maskEditLayerId === active.id ? "Editing mask — click to stop" : "Paint on mask"}
                  description="Route the Brush/Eraser onto the mask. Brush reveals, Eraser hides."
                  side="left"
                >
                  <button
                    onClick={() =>
                      setMaskEditTarget(maskEditLayerId === active.id ? null : active.id)
                    }
                    className={cn(
                      "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                      maskEditLayerId === active.id
                        ? "border-accent bg-accent/20 text-ink"
                        : "border-panel-border bg-panel-sunken text-ink-dim hover:border-accent/60 hover:text-ink",
                    )}
                  >
                    <Paintbrush size={13} /> Paint
                  </button>
                </Tooltip>
                <Tooltip label={active.maskEnabled ? "Disable mask" : "Enable mask"} side="left">
                  <button
                    onClick={() => setMaskEnabled(!active.maskEnabled)}
                    className={cn(
                      "rounded-md border border-panel-border bg-panel-sunken p-1 text-ink-dim hover:text-ink",
                      !active.maskEnabled && "text-amber-400",
                    )}
                    aria-label="Toggle mask"
                  >
                    {active.maskEnabled ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </Tooltip>
                <Tooltip label="Apply mask" description="Bake the mask into the pixels and remove it." side="left">
                  <button
                    onClick={() => void applyLayerMask()}
                    className="rounded-md border border-panel-border bg-panel-sunken p-1 text-ink-dim hover:text-emerald-400"
                    aria-label="Apply mask"
                  >
                    <Check size={13} />
                  </button>
                </Tooltip>
                <Tooltip label="Delete mask" side="left">
                  <button
                    onClick={() => removeLayerMask()}
                    className="rounded-md border border-panel-border bg-panel-sunken p-1 text-ink-dim hover:text-red-400"
                    aria-label="Delete mask"
                  >
                    <X size={13} />
                  </button>
                </Tooltip>
              </div>
            )}
            <Tooltip
              label={active.clip ? "Release clipping mask" : "Clip to layer below"}
              description="Clip this layer to the shape (alpha) of the layer directly beneath it."
              side="left"
            >
              <button
                onClick={() => setClip(!active.clip)}
                className={cn(
                  "flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-[11px]",
                  active.clip
                    ? "border-accent bg-accent/20 text-ink"
                    : "border-panel-border bg-panel-sunken text-ink-dim hover:border-accent/60 hover:text-ink",
                )}
              >
                <ChevronsDownUp size={13} /> {active.clip ? "Clipped" : "Clip to below"}
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {active && active.type !== "group" && <AdjustmentsPanel />}

      <div className="flex-1 overflow-y-auto p-2">
        {layers.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-ink-faint">
            No layers yet. Import an image to create your first layer.
          </p>
        )}
        <ul className="space-y-1">
          {layers.map((layer, index) => {
            const isActive = layer.id === activeId;
            const isSelected = selectedLayerIds.includes(layer.id);
            return (
              <div key={layer.id}>
              {dragId && dragId !== layer.id && dropIns === index && (
                <div className="mx-1 mb-1 h-0.5 rounded-full bg-accent" />
              )}
              <li
                draggable={editingId !== layer.id}
                onDragStart={(e) => {
                  setDragId(layer.id);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", layer.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const rect = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY > rect.top + rect.height / 2;
                  setDropIns(after ? index + 1 : index);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = dragId || e.dataTransfer.getData("text/plain");
                  const from = layers.findIndex((l) => l.id === fromId);
                  const ins = dropIns ?? index;
                  if (fromId && from !== -1) {
                    const target = ins > from ? ins - 1 : ins;
                    if (target !== from) reorderLayer(fromId, target);
                  }
                  setDragId(null);
                  setDropIns(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropIns(null);
                }}
                onClick={(e) => selectLayer(layer.id, { additive: e.ctrlKey || e.metaKey })}
                onContextMenu={(e) => openMenu(e, layer.id)}
                className={cn(
                  "group flex cursor-grab items-center gap-2 rounded-lg border px-2 py-2 transition-colors active:cursor-grabbing",
                  isActive || isSelected
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent hover:border-panel-border hover:bg-panel-raised/50",
                  dragId === layer.id && "opacity-40",
                  layer.parentId && "ml-3",
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

                <Tooltip label={layer.locked ? "Unlock" : "Lock"} side="left">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(layer.id);
                    }}
                    className={cn(
                      "text-ink-dim hover:text-ink",
                      layer.locked && "text-amber-400",
                    )}
                    aria-label="Toggle lock"
                  >
                    {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                </Tooltip>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-panel-border bg-panel-sunken">
                  {layer.type === "group" ? (
                    <FolderOpen size={14} className="text-ink-faint" />
                  ) : layer.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={layer.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>

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
                    title="Double-click to rename · drag to reorder · Ctrl+click multi-select"
                  >
                    {layer.name}
                  </span>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLayer(layer.id);
                  }}
                  className={cn(
                    "p-0.5 text-ink-faint transition-opacity hover:text-red-400",
                    isActive || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label="Delete layer"
                >
                  <Trash2 size={14} />
                </button>
              </li>
              {dragId && dragId !== layer.id && dropIns === layers.length && index === layers.length - 1 && (
                <div className="mx-1 mt-1 h-0.5 rounded-full bg-accent" />
              )}
              </div>
            );
          })}
        </ul>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems()} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
