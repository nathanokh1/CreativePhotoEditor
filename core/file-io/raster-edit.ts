import { RasterSource } from "../layer-graph";

/** Draw a layer's bitmap onto an editable canvas (always copies). */
export function sourceToCanvas(source: RasterSource): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, source.width);
  canvas.height = Math.max(1, source.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(source.bitmap as CanvasImageSource, 0, 0);
  return canvas;
}

/** Deep-copy a source so paint undo keeps the pre-stroke bitmap. */
export async function cloneSource(source: RasterSource): Promise<RasterSource> {
  return canvasToSource(sourceToCanvas(source));
}

export function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("encode failed"));
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("decode failed"));
      };
      img.src = url;
    }, "image/png");
  });
}

export async function canvasToSource(canvas: HTMLCanvasElement): Promise<RasterSource> {
  const img = await canvasToImage(canvas);
  return { width: canvas.width, height: canvas.height, bitmap: img };
}

/** Map a document-space point into layer-local unscaled pixel coords. */
export function documentToLayerLocal(
  layer: {
    transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number };
    source: { width: number; height: number };
  },
  docX: number,
  docY: number,
): { x: number; y: number } {
  const t = layer.transform;
  // Ignore rotation for paint MVP (same as AABB transform handles).
  return {
    x: (docX - t.x) / (t.scaleX || 1),
    y: (docY - t.y) / (t.scaleY || 1),
  };
}

export type PaintMode = "brush" | "pencil" | "eraser";

export interface StrokeStyle {
  mode: PaintMode;
  color: string;
  size: number;
  /** Stroke-level opacity cap (0..1) — applied when the stroke buffer composites. */
  opacity: number;
  /** Edge softness 0..1 (1 = hard edge, 0 = very soft). */
  hardness: number;
  /** Per-stamp alpha 0..1 — how fast paint builds up along the stroke. */
  flow: number;
  /** Distance between stamps as a fraction of size (0.01..1). Lower = smoother. */
  spacing: number;
}

export const DEFAULT_STROKE_STYLE: StrokeStyle = {
  mode: "brush",
  color: "#ffffff",
  size: 24,
  opacity: 1,
  hardness: 0.6,
  flow: 0.85,
  spacing: 0.12,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Lay down one stamp of *coverage* onto a stroke buffer (always source-over).
 * The buffer is later composited over the base at stroke opacity, and eraser
 * mode uses the buffer as a destination-out mask — so buildup never exceeds
 * the opacity cap and there are no dark seams.
 */
export function stamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: StrokeStyle,
): void {
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const { r, g, b } = style.mode === "eraser" ? { r: 0, g: 0, b: 0 } : hexToRgb(style.color);
  const flow = Math.min(1, Math.max(0.02, style.flow));

  if (style.mode === "pencil") {
    const s = Math.max(1, Math.round(style.size));
    ctx.globalAlpha = flow;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(Math.round(x) - Math.floor(s / 2), Math.round(y) - Math.floor(s / 2), s, s);
    ctx.restore();
    return;
  }

  const radius = Math.max(0.5, style.size / 2);
  const solid = Math.min(0.98, Math.max(0, style.hardness));
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${flow})`);
  grad.addColorStop(solid, `rgba(${r},${g},${b},${flow})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Connect two points with evenly-spaced stamps on the stroke buffer. */
export function strokeSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  style: StrokeStyle,
): void {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const spacing = Math.min(1, Math.max(0.02, style.spacing));
  const step = Math.max(0.5, style.size * spacing);
  const n = Math.max(1, Math.ceil(dist / step));
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    stamp(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, style);
  }
}

export interface AdjustmentOptions {
  /** -1..1 */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  /** hue shift in degrees, -180..180 */
  hue?: number;
  /** warm/cool, -1..1 (positive = warmer) */
  temperature?: number;
  /** green/magenta, -1..1 (positive = magenta) */
  tint?: number;
  /** stops-ish exposure, -1..1 */
  exposure?: number;
  /** input black point 0..1 */
  blackPoint?: number;
  /** input white point 0..1 */
  whitePoint?: number;
  /** midtone gamma, >0 (1 = neutral) */
  gamma?: number;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const dlt = max - min;
  let s = 0;
  if (dlt !== 0) {
    s = dlt / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / dlt) % 6;
    else if (max === g) h = (b - r) / dlt + 2;
    else h = (r - g) / dlt + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp >= 0 && hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

/** Apply a full set of tonal/color adjustments to a canvas in place (destructive). */
export function applyAdjustments(canvas: HTMLCanvasElement, opts: AdjustmentOptions): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  const b = opts.brightness ?? 0;
  const c = opts.contrast ?? 0;
  const s = opts.saturation ?? 0;
  const hueShift = opts.hue ?? 0;
  const temp = opts.temperature ?? 0;
  const tint = opts.tint ?? 0;
  const exposure = opts.exposure ?? 0;
  const black = opts.blackPoint ?? 0;
  const white = opts.whitePoint ?? 1;
  const gamma = opts.gamma ?? 1;

  const contrastFactor = (1 + c) / (1.0001 - c);
  const expFactor = Math.pow(2, exposure);
  const levelRange = Math.max(0.0001, white - black);
  const needHsl = s !== 0 || hueShift !== 0;
  const invGamma = 1 / Math.max(0.0001, gamma);

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] / 255;
    let g = d[i + 1] / 255;
    let bl = d[i + 2] / 255;

    // exposure (multiplicative)
    r *= expFactor;
    g *= expFactor;
    bl *= expFactor;

    // brightness (additive)
    r += b;
    g += b;
    bl += b;

    // temperature / tint
    r += temp * 0.15;
    bl -= temp * 0.15;
    g -= tint * 0.15;

    // levels: black/white point + gamma
    r = Math.pow(Math.min(1, Math.max(0, (r - black) / levelRange)), invGamma);
    g = Math.pow(Math.min(1, Math.max(0, (g - black) / levelRange)), invGamma);
    bl = Math.pow(Math.min(1, Math.max(0, (bl - black) / levelRange)), invGamma);

    // contrast around mid-gray
    r = (r - 0.5) * contrastFactor + 0.5;
    g = (g - 0.5) * contrastFactor + 0.5;
    bl = (bl - 0.5) * contrastFactor + 0.5;

    if (needHsl) {
      const cr = Math.min(1, Math.max(0, r));
      const cg = Math.min(1, Math.max(0, g));
      const cb = Math.min(1, Math.max(0, bl));
      const [h0, s0, l0] = rgbToHsl(cr, cg, cb);
      const h1 = (h0 + hueShift + 360) % 360;
      const s1 = Math.min(1, Math.max(0, s0 * (1 + s)));
      [r, g, bl] = hslToRgb(h1, s1, l0);
    }

    d[i] = Math.round(Math.min(255, Math.max(0, r * 255)));
    d[i + 1] = Math.round(Math.min(255, Math.max(0, g * 255)));
    d[i + 2] = Math.round(Math.min(255, Math.max(0, bl * 255)));
  }
  ctx.putImageData(image, 0, 0);
}

export type FilterKind =
  | "grayscale"
  | "sepia"
  | "invert"
  | "blur"
  | "sharpen"
  | "vignette";

/** Apply a one-shot filter to a canvas in place (destructive). */
export function applyFilter(canvas: HTMLCanvasElement, kind: FilterKind): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;

  if (kind === "blur" || kind === "sharpen") {
    convolve(ctx, width, height, kind);
    return;
  }

  const image = ctx.getImageData(0, 0, width, height);
  const d = image.data;

  if (kind === "vignette") {
    const cx = width / 2;
    const cy = height / 2;
    const maxD = Math.hypot(cx, cy);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const dist = Math.hypot(x - cx, y - cy) / maxD;
        const factor = 1 - Math.pow(Math.max(0, dist - 0.35) / 0.65, 2) * 0.85;
        d[i] *= factor;
        d[i + 1] *= factor;
        d[i + 2] *= factor;
      }
    }
    ctx.putImageData(image, 0, 0);
    return;
  }

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    if (kind === "grayscale") {
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      d[i] = d[i + 1] = d[i + 2] = y;
    } else if (kind === "invert") {
      d[i] = 255 - r;
      d[i + 1] = 255 - g;
      d[i + 2] = 255 - b;
    } else if (kind === "sepia") {
      d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      d[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      d[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** 3×3 convolution for blur / sharpen (edge-clamped, alpha preserved). */
function convolve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: "blur" | "sharpen",
): void {
  const src = ctx.getImageData(0, 0, width, height);
  const out = ctx.createImageData(width, height);
  const s = src.data;
  const o = out.data;
  const kernel =
    kind === "blur"
      ? [1, 2, 1, 2, 4, 2, 1, 2, 1]
      : [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const weight = kind === "blur" ? 16 : 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(width - 1, Math.max(0, x + kx));
          const py = Math.min(height - 1, Math.max(0, y + ky));
          const idx = (py * width + px) * 4;
          const kv = kernel[k++];
          r += s[idx] * kv;
          g += s[idx + 1] * kv;
          b += s[idx + 2] * kv;
        }
      }
      const di = (y * width + x) * 4;
      o[di] = Math.min(255, Math.max(0, r / weight));
      o[di + 1] = Math.min(255, Math.max(0, g / weight));
      o[di + 2] = Math.min(255, Math.max(0, b / weight));
      o[di + 3] = s[di + 3];
    }
  }
  ctx.putImageData(out, 0, 0);
}

/**
 * Content-aware-ish fill: replace masked pixels by diffusing color inward from
 * the surrounding known pixels (iterative neighbor averaging). Good for small
 * blemish/object cleanup ("magic eraser"). Operates only within `bounds`.
 */
export function inpaintRegion(
  canvas: HTMLCanvasElement,
  mask: Uint8Array,
  bounds: { x: number; y: number; width: number; height: number },
  iterations = 60,
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const W = canvas.width;
  const bx = Math.max(0, Math.floor(bounds.x));
  const by = Math.max(0, Math.floor(bounds.y));
  const bw = Math.min(canvas.width - bx, Math.ceil(bounds.width));
  const bh = Math.min(canvas.height - by, Math.ceil(bounds.height));
  if (bw <= 0 || bh <= 0) return;

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  // Seed masked pixels with the average of nearby unmasked pixels so diffusion
  // starts from something reasonable.
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        const p = y * W + x;
        if (mask[p] === 0) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
          [x - 1, y - 1],
          [x + 1, y - 1],
          [x - 1, y + 1],
          [x + 1, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) continue;
          const np = ny * W + nx;
          // Prefer known pixels; on later iterations also pull from filled ones.
          const i = np * 4;
          const weight = mask[np] === 0 ? 2 : 1;
          r += d[i] * weight;
          g += d[i + 1] * weight;
          b += d[i + 2] * weight;
          n += weight;
        }
        if (n > 0) {
          const i = p * 4;
          d[i] = r / n;
          d[i + 1] = g / n;
          d[i + 2] = b / n;
          d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * Exemplar-based content-aware fill ("magic eraser" quality). Instead of
 * averaging neighbours (which blurs), it fills the masked region by copying
 * real texture: peel the hole from its border inward and, for each frontier
 * pixel, find the best-matching known patch nearby and copy its centre pixel.
 * This preserves edges and texture. Falls back to diffusion for huge masks.
 */
export function contentAwareFill(
  canvas: HTMLCanvasElement,
  mask: Uint8Array,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const bx = Math.max(0, Math.floor(bounds.x));
  const by = Math.max(0, Math.floor(bounds.y));
  const bw = Math.min(W - bx, Math.ceil(bounds.width));
  const bh = Math.min(H - by, Math.ceil(bounds.height));
  if (bw <= 0 || bh <= 0) return;

  let maskCount = 0;
  for (let y = by; y < by + bh; y++) {
    for (let x = bx; x < bx + bw; x++) if (mask[y * W + x]) maskCount++;
  }
  if (maskCount === 0) return;
  // Very large regions: patch search gets expensive — use the cheaper diffusion.
  if (maskCount > 45000) {
    inpaintRegion(canvas, mask, bounds, 80);
    return;
  }

  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const filled = new Uint8Array(W * H); // 1 = known/available as a sample source
  for (let i = 0; i < W * H; i++) filled[i] = mask[i] ? 0 : 1;

  const patchR = 2; // 5×5 comparison patch
  const searchR = Math.max(16, Math.min(56, Math.max(bw, bh)));
  const searchStep = maskCount > 12000 ? 3 : 2;

  const patchDistance = (px: number, py: number, qx: number, qy: number): number => {
    let sum = 0;
    let n = 0;
    for (let dy = -patchR; dy <= patchR; dy++) {
      for (let dx = -patchR; dx <= patchR; dx++) {
        const ax = px + dx;
        const ay = py + dy;
        const bxp = qx + dx;
        const byp = qy + dy;
        if (ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
        if (bxp < 0 || byp < 0 || bxp >= W || byp >= H) continue;
        // Compare only where the target patch is already known.
        if (!filled[ay * W + ax]) continue;
        if (!filled[byp * W + bxp]) return Number.POSITIVE_INFINITY; // source must be fully known
        const ai = (ay * W + ax) * 4;
        const bi = (byp * W + bxp) * 4;
        const dr = d[ai] - d[bi];
        const dg = d[ai + 1] - d[bi + 1];
        const db = d[ai + 2] - d[bi + 2];
        sum += dr * dr + dg * dg + db * db;
        n++;
      }
    }
    return n === 0 ? Number.POSITIVE_INFINITY : sum / n;
  };

  const isFrontier = (x: number, y: number): boolean => {
    if (filled[y * W + x]) return false;
    return Boolean(
      (x > 0 && filled[y * W + x - 1]) ||
        (x < W - 1 && filled[y * W + x + 1]) ||
        (y > 0 && filled[(y - 1) * W + x]) ||
        (y < H - 1 && filled[(y + 1) * W + x]),
    );
  };

  let remaining = maskCount;
  let guard = maskCount + 16; // safety against stalls
  while (remaining > 0 && guard-- > 0) {
    const frontier: number[] = [];
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        if (isFrontier(x, y)) frontier.push(y * W + x);
      }
    }
    if (frontier.length === 0) break;

    for (const p of frontier) {
      const px = p % W;
      const py = (p - px) / W;
      let best = Number.POSITIVE_INFINITY;
      let bestI = -1;
      const sx0 = Math.max(patchR, px - searchR);
      const sx1 = Math.min(W - 1 - patchR, px + searchR);
      const sy0 = Math.max(patchR, py - searchR);
      const sy1 = Math.min(H - 1 - patchR, py + searchR);
      for (let qy = sy0; qy <= sy1; qy += searchStep) {
        for (let qx = sx0; qx <= sx1; qx += searchStep) {
          if (!filled[qy * W + qx]) continue;
          const dist = patchDistance(px, py, qx, qy);
          if (dist < best) {
            best = dist;
            bestI = (qy * W + qx) * 4;
          }
        }
      }
      const pi = p * 4;
      if (bestI >= 0) {
        d[pi] = d[bestI];
        d[pi + 1] = d[bestI + 1];
        d[pi + 2] = d[bestI + 2];
        d[pi + 3] = 255;
      }
      filled[p] = 1;
      remaining--;
    }
  }

  // Any stragglers (isolated): fill from immediate known neighbours.
  if (remaining > 0) {
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        const p = y * W + x;
        if (mask[p] && !filled[p]) {
          const i = p * 4;
          d[i + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Clear a rectangular region (layer-local) — used by selection cut. */
export function clearRectOnSource(
  source: RasterSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): HTMLCanvasElement {
  const canvas = sourceToCanvas(source);
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(sx, sy, sw, sh);
  return canvas;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  fillColor: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  /** Outline color; empty/undefined = no outline. */
  strokeColor?: string;
  /** Outline width in px (0 = none). */
  strokeWidth?: number;
  /** Drop-shadow color; empty/undefined = no shadow. */
  shadowColor?: string;
  /** Shadow blur radius in px (0 = crisp). */
  shadowBlur?: number;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 48,
  fontFamily: "Inter, sans-serif",
  fillColor: "#ffffff",
  bold: false,
  italic: false,
  align: "left",
  strokeColor: "",
  strokeWidth: 0,
  shadowColor: "",
  shadowBlur: 0,
};

/** Render styled text into a raster source (newlines, weight/style, align, stroke, shadow). */
export async function renderTextSource(text: string, style: TextStyle): Promise<RasterSource> {
  const {
    fontSize,
    fontFamily,
    fillColor,
    bold = false,
    italic = false,
    align = "left",
    strokeColor = "",
    strokeWidth = 0,
    shadowColor = "",
    shadowBlur = 0,
  } = style;

  const lines = (text || "Text").split("\n");
  const weight = bold ? "700" : "400";
  const slant = italic ? "italic " : "";
  const font = `${slant}${weight} ${fontSize}px ${fontFamily}`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, measure.measureText(line || " ").width);
  }

  const hasShadow = !!shadowColor && shadowBlur >= 0 && shadowColor !== "";
  const shadowOffset = hasShadow ? Math.max(2, Math.round(fontSize * 0.06)) : 0;
  // Padding must fit the stroke halo + shadow blur/offset so nothing clips.
  const padding = 16 + Math.ceil(strokeWidth) + Math.ceil(shadowBlur) + shadowOffset;
  const lineHeight = Math.ceil(fontSize * 1.35);
  const canvas = document.createElement("canvas");
  const contentW = Math.ceil(maxW);
  canvas.width = Math.max(1, contentW + padding * 2);
  canvas.height = Math.max(1, lineHeight * lines.length + padding * 2);

  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  ctx.lineJoin = "round";

  const anchorX = align === "center" ? padding + contentW / 2 : align === "right" ? padding + contentW : padding;

  lines.forEach((line, i) => {
    const y = padding + i * lineHeight;
    if (hasShadow) {
      ctx.save();
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetX = shadowOffset;
      ctx.shadowOffsetY = shadowOffset;
      ctx.fillStyle = fillColor;
      ctx.fillText(line, anchorX, y);
      ctx.restore();
    }
    if (strokeColor && strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeText(line, anchorX, y);
    }
    ctx.fillStyle = fillColor;
    ctx.fillText(line, anchorX, y);
  });
  return canvasToSource(canvas);
}
