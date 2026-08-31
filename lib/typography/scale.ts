/**
 * Length parsing and modular scale detection.
 */

export interface Length {
  value: number;
  unit: string;
  /** Size in px, or null when the unit is relative to something we cannot see. */
  px: number | null;
}

/** The browser default, and the base every rem value is measured against. */
export const ROOT_FONT_SIZE = 16;

/** Absolute conversions to px. `em` and `%` are context-dependent, so excluded. */
const ABSOLUTE_UNITS: Record<string, number> = {
  px: 1,
  rem: ROOT_FONT_SIZE,
  pt: 96 / 72,
  pc: 16,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  q: 96 / 101.6,
};

/** CSS keyword sizes, as resolved by browsers at a 16px root. */
const KEYWORD_SIZES: Record<string, number> = {
  "xx-small": 9,
  "x-small": 10,
  small: 13,
  medium: 16,
  large: 18,
  "x-large": 24,
  "xx-large": 32,
  "xxx-large": 48,
};

/**
 * Parses a CSS length. Returns null for values we cannot resolve to a number,
 * including `calc()`, `clamp()` and custom properties — reporting a wrong
 * number would be worse than reporting none.
 */
export function parseLength(input: string): Length | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  if (value in KEYWORD_SIZES) {
    return { value: KEYWORD_SIZES[value], unit: "keyword", px: KEYWORD_SIZES[value] };
  }

  const match = /^(-?\d*\.?\d+)([a-z%]*)$/.exec(value);
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const unit = match[2] || (number === 0 ? "px" : "");
  if (!unit) return null;

  const factor = ABSOLUTE_UNITS[unit];
  return {
    value: number,
    unit,
    px: factor === undefined ? null : Number((number * factor).toFixed(3)),
  };
}

/**
 * Parses a `line-height` value, which is unitless as often as not.
 * Returns a ratio when one can be worked out from `fontSizePx`.
 */
export function parseLineHeight(
  input: string,
  fontSizePx?: number,
): { raw: string; ratio: number | null; unitless: boolean } {
  const value = input.trim().toLowerCase();

  if (value === "normal") {
    // Browsers pick roughly 1.2 for most fonts; good enough to flag against.
    return { raw: input.trim(), ratio: 1.2, unitless: true };
  }

  const unitless = /^-?\d*\.?\d+$/.test(value);
  if (unitless) {
    return { raw: input.trim(), ratio: Number(value), unitless: true };
  }

  const length = parseLength(value);
  if (length?.px !== null && length !== null && fontSizePx) {
    return { raw: input.trim(), ratio: length.px / fontSizePx, unitless: false };
  }

  if (value.endsWith("%")) {
    const percent = Number(value.slice(0, -1));
    if (Number.isFinite(percent)) {
      return { raw: input.trim(), ratio: percent / 100, unitless: false };
    }
  }

  return { raw: input.trim(), ratio: null, unitless: false };
}

export interface NamedRatio {
  name: string;
  ratio: number;
}

/** The classic modular scale ratios, in the order designers usually reach for. */
export const MODULAR_RATIOS: NamedRatio[] = [
  { name: "Minor second", ratio: 1.067 },
  { name: "Major second", ratio: 1.125 },
  { name: "Minor third", ratio: 1.2 },
  { name: "Major third", ratio: 1.25 },
  { name: "Perfect fourth", ratio: 1.333 },
  { name: "Augmented fourth", ratio: 1.414 },
  { name: "Perfect fifth", ratio: 1.5 },
  { name: "Golden ratio", ratio: 1.618 },
];

export interface ScaleAnalysis {
  /** Distinct sizes in px, ascending. */
  sizes: number[];
  /** The most likely base size — the one closest to 16px. */
  base: number | null;
  /** Best-fitting named ratio, or null when the sizes do not form a scale. */
  ratio: NamedRatio | null;
  /** The geometric mean of the step ratios actually present. */
  measuredRatio: number | null;
  /**
   * 0-100. How closely the observed steps match a single consistent ratio.
   * A page with a tidy scale lands above 80; an ad-hoc one lands well below.
   */
  consistency: number;
}

/**
 * Works out whether a set of font sizes follows a modular scale.
 *
 * Rather than comparing every size to every other, this looks at the ratio
 * between each size and the next one up, which is what a scale is made of.
 */
export function analyzeScale(sizesPx: number[]): ScaleAnalysis {
  const sizes = Array.from(new Set(sizesPx.filter((n) => n > 0))).sort((a, b) => a - b);

  if (sizes.length < 2) {
    return {
      sizes,
      base: sizes[0] ?? null,
      ratio: null,
      measuredRatio: null,
      consistency: 0,
    };
  }

  const base = sizes.reduce((best, size) =>
    Math.abs(size - ROOT_FONT_SIZE) < Math.abs(best - ROOT_FONT_SIZE) ? size : best,
  );

  const steps: number[] = [];
  for (let i = 1; i < sizes.length; i += 1) {
    const step = sizes[i] / sizes[i - 1];
    // Two sizes a hair apart (15px and 16px) are an inconsistency, not a step.
    if (step > 1.01) steps.push(step);
  }

  if (steps.length === 0) {
    return { sizes, base, ratio: null, measuredRatio: null, consistency: 0 };
  }

  const logMean =
    steps.reduce((sum, step) => sum + Math.log(step), 0) / steps.length;
  const measuredRatio = Math.exp(logMean);

  // One step is a pair of sizes, not a scale. Naming a ratio from it would
  // report "minor second" for any two sizes that happen to sit 6% apart.
  if (steps.length < 2) {
    return {
      sizes,
      base,
      ratio: null,
      measuredRatio: Number(measuredRatio.toFixed(4)),
      consistency: 0,
    };
  }

  // Spread of the steps in log space: the smaller it is, the more the sizes
  // look like one scale rather than a pile of one-off values.
  const variance =
    steps.reduce((sum, step) => sum + (Math.log(step) - logMean) ** 2, 0) /
    steps.length;
  const spread = Math.sqrt(variance);
  const consistency = Math.round(Math.max(0, 100 * Math.exp(-spread * 6)));

  let ratio: NamedRatio | null = null;
  let bestDistance = Infinity;
  for (const candidate of MODULAR_RATIOS) {
    const distance = Math.abs(Math.log(candidate.ratio) - logMean);
    if (distance < bestDistance) {
      bestDistance = distance;
      ratio = candidate;
    }
  }
  // Beyond about 6% off, calling it a named ratio would be a stretch. And a
  // ratio is only meaningful if the steps actually cluster around it: the
  // geometric mean of [1.09, 2.51, 1.05] lands near the augmented fourth
  // without those sizes forming anything like a scale.
  if (bestDistance > Math.log(1.06) || consistency < 50) ratio = null;

  return {
    sizes,
    base,
    ratio,
    measuredRatio: Number(measuredRatio.toFixed(4)),
    consistency,
  };
}

export interface ScaleStep {
  step: number;
  px: number;
  rem: number;
  label: string;
}

const STEP_LABELS = ["sm", "base", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];

/** Builds a suggested type scale from a base size and a ratio. */
export function buildScale(base: number, ratio: number, steps = 8): ScaleStep[] {
  const out: ScaleStep[] = [];
  for (let i = 0; i < steps; i += 1) {
    const exponent = i - 1;
    const px = Number((base * Math.pow(ratio, exponent)).toFixed(2));
    out.push({
      step: exponent,
      px,
      rem: Number((px / ROOT_FONT_SIZE).toFixed(4)),
      label: STEP_LABELS[i] ?? `${i}`,
    });
  }
  return out;
}
