/**
 * The Typography Analyzer's brain.
 *
 * It takes HTML and CSS — from a fetched URL or pasted by hand, it makes no
 * difference here — and reports what the type system looks like and where it
 * is likely to hurt.
 */

import {
  parseCss,
  splitFontFamilies,
  unquote,
  type Declaration,
  type FontFaceRule,
} from "./parse-css";
import {
  analyzeScale,
  parseLength,
  parseLineHeight,
  type ScaleAnalysis,
} from "./scale";

export type FontClassification = "serif" | "sans-serif" | "monospace" | "display" | "unknown";
export type FontOrigin = "google-fonts" | "self-hosted" | "system" | "unknown";

export interface FontFamilyUsage {
  name: string;
  /** How many declarations name this family. */
  count: number;
  classification: FontClassification;
  origin: FontOrigin;
  /** True when the family is a CSS generic like `sans-serif`. */
  generic: boolean;
}

export interface SizeUsage {
  raw: string;
  px: number | null;
  unit: string;
  count: number;
}

export interface WeightUsage {
  value: string;
  count: number;
}

export interface HeadingStructure {
  counts: Record<string, number>;
  /** Levels present in the document, ascending. */
  levels: number[];
}

export type FindingSeverity = "error" | "warning" | "info";

export interface Finding {
  severity: FindingSeverity;
  title: string;
  detail: string;
}

export interface TypographyReport {
  families: FontFamilyUsage[];
  sizes: SizeUsage[];
  weights: WeightUsage[];
  letterSpacings: SizeUsage[];
  fontFaces: FontFaceRule[];
  scale: ScaleAnalysis;
  headings: HeadingStructure;
  breakpoints: string[];
  findings: Finding[];
  /** Total typography declarations seen, useful for "is this page empty?". */
  declarationCount: number;
  hasViewportMeta: boolean;
}

const GENERIC_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
  "math",
  "emoji",
  "fangsong",
  "inherit",
  "initial",
  "unset",
  "revert",
]);

/**
 * Font stacks that ship with operating systems. Recognising these matters
 * because they cost nothing to load, so they should not be counted against a
 * page's web-font budget.
 */
const SYSTEM_FAMILIES = new Set([
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica neue",
  "helvetica",
  "arial",
  "noto sans",
  "apple color emoji",
  "segoe ui emoji",
  "segoe ui symbol",
  "noto color emoji",
  "times new roman",
  "times",
  "georgia",
  "courier new",
  "courier",
  "menlo",
  "monaco",
  "consolas",
  "liberation mono",
  "sf mono",
  "cascadia code",
  "tahoma",
  "verdana",
]);

const SERIF_HINTS = ["serif", "georgia", "times", "garamond", "playfair", "merriweather", "lora", "libre baskerville", "source serif", "pt serif", "crimson", "spectral"];
const MONO_HINTS = ["mono", "consolas", "menlo", "courier", "code", "hack", "inconsolata", "fira code"];
const DISPLAY_HINTS = ["display", "bebas", "oswald", "anton", "abril", "lobster", "pacifico", "righteous"];

function classifyFamily(name: string): FontClassification {
  const lower = name.toLowerCase();

  if (lower === "monospace" || MONO_HINTS.some((hint) => lower.includes(hint))) {
    return "monospace";
  }
  if (lower === "sans-serif" || lower.includes("sans")) return "sans-serif";
  if (DISPLAY_HINTS.some((hint) => lower.includes(hint))) return "display";
  if (SERIF_HINTS.some((hint) => lower.includes(hint))) return "serif";
  if (lower === "cursive" || lower === "fantasy") return "display";
  if (SYSTEM_FAMILIES.has(lower)) return "sans-serif";

  return "unknown";
}

/** Pulls font family names out of Google Fonts URLs, css2 and legacy alike. */
export function googleFontFamilies(urls: string[]): Set<string> {
  const families = new Set<string>();

  for (const raw of urls) {
    if (!/fonts\.googleapis\.com/i.test(raw)) continue;

    let url: URL;
    try {
      url = new URL(raw, "https://fonts.googleapis.com");
    } catch {
      continue;
    }

    for (const value of url.searchParams.getAll("family")) {
      // css2 uses `Inter:wght@400;700`; css uses `Inter:400,700`.
      const name = value.split(":")[0].replace(/\+/g, " ").trim();
      if (name) families.add(name.toLowerCase());
    }
  }

  return families;
}

function tally<T>(items: T[], key: (item: T) => string): Map<string, { item: T; count: number }> {
  const map = new Map<string, { item: T; count: number }>();
  for (const item of items) {
    const id = key(item);
    const existing = map.get(id);
    if (existing) existing.count += 1;
    else map.set(id, { item, count: 1 });
  }
  return map;
}

/** Counts `<h1>`-`<h6>` elements without needing a DOM. */
export function readHeadings(html: string): HeadingStructure {
  const counts: Record<string, number> = {};
  const levels: number[] = [];

  for (let level = 1; level <= 6; level += 1) {
    const matches = html.match(new RegExp(`<h${level}\\b`, "gi"));
    const count = matches?.length ?? 0;
    counts[`h${level}`] = count;
    if (count > 0) levels.push(level);
  }

  return { counts, levels };
}

/** Extracts min-width / max-width breakpoints from media query conditions. */
export function readBreakpoints(mediaQueries: string[]): string[] {
  const widths = new Set<string>();

  for (const query of mediaQueries) {
    const pattern = /\(\s*(?:min|max)-width\s*:\s*([^)]+)\)/gi;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const length = parseLength(match[1]);
      if (length?.px) widths.add(`${Math.round(length.px)}px`);
    }
  }

  return Array.from(widths).sort(
    (a, b) => Number.parseFloat(a) - Number.parseFloat(b),
  );
}

/** True when a declaration targets the page body rather than a component. */
function isBodyScope(declaration: Declaration): boolean {
  return /(^|,)\s*(html|body|:root|\*)\s*(,|$)/i.test(declaration.selector);
}

/** True specifically for `body`, as opposed to `html` or `:root`. */
function isBodyElement(declaration: Declaration): boolean {
  return /(^|,)\s*body\s*(,|$)/i.test(declaration.selector);
}

/**
 * Finds the declaration that sets body copy.
 *
 * `body` wins over `html` and `:root`: a page that sets `:root { font-size:
 * 16px }` and `body { font-size: 13px }` has 13px body copy, and taking
 * whichever rule appeared first would report the wrong number. Rules inside a
 * media query are skipped so the finding describes the default, not one
 * breakpoint.
 */
function findBodyDeclaration(
  declarations: Declaration[],
  property: string,
): Declaration | undefined {
  const candidates = declarations.filter(
    (declaration) =>
      declaration.property === property && !declaration.media && isBodyScope(declaration),
  );
  // Later rules win over earlier ones at equal specificity, so read from the end.
  return (
    candidates.findLast(isBodyElement) ?? candidates[candidates.length - 1]
  );
}

export interface AnalyzeInput {
  html: string;
  /** Every stylesheet's text; they are analyzed as one corpus. */
  css: string[];
}

export function analyzeTypography({ html, css }: AnalyzeInput): TypographyReport {
  const parsed = css.map(parseCss);

  const declarations = parsed.flatMap((sheet) => sheet.declarations);
  const fontFaces = parsed.flatMap((sheet) => sheet.fontFaces);
  const imports = parsed.flatMap((sheet) => sheet.imports);
  const mediaQueries = Array.from(
    new Set(parsed.flatMap((sheet) => sheet.mediaQueries)),
  );

  // Google Fonts arrive either as an @import or as a <link> in the HTML.
  const linkHrefs = Array.from(
    html.matchAll(/<link\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi),
  ).map((match) => match[1] ?? match[2] ?? match[3] ?? "");
  const googleFamilies = googleFontFamilies([...imports, ...linkHrefs]);
  const selfHosted = new Set(fontFaces.map((face) => face.family.toLowerCase()));

  // --- Families ---------------------------------------------------------
  const familyMentions: string[] = [];
  for (const declaration of declarations) {
    if (declaration.property !== "font-family" && declaration.property !== "font") {
      continue;
    }
    for (const family of splitFontFamilies(declaration.value)) {
      const name = unquote(family);
      // var(--font-body) tells us nothing about which typeface is used.
      if (!name || name.startsWith("var(") || name.startsWith("calc(")) continue;
      familyMentions.push(name);
    }
  }

  const families: FontFamilyUsage[] = Array.from(
    tally(familyMentions, (name) => name.toLowerCase()).values(),
  )
    .map(({ item, count }) => {
      const lower = item.toLowerCase();
      const generic = GENERIC_FAMILIES.has(lower);

      let origin: FontOrigin = "unknown";
      if (googleFamilies.has(lower)) origin = "google-fonts";
      else if (selfHosted.has(lower)) origin = "self-hosted";
      else if (generic || SYSTEM_FAMILIES.has(lower)) origin = "system";

      return {
        name: item,
        count,
        classification: classifyFamily(item),
        origin,
        generic,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // --- Sizes ------------------------------------------------------------
  const sizeDeclarations = declarations.filter((d) => d.property === "font-size");
  const sizes: SizeUsage[] = Array.from(
    tally(sizeDeclarations, (d) => d.value.toLowerCase()).values(),
  )
    .map(({ item, count }) => {
      const length = parseLength(item.value);
      return {
        raw: item.value,
        px: length?.px ?? null,
        unit: length?.unit ?? "unknown",
        count,
      };
    })
    .sort((a, b) => (a.px ?? Infinity) - (b.px ?? Infinity));

  const scale = analyzeScale(
    sizes.map((size) => size.px).filter((px): px is number => px !== null),
  );

  // --- Weights and letter spacing --------------------------------------
  const weights: WeightUsage[] = Array.from(
    tally(
      declarations.filter((d) => d.property === "font-weight"),
      (d) => d.value.toLowerCase(),
    ).values(),
  )
    .map(({ item, count }) => ({ value: item.value, count }))
    .sort((a, b) => b.count - a.count);

  const letterSpacings: SizeUsage[] = Array.from(
    tally(
      declarations.filter((d) => d.property === "letter-spacing"),
      (d) => d.value.toLowerCase(),
    ).values(),
  )
    .map(({ item, count }) => {
      const length = parseLength(item.value);
      return {
        raw: item.value,
        px: length?.px ?? null,
        unit: length?.unit ?? "unknown",
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const headings = readHeadings(html);
  const breakpoints = readBreakpoints(mediaQueries);
  const hasViewportMeta = /<meta\b[^>]*name\s*=\s*["']?viewport/i.test(html);

  const findings = buildFindings({
    declarations,
    families,
    sizes,
    weights,
    fontFaces,
    scale,
    headings,
    hasViewportMeta,
    hasHtml: html.trim().length > 0,
  });

  return {
    families,
    sizes,
    weights,
    letterSpacings,
    fontFaces,
    scale,
    headings,
    breakpoints,
    findings,
    declarationCount: declarations.length,
    hasViewportMeta,
  };
}

interface FindingsInput {
  declarations: Declaration[];
  families: FontFamilyUsage[];
  sizes: SizeUsage[];
  weights: WeightUsage[];
  fontFaces: FontFaceRule[];
  scale: ScaleAnalysis;
  headings: HeadingStructure;
  hasViewportMeta: boolean;
  hasHtml: boolean;
}

/**
 * Turns the raw inventory into advice.
 *
 * Each finding names the number that triggered it, because "12 distinct sizes"
 * is actionable in a way that "too many sizes" is not.
 */
export function buildFindings(input: FindingsInput): Finding[] {
  const findings: Finding[] = [];
  const {
    declarations,
    families,
    sizes,
    weights,
    fontFaces,
    scale,
    headings,
    hasViewportMeta,
    hasHtml,
  } = input;

  // --- Body text --------------------------------------------------------
  const bodySize = findBodyDeclaration(declarations, "font-size");
  const bodySizePx = bodySize ? parseLength(bodySize.value)?.px ?? null : null;

  if (bodySizePx !== null && bodySizePx < 16) {
    findings.push({
      severity: "warning",
      title: `Body text is set to ${bodySizePx}px`,
      detail:
        "Below 16px, body copy gets hard to read on phones and triggers zoom-on-focus in iOS Safari. 16px is the browser default for a reason.",
    });
  }

  const bodyLineHeight = findBodyDeclaration(declarations, "line-height");
  if (bodyLineHeight) {
    const { ratio } = parseLineHeight(bodyLineHeight.value, bodySizePx ?? 16);
    if (ratio !== null && ratio < 1.4) {
      findings.push({
        severity: "warning",
        title: `Body line-height is ${ratio.toFixed(2)}`,
        detail:
          "WCAG 1.4.12 asks for at least 1.5 in blocks of text. Anything under about 1.4 makes paragraphs feel cramped and hurts readers with dyslexia.",
      });
    }
  }

  const pixelLineHeights = declarations.filter(
    (d) => d.property === "line-height" && parseLength(d.value)?.unit === "px",
  );
  if (pixelLineHeights.length > 0) {
    findings.push({
      severity: "info",
      title: `${pixelLineHeights.length} line-height ${pixelLineHeights.length === 1 ? "value is" : "values are"} set in px`,
      detail:
        "A unitless line-height scales with the element's own font size; a px value does not, so it breaks the moment the text size changes.",
    });
  }

  // --- Scale ------------------------------------------------------------
  if (sizes.length > 10) {
    findings.push({
      severity: "warning",
      title: `${sizes.length} distinct font sizes`,
      detail:
        "Most design systems get by on six to eight steps. A long tail of one-off sizes usually means the scale is being worked around rather than used.",
    });
  }

  if (scale.sizes.length >= 3) {
    if (scale.ratio && scale.consistency >= 70) {
      findings.push({
        severity: "info",
        title: `Sizes follow a ${scale.ratio.name.toLowerCase()} scale (${scale.ratio.ratio})`,
        detail: `The steps between sizes are consistent (${scale.consistency}/100), which is the sign of a deliberate type scale.`,
      });
    } else if (scale.consistency < 45) {
      findings.push({
        severity: "warning",
        title: `Font sizes do not follow a consistent scale (${scale.consistency}/100)`,
        detail:
          "The jumps between sizes vary widely, so the sizes were probably picked one at a time. Picking one ratio and generating the steps from it is the usual fix.",
      });
    }
  }

  // --- Web font budget --------------------------------------------------
  const webFonts = families.filter(
    (family) => family.origin === "google-fonts" || family.origin === "self-hosted",
  );
  if (webFonts.length > 2) {
    findings.push({
      severity: "warning",
      title: `${webFonts.length} web font families are loaded`,
      detail:
        `Each family is a separate download before text can render in its final form. Loaded here: ${webFonts.map((f) => f.name).join(", ")}.`,
    });
  }

  const numericWeights = weights.filter((weight) => /^\d+$/.test(weight.value));
  if (numericWeights.length > 4) {
    findings.push({
      severity: "warning",
      title: `${numericWeights.length} numeric font weights are in use`,
      detail:
        `Every weight is another font file unless the family is variable. In use: ${numericWeights.map((w) => w.value).join(", ")}.`,
    });
  }

  const facesWithoutDisplay = fontFaces.length;
  if (facesWithoutDisplay > 0) {
    findings.push({
      severity: "info",
      title: `${facesWithoutDisplay} self-hosted @font-face ${facesWithoutDisplay === 1 ? "rule" : "rules"}`,
      detail:
        "Self-hosting keeps fonts on your own domain, which is good for privacy and caching. Check that each rule sets font-display so text stays visible while the font loads.",
    });
  }

  const missingFallback = families.filter(
    (family) =>
      !family.generic &&
      (family.origin === "google-fonts" || family.origin === "self-hosted"),
  );
  if (missingFallback.length > 0 && !families.some((family) => family.generic)) {
    findings.push({
      severity: "warning",
      title: "No generic fallback in the font stacks",
      detail:
        "Ending a font stack with serif, sans-serif or monospace gives the browser something sensible to use when the web font fails to load.",
    });
  }

  // --- Document structure ----------------------------------------------
  if (hasHtml) {
    if (headings.counts.h1 === 0) {
      findings.push({
        severity: "warning",
        title: "No <h1> on the page",
        detail:
          "Screen reader users navigate by headings, and the h1 is where they start. Every page wants exactly one.",
      });
    } else if (headings.counts.h1 > 1) {
      findings.push({
        severity: "warning",
        title: `${headings.counts.h1} <h1> elements`,
        detail:
          "More than one top-level heading leaves the document outline ambiguous. Demote the extras to h2.",
      });
    }

    for (let i = 1; i < headings.levels.length; i += 1) {
      const gap = headings.levels[i] - headings.levels[i - 1];
      if (gap > 1) {
        findings.push({
          severity: "warning",
          title: `Heading levels skip from h${headings.levels[i - 1]} to h${headings.levels[i]}`,
          detail:
            "Skipped levels break the outline assistive technology builds from the page. Style the heading you need rather than choosing it by size.",
        });
        break;
      }
    }

    if (!hasViewportMeta) {
      findings.push({
        severity: "error",
        title: "No viewport meta tag",
        detail:
          'Without <meta name="viewport" content="width=device-width, initial-scale=1">, mobile browsers render the page at desktop width and scale it down.',
      });
    }
  }

  const order: Record<FindingSeverity, number> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]);
}
