"use client";

import { create } from "zustand";
import { BlendMode, EditorEngine, Renderer, ToolId } from "@/core";
import { useSettings } from "./settings-store";

/** Read-optimized view of a Layer for the Layers Panel (no full bitmaps). */
export interface LayerView {
  id: string;
  name: string;
  opacity: number;
  visible: boolean;
  locked: boolean;
  blendMode: BlendMode;
  thumbnailUrl: string | null;
}

interface EditorState {
  ready: boolean;
  layers: LayerView[]; // top-most first (UI order)
  activeLayerId: string | null;
  activeTool: ToolId;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  docName: string;
  busy: string | null;

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
  importFiles: (files: FileList | File[]) => Promise<void>;
  exportAs: (format: "png" | "jpeg" | "webp") => Promise<void>;
  saveProject: () => Promise<void>;
  openProject: (file: File) => Promise<void>;

  selectLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  toggleVisibility: (id: string) => void;
  setOpacity: (id: string, opacity: number) => void;
  setBlendMode: (id: string, blend: BlendMode) => void;
  renameLayer: (id: string, name: string) => void;
  reorderLayer: (id: string, toUiIndex: number) => void;
  fitCanvasToActiveLayer: () => void;

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
      thumbnailUrl: makeThumbnail(l.source.bitmap),
    }))
    .reverse();
}

export const useEditor = create<EditorState>((set, get) => ({
  ready: false,
  layers: [],
  activeLayerId: null,
  activeTool: "move",
  canUndo: false,
  canRedo: false,
  zoom: 1,
  docName: "Untitled",
  busy: null,
  engine: null,

  attachCanvas: async (canvas) => {
    let engine = get().engine;
    if (!engine) {
      engine = new EditorEngine({ width: 1280, height: 720 }, "Untitled");
      set({ engine });
    }
    const renderer = new Renderer();
    await renderer.init(canvas, canvas.clientWidth || 800, canvas.clientHeight || 600);
    engine.attachRenderer(renderer);

    const refresh = get().refresh;
    engine.graph.subscribe(() => refresh());
    engine.history.subscribe(() => refresh());
    set({ ready: true });
    refresh();
  },

  detach: () => {
    get().engine?.destroy();
    set({ engine: null, ready: false, layers: [] });
  },

  refresh: () => {
    const engine = get().engine;
    if (!engine) return;
    const renderer = engine.getRenderer();
    set({
      layers: toLayerViews(engine),
      activeLayerId: engine.graph.getActiveLayerId(),
      canUndo: engine.history.canUndo(),
      canRedo: engine.history.canRedo(),
      docName: engine.graph.getMeta().name,
      zoom: renderer ? renderer.getViewport().zoom : 1,
      activeTool: engine.getTools().getActiveId(),
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

  exportAs: async (format) => {
    const engine = get().engine;
    if (!engine) return;
    set({ busy: "Exporting…" });
    try {
      await engine.exportAs(format);
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
    const engine = get().engine;
    if (!engine) return;
    set({ busy: "Opening…" });
    try {
      await engine.loadProjectFile(file);
    } finally {
      set({ busy: null });
    }
  },

  selectLayer: (id) => get().engine?.setActiveLayer(id),
  deleteLayer: (id) => get().engine?.deleteLayer(id),
  toggleVisibility: (id) => {
    const engine = get().engine;
    const layer = engine?.graph.getLayer(id);
    if (engine && layer) engine.setLayerVisibility(id, !layer.visible);
  },
  setOpacity: (id, opacity) => get().engine?.setLayerOpacity(id, opacity),
  setBlendMode: (id, blend) => get().engine?.setLayerBlendMode(id, blend),
  renameLayer: (id, name) => get().engine?.renameLayer(id, name),
  reorderLayer: (id, toUiIndex) => {
    const engine = get().engine;
    if (!engine) return;
    // UI index is top-first; convert to bottom-up graph index.
    const count = engine.graph.getLayersBottomUp().length;
    const graphIndex = count - 1 - toUiIndex;
    engine.reorderLayer(id, graphIndex);
  },

  fitCanvasToActiveLayer: () => {
    const engine = get().engine;
    const id = engine?.graph.getActiveLayerId();
    if (engine && id) engine.fitCanvasToLayer(id);
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
}));
