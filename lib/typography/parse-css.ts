/**
 * A deliberately small CSS reader.
 *
 * A full CSS parser is a large dependency and a large attack surface for what
 * this tool needs: find the typography declarations, the @font-face rules, the
 * font imports and the media query breakpoints. Everything else in the
 * stylesheet is skipped rather than modelled.
 *
 * This is a lossy reader, not a parser — it will not round-trip a stylesheet,
 * and it does not resolve the cascade. It reports what a stylesheet *declares*,
 * which is what a typography audit is actually about.
 */

export interface Declaration {
  selector: string;
  property: string;
  value: string;
  /** The media query the rule sits inside, if any. */
  media?: string;
}

export interface FontFaceRule {
  family: string;
  weights: string[];
  sources: string[];
}

export interface ParsedCss {
  declarations: Declaration[];
  fontFaces: FontFaceRule[];
  /** Absolute URLs from @import rules. */
  imports: string[];
  /** Raw media query conditions, deduplicated. */
  mediaQueries: string[];
  /** Custom property definitions, e.g. `--font-body`. */
  customProperties: Record<string, string>;
}

/** Properties a typography audit cares about. Everything else is discarded. */
export const TYPE_PROPERTIES = [
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
] as const;

const TYPE_PROPERTY_SET: ReadonlySet<string> = new Set(TYPE_PROPERTIES);

/** Removes comments so they cannot be mistaken for declarations. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function splitDeclarations(block: string): { property: string; value: string }[] {
  const out: { property: string; value: string }[] = [];
  let depth = 0;
  let current = "";

  const flush = () => {
    const text = current.trim();
    current = "";
    if (!text) return;
    const colon = text.indexOf(":");
    if (colon === -1) return;
    const property = text.slice(0, colon).trim().toLowerCase();
    const value = text.slice(colon + 1).trim();
    if (property && value) out.push({ property, value });
  };

  for (const char of block) {
    // Semicolons inside url(...) or a data URI must not split a declaration.
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === ";" && depth === 0) {
      flush();
      continue;
    }
    current += char;
  }
  flush();

  return out;
}

function parseFontFace(block: string): FontFaceRule | null {
  const declarations = splitDeclarations(block);
  const family = declarations.find((d) => d.property === "font-family")?.value;
  if (!family) return null;

  const weight = declarations.find((d) => d.property === "font-weight")?.value;
  const src = declarations.find((d) => d.property === "src")?.value ?? "";

  const sources: string[] = [];
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(src)) !== null) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value) sources.push(value);
  }

  return {
    family: unquote(family),
    weights: weight ? [weight] : [],
    sources,
  };
}

export function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Walks the stylesheet block by block. At-rules that contain other rules
 * (`@media`, `@supports`, `@layer`) are recursed into; at-rules that do not
 * (`@font-face`, `@import`) are handled directly.
 */
export function parseCss(source: string): ParsedCss {
  const css = stripComments(source);
  const result: ParsedCss = {
    declarations: [],
    fontFaces: [],
    imports: [],
    mediaQueries: [],
    customProperties: {},
  };

  const seenMedia = new Set<string>();

  const walk = (input: string, media?: string): void => {
    let index = 0;

    while (index < input.length) {
      const braceStart = input.indexOf("{", index);

      if (braceStart === -1) {
        collectAtRules(input.slice(index), result);
        return;
      }

      const preludeRaw = input.slice(index, braceStart);
      // Statements before this block that end in `;` are at-rules like @import.
      const lastSemicolon = preludeRaw.lastIndexOf(";");
      if (lastSemicolon !== -1) {
        collectAtRules(preludeRaw.slice(0, lastSemicolon + 1), result);
      }
      const prelude = preludeRaw.slice(lastSemicolon + 1).trim();

      // Find the matching closing brace.
      let depth = 1;
      let cursor = braceStart + 1;
      while (cursor < input.length && depth > 0) {
        if (input[cursor] === "{") depth += 1;
        else if (input[cursor] === "}") depth -= 1;
        cursor += 1;
      }
      const body = input.slice(braceStart + 1, cursor - 1);
      index = cursor;

      if (prelude.startsWith("@")) {
        const atName = /^@([a-zA-Z-]+)/.exec(prelude)?.[1].toLowerCase() ?? "";

        if (atName === "font-face") {
          const face = parseFontFace(body);
          if (face) result.fontFaces.push(face);
          continue;
        }

        if (atName === "media") {
          const condition = prelude.slice("@media".length).trim();
          if (condition && !seenMedia.has(condition)) {
            seenMedia.add(condition);
            result.mediaQueries.push(condition);
          }
          walk(body, condition);
          continue;
        }

        if (atName === "supports" || atName === "layer" || atName === "container") {
          walk(body, media);
          continue;
        }

        // @keyframes and friends hold no typography worth auditing.
        continue;
      }

      if (!prelude) continue;

      for (const { property, value } of splitDeclarations(body)) {
        if (property.startsWith("--")) {
          result.customProperties[property] = value;
          continue;
        }
        if (!TYPE_PROPERTY_SET.has(property)) continue;
        result.declarations.push({ selector: prelude, property, value, media });
      }
    }
  };

  walk(css);
  return result;
}

function collectAtRules(segment: string, result: ParsedCss): void {
  const importPattern = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi;
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(segment)) !== null) {
    result.imports.push(match[1]);
  }
}

/**
 * Splits a `font-family` value into its individual families, respecting quotes.
 * `"Helvetica Neue", Arial, sans-serif` becomes three entries.
 */
export function splitFontFamilies(value: string): string[] {
  const families: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const char of value) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ",") {
      if (current.trim()) families.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) families.push(current.trim());
  return families;
}
