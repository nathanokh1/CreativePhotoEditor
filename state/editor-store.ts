"use client";

import { create } from "zustand";
import { AdjustmentOptions, BlendMode, EditorEngine, FilterKind, Renderer, ToolId } from "@/core";
import { useSettings } from "./settings-store";
import {
  deleteDocBlob,
  loadDocBlob,
  loadSession,
  saveDocBlob,
  saveSession,
} from "./persistence";

/** A single open document (tab). Engines are heavy/non-serializable, so they
 * live outside the reactive store; the store only mirrors id + name for the UI. */
interface DocEntry {
  id: string;
  name: string;
  engine: EditorEngine;
  viewport: { x: number; y: number; zoom: number } | null;
}

/** Open documents keyed by id. Kept out of the reactive store on purpose. */
const docEntries = new Map<string, DocEntry>();
let sharedRenderer: Renderer | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;
let activeUnsub: (() => void) | null = null;
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read-optimized view of a Layer for the Layers Panel (no full bitmaps). */
export interface LayerView {
  id: string;
  name: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  thumbnailUrl: string | null;
  type: "raster" | "text" | "group";
  parentId: string | null;
  text: string | null;
  fontSize: number | null;
  fillColor: string | null;
  fontFamily: string | null;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  strokeColor: string | null;
  strokeWidth: number;
  shadowColor: string | null;
  shadowBlur: number;
  hasMask: boolean;
  maskEnabled: boolean;
  clip: boolean;
}

interface EditorState {
  ready: boolean;
  /** Open documents (tabs), in tab order. */
  docs: { id: string; name: string }[];
  activeDocId: string | null;
  newTab: (opts?: {
    name?: string;
    width?: number;
    height?: number;
    background?: "transparent" | string;
  }) => Promise<void>;
  switchTab: (id: string) => void;
  closeTab: (id: string) => Promise<void>;

  layers: LayerView[]; // top-most first (UI order)
  activeLayerId: string | null;
  /** Multi-select for grouping (Ctrl/Cmd+click in Layers panel). */
  selectedLayerIds: string[];
  activeTool: ToolId;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  docName: string;
  busy: string | null;
  /** Whether the pen tool has a usable path, and whether it's closed. */
  penHasPath: boolean;
  penClosed: boolean;

  attachCanvas: (canvas: HTMLCanvasElement) => Promise<void>;
  detach: () => void;
  refresh: () => void;

  setTool: (id: ToolId) => void;
  setLockAspect: (lock: boolean) => void;
  undo: () => void;
  redo: () => void;
  copy: () => Promise<void>;
  cut: () => Promise<void>;
  paste: () => void;
  pasteFromSystem: () => Promise<void>;
  importFiles: (files: FileList | File[]) => Promise<void>;
  exportAs: (
    format: "png" | "jpeg" | "webp",
    options?: { quality?: number; scale?: number; background?: string },
  ) => Promise<void>;
  exportLayers: (
    format: "png" | "jpeg" | "webp",
    options?: {
      quality?: number;
      scale?: number;
      visibleOnly?: boolean;
      trimToContent?: boolean;
      background?: string;
    },
  ) => Promise<number>;
  saveProject: () => Promise<void>;
  openProject: (file: File) => Promise<void>;
  newDocument: (opts: {
    name?: string;
    width: number;
    height: number;
    background?: "transparent" | string;
  }) => Promise<void>;

  selectLayer: (id: string, opts?: { additive?: boolean }) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => Promise<void>;
  groupSelectedLayers: () => Promise<void>;
  ungroupLayer: (id: string) => void;
  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;
  setOpacity: (id: string, opacity: number) => void;
  setBlendMode: (id: string, blend: BlendMode) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayer: (id: string, toUiIndex: number) => void;
  fitCanvasToActiveLayer: () => void;
  addEmptyLayer: () => Promise<void>;
  addTextLayer: () => Promise<void>;
  updateTextLayer: (opts: {
    text?: string;
    fontSize?: number;
    fillColor?: string;
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    align?: "left" | "center" | "right";
    strokeColor?: string;
    strokeWidth?: number;
    shadowColor?: string;
    shadowBlur?: number;
  }) => Promise<void>;
  addShapeLayer: (kind: "rect" | "ellipse") => Promise<void>;
  applyAdjustments: (opts: AdjustmentOptions) => Promise<void>;
  applyFilter: (kind: FilterKind) => Promise<void>;
  autoLayers: (opts: {
    mode: "regions" | "grid";
    rows?: number;
    cols?: number;
    hideSource?: boolean;
    threshold?: number;
    group?: boolean;
    separation?: number;
    split?: boolean;
  }) => Promise<number>;
  nudge: (dx: number, dy: number) => void;
  setPaintStyle: (patch: {
    color?: string;
    size?: number;
    opacity?: number;
    hardness?: number;
    flow?: number;
    spacing?: number;
  }) => void;
  setShowGuides: (show: boolean) => void;

  setWandStyle: (patch: { tolerance?: number; feather?: number; contiguous?: boolean }) => void;
  getWandStyle: () => { tolerance: number; feather: number; contiguous: boolean };
  deselect: () => void;
  selectAll: () => void;
  invertSelection: () => void;
  deleteSelectionContents: () => Promise<void>;
  fillSelection: (color: string) => Promise<void>;

  /** Layer id whose mask is the active paint target, or null. */
  maskEditLayerId: string | null;
  addLayerMask: (mode?: "reveal" | "hide" | "selection") => Promise<void>;
  removeLayerMask: () => void;
  applyLayerMask: () => Promise<void>;
  setMaskEnabled: (enabled: boolean) => void;
  setMaskEditTarget: (layerId: string | null) => void;
  setClip: (clip: boolean) => void;

  rasterizePenPath: (opts: {
    stroke: boolean;
    strokeColor: string;
    strokeWidth: number;
    fill: boolean;
    fillColor: string;
  }) => Promise<void>;
  penPathToSelection: () => void;
  closePenPath: () => void;
  clearPenPath: () => void;

  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;

  engine: EditorEngine | null;
}

function makeThumbnail(bitmap: unknown, size = 40): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const img = bitmap as HTMLImageElement;
    const iw = img.naturalWidth || img.width || size;
    const ih = img.naturalHeight || img.height || size;
    const scale = Math.min(size / iw, size / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

function toLayerViews(engine: EditorEngine): LayerView[] {
  return [...engine.graph.getLayersBottomUp()]
    .map((l) => ({
      id: l.id,
      name: l.name,
      opacity: l.opacity,
      visible: l.visible,
      locked: l.locked,
      blendMode: l.blendMode,
      thumbnailUrl: l.type === "group" ? null : makeThumbnail(l.source.bitmap),
      type: l.type,
      parentId: l.parentId ?? null,
      text: l.type === "text" ? (l.text ?? "Text") : null,
      fontSize: l.type === "text" ? (l.fontSize ?? 48) : null,
      fillColor: l.type === "text" ? (l.fillColor ?? "#ffffff") : null,
      fontFamily: l.type === "text" ? (l.fontFamily ?? "Inter, sans-serif") : null,
      bold: l.type === "text" ? !!l.bold : false,
      italic: l.type === "text" ? !!l.italic : false,
      align: l.type === "text" ? (l.align ?? "left") : "left",
      strokeColor: l.type === "text" ? (l.strokeColor ?? "") : null,
      strokeWidth: l.type === "text" ? (l.strokeWidth ?? 0) : 0,
      shadowColor: l.type === "text" ? (l.shadowColor ?? "") : null,
      shadowBlur: l.type === "text" ? (l.shadowBlur ?? 0) : 0,
      hasMask: !!l.mask,
      maskEnabled: l.maskEnabled !== false,
      clip: !!l.clip,
    }))
    .reverse();
}

export const useEditor = create<EditorState>((set, get) => {
  // ---- document manager (engines live in `docEntries`, outside the store) ----
  const rebuildDocsView = () => {
    set({ docs: [...docEntries.values()].map((d) => ({ id: d.id, name: d.name })) });
  };

  const persistSession = async () => {
    await saveSession({
      docs: [...docEntries.values()].map((d) => ({ id: d.id, name: d.name })),
      activeDocId: get().activeDocId,
      savedAt: Date.now(),
    });
  };

  const scheduleAutosave = (id: string) => {
    const existing = autosaveTimers.get(id);
    if (existing) clearTimeout(existing);
    autosaveTimers.set(
      id,
      setTimeout(() => {
        autosaveTimers.delete(id);
        const entry = docEntries.get(id);
        if (!entry) return;
        void (async () => {
          try {
            const blob = await entry.engine.serialize();
            await saveDocBlob(id, blob);
            await persistSession();
          } catch {
            // best-effort autosave; ignore storage failures
          }
        })();
      }, 1500),
    );
  };

  const createDoc = (engine: EditorEngine): string => {
    const id = newId();
    docEntries.set(id, { id, name: engine.graph.getMeta().name, engine, viewport: null });
    return id;
  };

  const activateDoc = (id: string) => {
    const entry = docEntries.get(id);
    const renderer = sharedRenderer;
    if (!entry || !renderer) return;

    const prevId = get().activeDocId;
    if (prevId && prevId !== id) {
      const prev = docEntries.get(prevId);
      if (prev) prev.viewport = renderer.getViewport();
    }

    activeUnsub?.();
    activeUnsub = null;

    entry.engine.attachRenderer(renderer);
    renderer.setSelection(null);
    renderer.setSelectionMask(null);
    if (entry.viewport) renderer.setViewport(entry.viewport);
    else entry.engine.fitToView();
    entry.engine.setShowGuides(useSettings.getState().showGuides);
    entry.engine.setLockAspect(useSettings.getState().lockAspectRatio);

    const u1 = entry.engine.graph.subscribe(() => {
      get().refresh();
      const nm = entry.engine.graph.getMeta().name;
      if (entry.name !== nm) {
        entry.name = nm;
        rebuildDocsView();
      }
      scheduleAutosave(id);
    });
    const u2 = entry.engine.history.subscribe(() => get().refresh());
    activeUnsub = () => {
      u1();
      u2();
    };

    set({ engine: entry.engine, activeDocId: id });
    rebuildDocsView();
    get().refresh();
  };

  return {
  ready: false,
  docs: [],
  activeDocId: null,
  layers: [],
  activeLayerId: null,
  selectedLayerIds: [],
  activeTool: "move",
  canUndo: false,
  canRedo: false,
  zoom: 1,
  docName: "Untitled",
  busy: null,
  engine: null,

  attachCanvas: async (canvas) => {
    // If the canvas element changed (HMR / remount), rebuild the renderer.
    if (sharedRenderer && sharedCanvas !== canvas) {
      try {
        sharedRenderer.destroy();
      } catch {
        // ignore
      }
      sharedRenderer = null;
    }
    if (!sharedRenderer) {
      const renderer = new Renderer();
      await renderer.init(canvas, canvas.clientWidth || 800, canvas.clientHeight || 600);
      sharedRenderer = renderer;
      sharedCanvas = canvas;
    }

    // Restore a previous session from IndexedDB, or start a fresh document.
    if (docEntries.size === 0) {
      const session = await loadSession();
      if (session && session.docs.length) {
        for (const d of session.docs) {
          const engine = new EditorEngine({ width: 1280, height: 720 }, d.name);
          const blob = await loadDocBlob(d.id);
          if (blob) {
            try {
              await engine.deserialize(blob);
            } catch {
              // corrupt entry — keep the empty engine
            }
          }
          docEntries.set(d.id, {
            id: d.id,
            name: engine.graph.getMeta().name,
            engine,
            viewport: null,
          });
        }
        const activeId =
          session.activeDocId && docEntries.has(session.activeDocId)
            ? session.activeDocId
            : [...docEntries.keys()][0];
        set({ ready: true });
        activateDoc(activeId);
        return;
      }
      const engine = new EditorEngine({ width: 1280, height: 720 }, "Untitled");
      const id = createDoc(engine);
      set({ ready: true });
      activateDoc(id);
      void persistSession();
      return;
    }

    set({ ready: true });
    if (get().activeDocId) activateDoc(get().activeDocId!);
  },

  newTab: async (opts) => {
    const engine = new EditorEngine(
      { width: opts?.width ?? 1280, height: opts?.height ?? 720 },
      opts?.name ?? "Untitled",
    );
    if (opts) await engine.newDocument({
      name: opts.name ?? "Untitled",
      width: opts.width ?? 1280,
      height: opts.height ?? 720,
      background: opts.background ?? "transparent",
    });
    const id = createDoc(engine);
    rebuildDocsView();
    activateDoc(id);
    scheduleAutosave(id);
    void persistSession();
  },

  switchTab: (id) => {
    if (id === get().activeDocId) return;
    if (docEntries.has(id)) activateDoc(id);
  },

  closeTab: async (id) => {
    const entry = docEntries.get(id);
    if (!entry) return;
    const wasActive = get().activeDocId === id;
    const ids = [...docEntries.keys()];
    const idx = ids.indexOf(id);

    if (wasActive) {
      activeUnsub?.();
      activeUnsub = null;
    }
    const timer = autosaveTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      autosaveTimers.delete(id);
    }
    docEntries.delete(id);
    // Note: don't call engine.destroy() — the renderer is shared across tabs.
    // Dropping the engine reference is enough; the renderer is re-pointed to the
    // next active document below (or reused by the remaining ones).
    await deleteDocBlob(id);

    if (docEntries.size === 0) {
      // Never leave zero tabs — open a fresh Untitled.
      const engine = new EditorEngine({ width: 1280, height: 720 }, "Untitled");
      const newIdv = createDoc(engine);
      rebuildDocsView();
      activateDoc(newIdv);
    } else if (wasActive) {
      const nextId = ids[Math.min(idx, ids.length - 1)] === id ? ids[idx + 1] : ids[Math.max(0, idx - 1)];
      const target = docEntries.has(nextId) ? nextId : [...docEntries.keys()][0];
      rebuildDocsView();
      activateDoc(target);
    } else {
      rebuildDocsView();
    }
    void persistSession();
  },

  detach: () => {
    activeUnsub?.();
    activeUnsub = null;
    set({ ready: false });
  },

  refresh: () => {
    const engine = get().engine;
    if (!engine) return;
    const renderer = engine.getRenderer();
    const pen = engine.penInfo();
    set({
      layers: toLayerViews(engine),
      activeLayerId: engine.graph.getActiveLayerId(),
      canUndo: engine.history.canUndo(),
      canRedo: engine.history.canRedo(),
      docName: engine.graph.getMeta().name,
      zoom: renderer ? renderer.getViewport().zoom : 1,
      activeTool: engine.getTools().getActiveId(),
      penHasPath: pen.hasPath,
      penClosed: pen.closed,
    });
  },

  setTool: (id) => {
    const engine = get().engine;
    if (!engine) return;
    engine.setLockAspect(useSettings.getState().lockAspectRatio);
    engine.setTool(id);
    set({ activeTool: id });
  },

  setLockAspect: (lock) => {
    useSettings.getState().setLockAspectRatio(lock);
    get().engine?.setLockAspect(lock);
  },

  undo: () => get().engine?.undo(),
  redo: () => get().engine?.redo(),

  copy: async () => {
    await get().engine?.copy();
  },
  cut: async () => {
    await get().engine?.cut();
  },
  paste: () => {
    get().engine?.paste();
  },
  pasteFromSystem: async () => {
    await get().engine?.pasteFromSystemClipboard();
  },

  importFiles: async (files) => {
    const engine = get().engine;
    if (!engine) return;
    set({ busy: "Importing…" });
    try {
      const fit = useSettings.getState().fitCanvasToFirstImport;
      for (const file of Array.from(files)) {
        await engine.importFile(file, { fitCanvasToImage: fit });
      }
    } finally {
      set({ busy: null });
    }
  },

  exportAs: async (format, options) => {
    const engine = get().engine;
    if (!engine) return;
    set({ busy: "Exporting…" });
    try {
      await engine.exportAs(format, options);
    } finally {
      set({ busy: null });
    }
  },

  exportLayers: async (format, options) => {
    const engine = get().engine;
    if (!engine) return 0;
    set({ busy: "Exporting layers…" });
    try {
      return await engine.exportLayersBatch(format, options);
    } finally {
      set({ busy: null });
    }
  },

  saveProject: async () => {
    const engine = get().engine;
    if (!engine) return;
    set({ busy: "Saving…" });
    try {
      await engine.saveProjectFile();
    } finally {
      set({ busy: null });
    }
  },

  openProject: async (file) => {
    set({ busy: "Opening…" });
    try {
      // Open the project in its own tab so existing work stays put.
      await get().newTab();
      const engine = get().engine;
      if (engine) await engine.loadProjectFile(file);
      get().refresh();
    } finally {
      set({ busy: null });
    }
  },

  newDocument: async (opts) => {
    await get().newTab(opts);
  },

  selectLayer: (id, opts) => {
    const engine = get().engine;
    if (!engine) return;
    if (opts?.additive) {
      const selected = new Set(get().selectedLayerIds);
      if (selected.has(id)) selected.delete(id);
      else selected.add(id);
      if (selected.size === 0) selected.add(id);
      engine.setActiveLayer(id);
      set({ selectedLayerIds: [...selected], activeLayerId: id });
      return;
    }
    engine.setActiveLayer(id);
    set({ selectedLayerIds: [id], activeLayerId: id });
  },
  deleteLayer: (id) => get().engine?.deleteLayer(id),
  duplicateLayer: async (id) => {
    await get().engine?.duplicateLayer(id);
  },
  groupSelectedLayers: async () => {
    const ids = get().selectedLayerIds;
    const fallback = get().activeLayerId;
    const target = ids.length ? ids : fallback ? [fallback] : [];
    await get().engine?.groupLayers(target);
    get().refresh();
  },
  ungroupLayer: (id) => {
    get().engine?.ungroupLayer(id);
  },
  toggleVisibility: (id) => {
    const engine = get().engine;
    const layer = engine?.graph.getLayer(id);
    if (engine && layer) engine.setLayerVisibility(id, !layer.visible);
  },
  toggleLock: (id) => {
    const engine = get().engine;
    const layer = engine?.graph.getLayer(id);
    if (engine && layer) engine.setLayerLocked(id, !layer.locked);
  },
  setOpacity: (id, opacity) => get().engine?.setLayerOpacity(id, opacity),
  setBlendMode: (id, blend) => get().engine?.setLayerBlendMode(id, blend),
  renameLayer: (id, name) => get().engine?.renameLayer(id, name),
  reorderLayer: (id, toUiIndex) => {
    const engine = get().engine;
    if (!engine) return;
    const count = engine.graph.getLayersBottomUp().length;
    const graphIndex = count - 1 - toUiIndex;
    engine.reorderLayer(id, graphIndex);
  },

  fitCanvasToActiveLayer: () => {
    const engine = get().engine;
    const id = engine?.graph.getActiveLayerId();
    if (engine && id) engine.fitCanvasToLayer(id);
  },

  addEmptyLayer: async () => {
    await get().engine?.addEmptyLayer();
  },
  addTextLayer: async () => {
    await get().engine?.addTextLayer();
  },
  updateTextLayer: async (opts) => {
    const engine = get().engine;
    const id = engine?.graph.getActiveLayerId();
    if (engine && id) await engine.updateTextLayer(id, opts);
  },
  addShapeLayer: async (kind) => {
    await get().engine?.addShapeLayer(kind);
  },
  applyAdjustments: async (opts) => {
    const engine = get().engine;
    const id = engine?.graph.getActiveLayerId();
    if (engine && id) await engine.applyLayerAdjustments(id, opts);
  },
  applyFilter: async (kind) => {
    const engine = get().engine;
    const id = engine?.graph.getActiveLayerId();
    if (engine && id) await engine.applyLayerFilter(id, kind);
  },
  autoLayers: async (opts) => {
    const engine = get().engine;
    if (!engine) return 0;
    set({ busy: "Slicing…" });
    try {
      const n = await engine.autoLayersFromActive(opts);
      get().refresh();
      return n;
    } finally {
      set({ busy: null });
    }
  },
  nudge: (dx, dy) => get().engine?.nudgeActiveLayer(dx, dy),
  setPaintStyle: (patch) => get().engine?.setPaintStyle(patch),
  setShowGuides: (show) => get().engine?.setShowGuides(show),

  setWandStyle: (patch) => get().engine?.setWandStyle(patch),
  getWandStyle: () =>
    get().engine?.getWandStyle() ?? { tolerance: 32, feather: 0, contiguous: true },
  deselect: () => {
    get().engine?.deselect();
    get().refresh();
  },
  selectAll: () => {
    get().engine?.selectAll();
    get().refresh();
  },
  invertSelection: () => {
    get().engine?.invertSelection();
    get().refresh();
  },
  deleteSelectionContents: async () => {
    await get().engine?.deleteSelectionContents();
    get().refresh();
  },
  fillSelection: async (color) => {
    await get().engine?.fillSelection(color);
    get().refresh();
  },

  maskEditLayerId: null,
  addLayerMask: async (mode = "reveal") => {
    await get().engine?.addLayerMask(mode);
    get().refresh();
  },
  removeLayerMask: () => {
    const engine = get().engine;
    if (!engine) return;
    if (get().maskEditLayerId === engine.graph.getActiveLayerId()) {
      set({ maskEditLayerId: null });
    }
    engine.removeLayerMask();
    get().refresh();
  },
  applyLayerMask: async () => {
    const engine = get().engine;
    if (!engine) return;
    set({ maskEditLayerId: null });
    await engine.applyLayerMask();
    get().refresh();
  },
  setMaskEnabled: (enabled) => {
    get().engine?.setMaskEnabled(enabled);
    get().refresh();
  },
  setMaskEditTarget: (layerId) => {
    get().engine?.setMaskEditTarget(layerId);
    set({ maskEditLayerId: layerId });
  },
  setClip: (clip) => {
    get().engine?.setClip(clip);
    get().refresh();
  },

  penHasPath: false,
  penClosed: false,
  rasterizePenPath: async (opts) => {
    await get().engine?.rasterizePenPath(opts);
    get().refresh();
  },
  penPathToSelection: () => {
    get().engine?.penPathToSelection();
    get().refresh();
  },
  closePenPath: () => {
    get().engine?.closePenPath();
    get().refresh();
  },
  clearPenPath: () => {
    get().engine?.clearPenPath();
    get().refresh();
  },

  zoomIn: () => {
    const engine = get().engine;
    const r = engine?.getRenderer();
    if (!engine || !r) return;
    const v = r.getViewport();
    engine.zoomAt(v.x, v.y, 1.2);
    get().refresh();
  },
  zoomOut: () => {
    const engine = get().engine;
    const r = engine?.getRenderer();
    if (!engine || !r) return;
    const v = r.getViewport();
    engine.zoomAt(v.x, v.y, 1 / 1.2);
    get().refresh();
  },
  fitToView: () => {
    get().engine?.fitToView();
    get().refresh();
  },
  };
});
