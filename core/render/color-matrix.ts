// Pure-math builder for a 4×5 color matrix (PixiJS ColorMatrixFilter format)
// approximating the tonal/color adjustments in raster-edit's applyAdjustments.
// Used for the live GPU preview; the destructive Apply still uses the exact CPU
// path (HSL saturation/hue), so preview ≈ result with tiny differences.

import type { AdjustmentOptions } from "../file-io/raster-edit";

type Matrix = number[]; // length 20, row-major 4 rows × 5 cols

const LUM_R = 0.2126;
const LUM_G = 0.7152;
const LUM_B = 0.0722;

/** Multiply two affine color matrices — result applies `b` first, then `a`. */
function multiply(a: Matrix, b: Matrix): Matrix {
  // Treat each as a 5×5 with an implicit [0 0 0 0 1] bottom row.
  const A = [...a, 0, 0, 0, 0, 1];
  const B = [...b, 0, 0, 0, 0, 1];
  const out: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      let sum = 0;
      for (let k = 0; k < 5; k++) {
        sum += A[row * 5 + k] * B[k * 5 + col];
      }
      out.push(sum);
    }
  }
  return out;
}

function identity(): Matrix {
  return [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
}

function saturationMatrix(sat: number): Matrix {
  // sat is the multiplier (1 = neutral). Luminance-preserving.
  const sr = (1 - sat) * LUM_R;
  const sg = (1 - sat) * LUM_G;
  const sb = (1 - sat) * LUM_B;
  return [
    sr + sat, sg, sb, 0, 0,
    sr, sg + sat, sb, 0, 0,
    sr, sg, sb + sat, 0, 0,
    0, 0, 0, 1, 0,
  ];
}

function hueMatrix(deg: number): Matrix {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    LUM_R + c * (1 - LUM_R) + s * -LUM_R,
    LUM_G + c * -LUM_G + s * -LUM_G,
    LUM_B + c * -LUM_B + s * (1 - LUM_B),
    0,
    0,
    LUM_R + c * -LUM_R + s * 0.143,
    LUM_G + c * (1 - LUM_G) + s * 0.14,
    LUM_B + c * -LUM_B + s * -0.283,
    0,
    0,
    LUM_R + c * -LUM_R + s * -(1 - LUM_R),
    LUM_G + c * -LUM_G + s * LUM_G,
    LUM_B + c * (1 - LUM_B) + s * LUM_B,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ];
}

/**
 * Build the color matrix. Covers exposure, brightness, contrast, black/white
 * levels, temperature, tint (as an affine tonal stage) then saturation and hue
 * (matrix stages). Gamma is approximated as linear (=1) in the preview.
 */
export function buildAdjustmentMatrix(opts: AdjustmentOptions): Matrix {
  const b = opts.brightness ?? 0;
  const c = opts.contrast ?? 0;
  const sat = opts.saturation ?? 0;
  const hue = opts.hue ?? 0;
  const temp = opts.temperature ?? 0;
  const tint = opts.tint ?? 0;
  const exposure = opts.exposure ?? 0;
  const black = opts.blackPoint ?? 0;
  const white = opts.whitePoint ?? 1;

  const expF = Math.pow(2, exposure);
  const cf = (1 + c) / (1.0001 - c);
  const range = Math.max(0.0001, white - black);

  // Per-channel: out = cf * ((expF*v + preOffset - black) / range) + 0.5(1-cf)
  const scale = (cf * expF) / range;
  const common = (cf * (b - black)) / range + 0.5 * (1 - cf);
  const r0 = common + (cf / range) * (temp * 0.15);
  const g0 = common + (cf / range) * (-tint * 0.15);
  const b0 = common + (cf / range) * (-temp * 0.15);

  const tonal: Matrix = [
    scale, 0, 0, 0, r0,
    0, scale, 0, 0, g0,
    0, 0, scale, 0, b0,
    0, 0, 0, 1, 0,
  ];

  let m = tonal;
  if (sat !== 0) m = multiply(saturationMatrix(1 + sat), m);
  if (hue !== 0) m = multiply(hueMatrix(hue), m);
  return m;
}

export function identityMatrix(): Matrix {
  return identity();
}
