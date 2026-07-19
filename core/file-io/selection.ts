/**
 * Pixel selection mask utilities (document-space). A mask stores per-pixel
 * coverage 0..255 (255 = fully selected), which supports feathered edges. The
 * magic wand and select-by-color build masks; Cut/Copy/Delete/Fill honour them.
 */

export interface SelectionMask {
  width: number;
  height: number;
  /** Coverage per pixel, 0..255. Length = width * height. */
  data: Uint8Array;
}

export function createEmptyMask(width: number, height: number): SelectionMask {
  return { width, height, data: new Uint8Array(width * height) };
}

export function maskIsEmpty(mask: SelectionMask): boolean {
  const d = mask.data;
  for (let i = 0; i < d.length; i++) if (d[i] > 0) return false;
  return true;
}

/** Tight bounding box of the selected pixels, or null if empty. */
export function maskBounds(
  mask: SelectionMask,
): { x: number; y: number; width: number; height: number } | null {
  const { width: w, height: h, data } = mask;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[y * w + x] > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/** Invert coverage in place (select-inverse). */
export function invertMask(mask: SelectionMask): void {
  const d = mask.data;
  for (let i = 0; i < d.length; i++) d[i] = 255 - d[i];
}

/**
 * Build a magic-wand / select-by-color mask on a document-space ImageData.
 * - contiguous: flood-fill only pixels connected to the seed (magic wand).
 * - non-contiguous: every pixel within tolerance of the seed color (by color).
 * Tolerance is 0..255 as an RGB(A) euclidean distance.
 */
export function magicWandMask(
  img: ImageData,
  seedX: number,
  seedY: number,
  tolerance: number,
  contiguous: boolean,
): SelectionMask {
  const w = img.width;
  const h = img.height;
  const d = img.data;
  const mask = createEmptyMask(w, h);
  const out = mask.data;
  const sx = Math.max(0, Math.min(w - 1, Math.round(seedX)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(seedY)));
  const si = (sy * w + sx) * 4;
  const sr = d[si];
  const sg = d[si + 1];
  const sb = d[si + 2];
  const sa = d[si + 3];
  const tol2 = tolerance * tolerance;

  const matches = (i: number): boolean => {
    const dr = d[i] - sr;
    const dg = d[i + 1] - sg;
    const db = d[i + 2] - sb;
    const da = d[i + 3] - sa;
    return dr * dr + dg * dg + db * db + da * da <= tol2;
  };

  if (!contiguous) {
    for (let p = 0; p < w * h; p++) if (matches(p * 4)) out[p] = 255;
    return mask;
  }

  // Flood fill (4-connectivity) from the seed.
  const stack: number[] = [sy * w + sx];
  out[sy * w + sx] = 255;
  while (stack.length) {
    const cur = stack.pop()!;
    const cx = cur % w;
    const cy = (cur - cx) / w;
    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - w : -1,
      cy < h - 1 ? cur + w : -1,
    ];
    for (const n of neighbors) {
      if (n < 0 || out[n] === 255) continue;
      if (matches(n * 4)) {
        out[n] = 255;
        stack.push(n);
      }
    }
  }
  return mask;
}

/**
 * Rasterize a filled polygon (document-space points) into a selection mask via
 * even-odd scanline fill. Used by the freeform lasso.
 */
export function polygonMask(
  width: number,
  height: number,
  points: { x: number; y: number }[],
): SelectionMask {
  const mask = createEmptyMask(width, height);
  if (points.length < 3) return mask;
  const out = mask.data;
  const n = points.length;
  for (let y = 0; y < height; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const ay = a.y;
      const by = b.y;
      // Edge crosses this scanline?
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) {
        const t = (yc - ay) / (by - ay);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i] - 0.5));
      const x1 = Math.min(width - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = x0; x <= x1; x++) out[y * width + x] = 255;
    }
  }
  return mask;
}

/** Soften mask edges with a separable box blur (radius in px). In place-ish. */
export function featherMask(mask: SelectionMask, radius: number): SelectionMask {
  const r = Math.round(radius);
  if (r <= 0) return mask;
  const { width: w, height: h, data } = mask;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = r * 2 + 1;

  // Horizontal pass.
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) sum += data[row + Math.max(0, Math.min(w - 1, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / win;
      const add = data[row + Math.min(w - 1, x + r + 1)];
      const sub = data[row + Math.max(0, x - r)];
      sum += add - sub;
    }
  }
  // Vertical pass.
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      const add = tmp[Math.min(h - 1, y + r + 1) * w + x];
      const sub = tmp[Math.max(0, y - r) * w + x];
      sum += add - sub;
    }
  }

  const result = createEmptyMask(w, h);
  for (let i = 0; i < out.length; i++) result.data[i] = Math.max(0, Math.min(255, Math.round(out[i])));
  return result;
}

/** Add / subtract another mask into a base mask (max / clear). In place on base. */
export function combineMask(base: SelectionMask, add: SelectionMask, mode: "add" | "subtract"): void {
  const b = base.data;
  const a = add.data;
  const n = Math.min(b.length, a.length);
  if (mode === "add") {
    for (let i = 0; i < n; i++) b[i] = Math.max(b[i], a[i]);
  } else {
    for (let i = 0; i < n; i++) b[i] = Math.max(0, b[i] - a[i]);
  }
}

/**
 * Render a mask into an RGBA overlay canvas for on-canvas visualization:
 * selected interior gets a translucent tint, edges get a brighter outline.
 */
export function maskToOverlayCanvas(mask: SelectionMask): HTMLCanvasElement {
  const { width: w, height: h, data } = mask;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.createImageData(w, h);
  const o = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const v = data[p];
      if (v === 0) continue;
      // Edge = selected pixel touching an unselected neighbor (or canvas edge).
      const edge =
        (x === 0 || data[p - 1] === 0) ||
        (x === w - 1 || data[p + 1] === 0) ||
        (y === 0 || data[p - w] === 0) ||
        (y === h - 1 || data[p + w] === 0);
      const oi = p * 4;
      if (edge) {
        o[oi] = 255;
        o[oi + 1] = 255;
        o[oi + 2] = 255;
        o[oi + 3] = 230;
      } else {
        o[oi] = 99;
        o[oi + 1] = 102;
        o[oi + 2] = 241;
        o[oi + 3] = Math.round((v / 255) * 70);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
