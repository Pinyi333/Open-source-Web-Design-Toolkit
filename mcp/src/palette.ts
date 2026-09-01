/**
 * Small glue between hex strings (what agents pass) and the Rgb/Swatch shapes
 * `lib/color` works in. No analysis logic lives here — that stays in lib/.
 */

import {
  formatHsl,
  formatOklch,
  formatRgb,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  type Rgb,
} from "../../lib/color/convert";
import type { Swatch } from "../../lib/color/quantize";

/** Parses a hex color or throws with a message worth showing to the agent. */
export function parseHex(input: string, label = "color"): Rgb {
  const rgb = hexToRgb(input);
  if (!rgb) {
    throw new Error(
      `"${input}" is not a valid ${label}. Expected hex like #1a2b3c or #abc.`,
    );
  }
  return rgb;
}

/** One color in every notation the web app offers. */
export function describeColor(rgb: Rgb) {
  return {
    hex: rgbToHex(rgb),
    rgb: formatRgb(rgb),
    hsl: formatHsl(rgbToHsl(rgb)),
    oklch: formatOklch(rgbToOklch(rgb)),
  };
}

export function describeSwatch(swatch: Swatch) {
  return {
    ...describeColor(swatch.color),
    share: Number(swatch.share.toFixed(4)),
    sampledPixels: swatch.count,
  };
}

/** Builds the Swatch[] the exporters expect from a plain list of colors. */
export function swatchesFromColors(colors: Rgb[]): Swatch[] {
  return colors.map((color) => ({
    color,
    count: 1,
    share: 1 / colors.length,
  }));
}
