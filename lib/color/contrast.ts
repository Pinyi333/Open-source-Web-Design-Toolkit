/**
 * WCAG 2.1 contrast maths.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

import { srgbToLinear, type Rgb } from "./convert";

export type WcagLevel = "AAA" | "AA" | "AA Large" | "Fail";

export interface ContrastReport {
  ratio: number;
  /** Passes 4.5:1, the threshold for normal-size body text. */
  aa: boolean;
  /** Passes 7:1. */
  aaa: boolean;
  /** Passes 3:1, the threshold for large text (>=24px, or >=18.66px bold). */
  aaLarge: boolean;
  level: WcagLevel;
}

export const WHITE: Rgb = { r: 255, g: 255, b: 255 };
export const BLACK: Rgb = { r: 0, g: 0, b: 0 };

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** Contrast ratio between two colors, always >= 1 and <= 21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastReport(a: Rgb, b: Rgb): ContrastReport {
  const ratio = contrastRatio(a, b);
  const aaa = ratio >= 7;
  const aa = ratio >= 4.5;
  const aaLarge = ratio >= 3;

  return {
    ratio,
    aa,
    aaa,
    aaLarge,
    level: aaa ? "AAA" : aa ? "AA" : aaLarge ? "AA Large" : "Fail",
  };
}

/**
 * Picks whichever of black or white reads better on `background`.
 * This is the same rule browsers' devtools use for swatch labels.
 */
export function readableForeground(background: Rgb): Rgb {
  return contrastRatio(background, BLACK) >= contrastRatio(background, WHITE)
    ? BLACK
    : WHITE;
}
