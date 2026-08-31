/**
 * Turns an extracted palette into something you can paste into a project.
 *
 * The export shapes are deliberately boring and dependency-free: a string in,
 * a string out, so they are trivial to test and easy for contributors to
 * extend when new formats are requested.
 */

import { formatHsl, formatOklch, rgbToHex, rgbToHsl, rgbToOklch } from "./convert";
import type { Swatch } from "./quantize";

export type ExportFormat = "css" | "tailwind" | "json" | "tokens";

export const EXPORT_FORMATS: { id: ExportFormat; label: string; language: string }[] = [
  { id: "css", label: "CSS variables", language: "css" },
  { id: "tailwind", label: "Tailwind v4", language: "css" },
  { id: "json", label: "JSON", language: "json" },
  { id: "tokens", label: "Design tokens", language: "json" },
];

/**
 * Names swatches `color-1`, `color-2`, ... rather than guessing at human names
 * like "sky blue". Guessed names are wrong often enough to be worse than
 * useless in a file you are about to commit.
 */
function swatchName(index: number): string {
  return `color-${index + 1}`;
}

function toCss(palette: Swatch[]): string {
  const lines = palette.map(
    (swatch, index) => `  --${swatchName(index)}: ${rgbToHex(swatch.color)};`,
  );
  return [":root {", ...lines, "}"].join("\n");
}

function toTailwind(palette: Swatch[]): string {
  const lines = palette.map(
    (swatch, index) =>
      `  --color-${swatchName(index)}: ${formatOklch(rgbToOklch(swatch.color))};`,
  );
  return ['@import "tailwindcss";', "", "@theme {", ...lines, "}"].join("\n");
}

function toJson(palette: Swatch[]): string {
  return JSON.stringify(
    palette.map((swatch, index) => ({
      name: swatchName(index),
      hex: rgbToHex(swatch.color),
      rgb: swatch.color,
      hsl: formatHsl(rgbToHsl(swatch.color)),
      oklch: formatOklch(rgbToOklch(swatch.color)),
      share: Number(swatch.share.toFixed(4)),
    })),
    null,
    2,
  );
}

/**
 * W3C Design Tokens Community Group format. Figma Tokens, Style Dictionary and
 * friends all read this, and it is the format the planned Design Token
 * Generator will build on.
 */
function toTokens(palette: Swatch[]): string {
  const color: Record<string, { $type: string; $value: string }> = {};
  palette.forEach((swatch, index) => {
    color[swatchName(index)] = {
      $type: "color",
      $value: rgbToHex(swatch.color),
    };
  });
  return JSON.stringify({ color }, null, 2);
}

export function exportPalette(palette: Swatch[], format: ExportFormat): string {
  switch (format) {
    case "css":
      return toCss(palette);
    case "tailwind":
      return toTailwind(palette);
    case "json":
      return toJson(palette);
    case "tokens":
      return toTokens(palette);
  }
}
