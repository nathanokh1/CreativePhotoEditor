import { RasterSource } from "../layer-graph";
import { sourceToCanvas } from "./raster-edit";

export interface DetectedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RegionDetectOptions {
  /** Color distance (0..255) under which a pixel counts as background. */
  threshold?: number;
  /** Ignore regions smaller than this fraction of the image area. */
  minAreaFraction?: number;
  /** Ignore regions thinner than this many pixels on either side. */
  minSide?: number;
  /** Cap the number of regions returned (largest first, then re-sorted). */
  maxRegions?: number;
  /** Grow each detected box by this many px (helps capture thin borders). */
  pad?: number;
  /** Erode the foreground by this many px before labelling to break thin
   * bridges/borders that would otherwise merge adjacent boxes. */
  separation?: number;
  /** Recursively split each detected box along empty gutter rows/columns so a
   * grid of touching cells becomes one region per cell. */
  split?: boolean;
}

/**
 * Detect content regions on a raster by treating a dominant border color as
 * background and labelling connected non-background blobs (4-connectivity).
 * Deterministic, client-side — no AI. Great for grids of bordered cards.
 */
export function detectRegions(
  source: RasterSource,
  opts: RegionDetectOptions = {},
): DetectedRegion[] {
  const threshold = opts.threshold ?? 32;
  const minAreaFraction = opts.minAreaFraction ?? 0.0015;
  const minSide = opts.minSide ?? 10;
  const maxRegions = opts.maxRegions ?? 400;
  const pad = opts.pad ?? 0;
  // Both extras default OFF so the base detection matches the original, known-good
  // behaviour. They are opt-in remedies for the over-grouping (touching cells) case.
  const separation = Math.max(0, Math.round(opts.separation ?? 0));
  const doSplit = opts.split === true;

  const canvas = sourceToCanvas(source);
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  const data = ctx.getImageData(0, 0, w, h).data;

  // Estimate background color from the border pixels (median-ish via average).
  let br = 0;
  let bg = 0;
  let bb = 0;
  let count = 0;
  const sample = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 8) return; // transparent — skip
    br += data[i];
    bg += data[i + 1];
    bb += data[i + 2];
    count++;
  };
  for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 100))) {
    sample(x, 0);
    sample(x, h - 1);
  }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 100))) {
    sample(0, y);
    sample(w - 1, y);
  }
  const hasBg = count > 0;
  br = hasBg ? br / count : 255;
  bg = hasBg ? bg / count : 255;
  bb = hasBg ? bb / count : 255;

  // Foreground mask (1 = content, 0 = background/transparent).
  const fg = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const a = data[i + 3];
    if (a < 8) continue;
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    if (Math.sqrt(dr * dr + dg * dg + db * db) > threshold) fg[p] = 1;
  }

  // Erode the foreground so thin borders / anti-alias bridges between adjacent
  // boxes don't fuse them into one blob. Labelling uses the eroded mask; boxes
  // are padded back afterwards.
  let labelMask = fg;
  if (separation > 0) {
    labelMask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!fg[y * w + x]) continue;
        let keep = 1;
        for (let dy = -separation; dy <= separation && keep; dy++) {
          for (let dx = -separation; dx <= separation; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h || !fg[ny * w + nx]) {
              keep = 0;
              break;
            }
          }
        }
        labelMask[y * w + x] = keep;
      }
    }
  }

  const labels = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  const boxes: { minX: number; minY: number; maxX: number; maxY: number; area: number }[] = [];

  for (let p = 0; p < w * h; p++) {
    if (labels[p] !== -1) continue;
    if (!labelMask[p]) {
      labels[p] = -2; // background
      continue;
    }
    const label = boxes.length;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    stack.length = 0;
    stack.push(p);
    labels[p] = label;
    while (stack.length) {
      const cur = stack.pop()!;
      const cx = cur % w;
      const cy = (cur - cx) / w;
      area++;
      if (cx < minX) minX = cx;
      if (cy < minY) minY = cy;
      if (cx > maxX) maxX = cx;
      if (cy > maxY) maxY = cy;
      const neighbors = [
        cx > 0 ? cur - 1 : -1,
        cx < w - 1 ? cur + 1 : -1,
        cy > 0 ? cur - w : -1,
        cy < h - 1 ? cur + w : -1,
      ];
      for (const n of neighbors) {
        if (n < 0 || labels[n] !== -1) continue;
        if (!labelMask[n]) {
          labels[n] = -2;
        } else {
          labels[n] = label;
          stack.push(n);
        }
      }
    }
    boxes.push({ minX, minY, maxX, maxY, area });
  }

  type Box = { minX: number; minY: number; maxX: number; maxY: number };

  const colFg = (x: number, y0: number, y1: number) => {
    let c = 0;
    for (let y = y0; y <= y1; y++) if (fg[y * w + x]) c++;
    return c;
  };
  const rowFg = (y: number, x0: number, x1: number) => {
    let c = 0;
    for (let x = x0; x <= x1; x++) if (fg[y * w + x]) c++;
    return c;
  };
  const boxFg = (box: Box): number => {
    let area = 0;
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) if (fg[y * w + x]) area++;
    }
    return area;
  };

  // Tighten a box to its actual foreground extent (erosion may have shrunk it).
  const tighten = (box: Box): Box | null => {
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = box.minY; y <= box.maxY; y++) {
      for (let x = box.minX; x <= box.maxX; x++) {
        if (fg[y * w + x]) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) return null;
    return { minX, minY, maxX, maxY };
  };

  // Typical (median) card size across all blobs — robust to a few outliers
  // (e.g. a title box or the odd merge). Used to detect and split merged cells.
  const median = (nums: number[]): number => {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const statBoxes = boxes.filter(
    (b) =>
      b.maxX - b.minX + 1 >= minSide &&
      b.maxY - b.minY + 1 >= minSide &&
      b.area >= w * h * minAreaFraction,
  );
  const medW = median(statBoxes.map((b) => b.maxX - b.minX + 1));
  const medH = median(statBoxes.map((b) => b.maxY - b.minY + 1));

  // Snap an evenly-spaced cut to the lowest-density line within a window, so cuts
  // land in the real gutter between cards (through the number labels/watermark).
  const snapCut = (
    target: number,
    box: Box,
    axis: "col" | "row",
  ): number => {
    const unit = axis === "col" ? medW : medH;
    const win = Math.max(3, Math.round(unit * 0.35));
    const lo = axis === "col" ? box.minX : box.minY;
    const hi = axis === "col" ? box.maxX : box.maxY;
    let bestK = target;
    let bestC = Infinity;
    for (let k = Math.max(lo + 1, target - win); k <= Math.min(hi - 1, target + win); k++) {
      const c = axis === "col" ? colFg(k, box.minY, box.maxY) : rowFg(k, box.minX, box.maxX);
      if (c < bestC) {
        bestC = c;
        bestK = k;
      }
    }
    return bestK;
  };

  // Split a merged blob (spanning several cells) into a grid of ~median cells.
  // A single-card blob rounds to 1×1 and is returned unchanged, so this is safe.
  const subdivide = (box: Box): Box[] => {
    const bw = box.maxX - box.minX + 1;
    const bh = box.maxY - box.minY + 1;
    const cols = medW > 0 ? Math.max(1, Math.round(bw / medW)) : 1;
    const rows = medH > 0 ? Math.max(1, Math.round(bh / medH)) : 1;
    if (cols <= 1 && rows <= 1) return [box];

    const xs = [box.minX];
    for (let i = 1; i < cols; i++) {
      xs.push(snapCut(Math.round(box.minX + (i * bw) / cols), box, "col"));
    }
    xs.push(box.maxX + 1);
    const ys = [box.minY];
    for (let i = 1; i < rows; i++) {
      ys.push(snapCut(Math.round(box.minY + (i * bh) / rows), box, "row"));
    }
    ys.push(box.maxY + 1);

    const cells: Box[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell: Box = { minX: xs[c], minY: ys[r], maxX: xs[c + 1] - 1, maxY: ys[r + 1] - 1 };
        if (cell.maxX >= cell.minX && cell.maxY >= cell.minY) cells.push(cell);
      }
    }
    return cells;
  };

  const split: { minX: number; minY: number; maxX: number; maxY: number; area: number }[] = [];
  for (const b of boxes) {
    if (!doSplit && separation === 0) {
      // Default path — identical to the original detector: use the blob's own
      // bounding box and pixel count, no tightening/re-counting.
      split.push(b);
      continue;
    }
    const bbox: Box = { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY };
    // Erosion shrinks the blob; recover its true content extent before splitting.
    const base = separation > 0 ? tighten(bbox) : bbox;
    if (!base) continue;
    const pieces = doSplit ? subdivide(base) : [base];
    for (const piece of pieces) {
      split.push({ ...piece, area: boxFg(piece) });
    }
  }

  const minArea = w * h * minAreaFraction;
  let regions = split
    .filter((b) => {
      const rw = b.maxX - b.minX + 1;
      const rh = b.maxY - b.minY + 1;
      return b.area >= minArea && rw >= minSide && rh >= minSide;
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, maxRegions)
    .map((b) => ({
      x: Math.max(0, b.minX - pad),
      y: Math.max(0, b.minY - pad),
      width: Math.min(w, b.maxX + 1 + pad) - Math.max(0, b.minX - pad),
      height: Math.min(h, b.maxY + 1 + pad) - Math.max(0, b.minY - pad),
    }));

  // Reading order: top-to-bottom in rows, then left-to-right within a row.
  const rowTol = Math.max(8, h * 0.02);
  regions = regions.sort((a, b) => {
    if (Math.abs(a.y - b.y) > rowTol) return a.y - b.y;
    return a.x - b.x;
  });
  return regions;
}

/** Split a rect area into an even rows × cols grid of regions. */
export function gridRegions(
  width: number,
  height: number,
  rows: number,
  cols: number,
): DetectedRegion[] {
  const out: DetectedRegion[] = [];
  const cw = width / cols;
  const ch = height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        x: Math.round(c * cw),
        y: Math.round(r * ch),
        width: Math.round(cw),
        height: Math.round(ch),
      });
    }
  }
  return out;
}

/** Crop a sub-rectangle of a source into its own canvas. */
export function cropRegion(source: RasterSource, region: DetectedRegion): HTMLCanvasElement {
  const src = sourceToCanvas(source);
  const out = document.createElement("canvas");
  out.width = Math.max(1, region.width);
  out.height = Math.max(1, region.height);
  const ctx = out.getContext("2d")!;
  ctx.drawImage(
    src,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    region.width,
    region.height,
  );
  return out;
}
