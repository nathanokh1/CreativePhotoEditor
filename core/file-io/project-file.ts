import JSZip from "jszip";
import {
  BlendMode,
  CanvasBackground,
  CanvasSize,
  DocumentMeta,
  Layer,
  LayerGraph,
  LayerType,
  RasterSource,
  Transform,
} from "../layer-graph";
import { loadImageAsSource } from "./import";

/**
 * `.cpe` project file — a zip container with `manifest.json` + per-layer WebP
 * raster data. See ARCHITECTURE.md §.cpe spec. This path is on the Safety Floor
 * (data loss risk); keep the schema stable and backward-compatible.
 *
 * v2 (current): persists full layer fidelity — layer type, text metadata,
 * groups (parentId/childIds), layer masks, mask-enabled, and clipping — so a
 * reopened project restores the real editable document, not a flattened raster.
 * v1 files (raster-only) still load.
 *
 * Note: undo/redo history is intentionally NOT persisted. History can be huge
 * (every stroke keeps a bitmap) and is session-scoped; saving it would bloat
 * files without real benefit. Reopening starts with a fresh, empty history.
 */

const CPE_VERSION = 2;

interface ManifestLayer {
  id: string;
  name: string;
  type: LayerType;
  dataFile: string;
  maskFile?: string;
  maskEnabled?: boolean;
  clip?: boolean;
  transform: Transform;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  width: number;
  height: number;
  parentId?: string | null;
  childIds?: string[];
  // Text layer metadata (kept so text stays editable after reopen).
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fillColor?: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
}

interface Manifest {
  version: number;
  name: string;
  createdAt: number;
  modifiedAt: number;
  canvas: CanvasSize;
  background?: CanvasBackground;
  activeLayerId?: string | null;
  layers: ManifestLayer[];
}

function bitmapToWebpBlob(source: { bitmap: unknown; width: number; height: number }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, source.width);
    canvas.height = Math.max(1, source.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("2D context unavailable"));
    if (source.bitmap) ctx.drawImage(source.bitmap as CanvasImageSource, 0, 0);
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("WebP encode failed"))),
      "image/webp",
      0.95,
    );
  });
}

/** Serialize the current Document to a `.cpe` Blob. */
export async function saveProject(graph: LayerGraph): Promise<Blob> {
  const zip = new JSZip();
  const meta = graph.getMeta();
  const layers = graph.getLayersBottomUp();
  const manifestLayers: ManifestLayer[] = [];
  const layerFolder = zip.folder("layers");
  const maskFolder = zip.folder("masks");
  if (!layerFolder || !maskFolder) throw new Error("Could not create archive folders");

  for (const layer of layers) {
    const dataFile = `layers/${layer.id}.webp`;
    const blob = await bitmapToWebpBlob(layer.source);
    layerFolder.file(`${layer.id}.webp`, blob);

    let maskFile: string | undefined;
    if (layer.mask) {
      maskFile = `masks/${layer.id}.webp`;
      maskFolder.file(`${layer.id}.webp`, await bitmapToWebpBlob(layer.mask));
    }

    const ml: ManifestLayer = {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      dataFile,
      maskFile,
      maskEnabled: layer.maskEnabled,
      clip: layer.clip,
      transform: layer.transform,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      visible: layer.visible,
      locked: layer.locked,
      width: layer.source.width,
      height: layer.source.height,
      parentId: layer.parentId ?? null,
      childIds: layer.childIds,
    };
    if (layer.type === "text") {
      ml.text = layer.text;
      ml.fontSize = layer.fontSize;
      ml.fontFamily = layer.fontFamily;
      ml.fillColor = layer.fillColor;
      ml.bold = layer.bold;
      ml.italic = layer.italic;
      ml.align = layer.align;
      ml.strokeColor = layer.strokeColor;
      ml.strokeWidth = layer.strokeWidth;
      ml.shadowColor = layer.shadowColor;
      ml.shadowBlur = layer.shadowBlur;
    }
    manifestLayers.push(ml);
  }

  const manifest: Manifest = {
    version: CPE_VERSION,
    name: meta.name,
    createdAt: meta.createdAt,
    modifiedAt: Date.now(),
    canvas: graph.getCanvasSize(),
    background: meta.background,
    activeLayerId: graph.getActiveLayerId(),
    layers: manifestLayers,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

/** Load a `.cpe` Blob into the given LayerGraph, replacing its contents. */
export async function loadProject(file: Blob, graph: LayerGraph): Promise<void> {
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("Invalid .cpe: missing manifest.json");
  const manifest = JSON.parse(await manifestFile.async("string")) as Manifest;
  if (manifest.version > CPE_VERSION) {
    throw new Error(`This .cpe was made with a newer version (v${manifest.version}).`);
  }

  const layers: Layer[] = [];
  for (const ml of manifest.layers) {
    const entry = zip.file(ml.dataFile);
    if (!entry) throw new Error(`Invalid .cpe: missing ${ml.dataFile}`);
    const source = await loadImageAsSource(await entry.async("blob"));

    let mask: RasterSource | null = null;
    if (ml.maskFile) {
      const maskEntry = zip.file(ml.maskFile);
      if (maskEntry) mask = await loadImageAsSource(await maskEntry.async("blob"));
    }

    const layer: Layer = {
      id: ml.id,
      name: ml.name,
      type: ml.type ?? "raster", // v1 files had no type
      transform: ml.transform,
      opacity: ml.opacity,
      blendMode: ml.blendMode,
      visible: ml.visible,
      locked: ml.locked ?? false,
      source,
      mask,
      maskEnabled: ml.maskEnabled,
      clip: ml.clip,
      parentId: ml.parentId ?? null,
      childIds: ml.childIds,
    };
    if (layer.type === "text") {
      layer.text = ml.text;
      layer.fontSize = ml.fontSize;
      layer.fontFamily = ml.fontFamily;
      layer.fillColor = ml.fillColor;
      layer.bold = ml.bold;
      layer.italic = ml.italic;
      layer.align = ml.align;
      layer.strokeColor = ml.strokeColor;
      layer.strokeWidth = ml.strokeWidth;
      layer.shadowColor = ml.shadowColor;
      layer.shadowBlur = ml.shadowBlur;
    }
    layers.push(layer);
  }

  const meta: DocumentMeta = {
    name: manifest.name,
    createdAt: manifest.createdAt,
    modifiedAt: manifest.modifiedAt,
    background: manifest.background,
  };
  graph.replaceWith(layers, manifest.canvas, meta);
}
