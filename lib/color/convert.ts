/**
 * Color space conversions.
 *
 * Every function here is pure and side-effect free so it can be unit tested
 * without a DOM. RGB channels are always integers in [0, 255].
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  /** Hue in degrees, [0, 360). */
  h: number;
  /** Saturation as a percentage, [0, 100]. */
  s: number;
  /** Lightness as a percentage, [0, 100]. */
  l: number;
}

export interface Oklch {
  /** Perceptual lightness, [0, 1]. */
  l: number;
  /** Chroma, unbounded in theory but ~[0, 0.4] for sRGB. */
  c: number;
  /** Hue in degrees, [0, 360). */
  h: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Rounds and clamps a channel into the 0-255 integer range. */
export function toChannel(value: number): number {
  return clamp(Math.round(value), 0, 255);
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const hex = (value: number) => toChannel(value).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Parses `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` (alpha is discarded).
 * Returns `null` for anything it does not understand rather than throwing,
 * because most callers are parsing untrusted CSS.
 */
export function hexToRgb(hex: string): Rgb | null {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]+$/.test(value)) return null;

  if (value.length === 3 || value.length === 4) {
    return {
      r: parseInt(value[0] + value[0], 16),
      g: parseInt(value[1] + value[1], 16),
      b: parseInt(value[2] + value[2], 16),
    };
  }

  if (value.length === 6 || value.length === 8) {
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16),
    };
  }

  return null;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }

    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h) % 360,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sn = s / 100;
  const ln = l / 100;

  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = ln - c / 2;

  let rgb: [number, number, number];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];

  return {
    r: toChannel((rgb[0] + m) * 255),
    g: toChannel((rgb[1] + m) * 255),
    b: toChannel((rgb[2] + m) * 255),
  };
}

/** Undoes the sRGB transfer function, mapping [0, 255] to linear [0, 1]. */
export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Applies the sRGB transfer function, mapping linear [0, 1] to [0, 255]. */
export function linearToSrgb(channel: number): number {
  const c =
    channel <= 0.0031308
      ? channel * 12.92
      : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
  return toChannel(c * 255);
}

/**
 * sRGB to Oklch, via Björn Ottosson's Oklab.
 * https://bottosson.github.io/posts/oklab/
 */
export function rgbToOklch(rgb: Rgb): Oklch {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const okL = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const okA = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const okB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(okA * okA + okB * okB);
  let h = (Math.atan2(okB, okA) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l: okL, c, h: c < 1e-6 ? 0 : h };
}

/** Oklch back to sRGB. Out-of-gamut results are clipped per channel. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180;
  const okA = c * Math.cos(hRad);
  const okB = c * Math.sin(hRad);

  const lp = l + 0.3963377774 * okA + 0.2158037573 * okB;
  const mp = l - 0.1055613458 * okA - 0.0638541728 * okB;
  const sp = l - 0.0894841775 * okA - 1.291485548 * okB;

  const lc = lp * lp * lp;
  const mc = mp * mp * mp;
  const sc = sp * sp * sp;

  return {
    r: linearToSrgb(
      4.0767416621 * lc - 3.3077115913 * mc + 0.2309699292 * sc,
    ),
    g: linearToSrgb(
      -1.2684380046 * lc + 2.6097574011 * mc - 0.3413193965 * sc,
    ),
    b: linearToSrgb(
      -0.0041960863 * lc - 0.7034186147 * mc + 1.707614701 * sc,
    ),
  };
}

export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${toChannel(r)}, ${toChannel(g)}, ${toChannel(b)})`;
}

export function formatHsl({ h, s, l }: Hsl): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${(l * 100).toFixed(1)}% ${c.toFixed(3)} ${h.toFixed(1)})`;
}
