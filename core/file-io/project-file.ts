import JSZip from "jszip";
import {
  BlendMode,
  CanvasSize,
  DocumentMeta,
  Layer,
  LayerGraph,
  Transform,
} from "../layer-graph";
import { loadImageAsSource } from "./import";

/**
 * `.cpe` project file — a zip container with `manifest.json` + per-layer WebP
 * raster data. See ARCHITECTURE.md §.cpe spec. This path is on the Safety Floor
 * (data loss risk); keep the schema stable and backward-compatible.
 */

const CPE_VERSION = 1;

interface ManifestLayer {
  id: string;
  name: string;
  type: "raster";
  dataFile: string;
  transform: Transform;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  width: number;
  height: number;
}

interface Manifest {
  version: number;
  name: string;
  createdAt: number;
  modifiedAt: number;
  canvas: CanvasSize;
  layers: ManifestLayer[];
}

function bitmapToWebpBlob(source: { bitmap: unknown; width: number; height: number }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return reject(new Error("2D context unavailable"));
    ctx.drawImage(source.bitmap as CanvasImageSource, 0, 0);
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
  if (!layerFolder) throw new Error("Could not create layers folder");

  for (const layer of layers) {
    const dataFile = `layers/${layer.id}.webp`;
    const blob = await bitmapToWebpBlob(layer.source);
    layerFolder.file(`${layer.id}.webp`, blob);
    manifestLayers.push({
      id: layer.id,
      name: layer.name,
      type: "raster",
      dataFile,
      transform: layer.transform,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      visible: layer.visible,
      locked: layer.locked,
      width: layer.source.width,
      height: layer.source.height,
    });
  }

  const manifest: Manifest = {
    version: CPE_VERSION,
    name: meta.name,
    createdAt: meta.createdAt,
    modifiedAt: Date.now(),
    canvas: graph.getCanvasSize(),
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
    const blob = await entry.async("blob");
    const source = await loadImageAsSource(blob);
    layers.push({
      id: ml.id,
      name: ml.name,
      type: "raster",
      transform: ml.transform,
      opacity: ml.opacity,
      blendMode: ml.blendMode,
      visible: ml.visible,
      locked: ml.locked ?? false,
      source,
    });
  }

  const meta: DocumentMeta = {
    name: manifest.name,
    createdAt: manifest.createdAt,
    modifiedAt: manifest.modifiedAt,
  };
  graph.replaceWith(layers, manifest.canvas, meta);
}
