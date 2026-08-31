import { describe, expect, it } from "vitest";

import { parseCss, splitFontFamilies, unquote } from "@/lib/typography/parse-css";
import {
  analyzeScale,
  buildScale,
  parseLength,
  parseLineHeight,
} from "@/lib/typography/scale";
import {
  analyzeTypography,
  googleFontFamilies,
  readBreakpoints,
  readHeadings,
} from "@/lib/typography/analyze";

describe("parseCss", () => {
  it("collects typography declarations with their selector", () => {
    const { declarations } = parseCss("h1 { font-size: 2rem; color: red; }");
    expect(declarations).toEqual([
      { selector: "h1", property: "font-size", value: "2rem", media: undefined },
    ]);
  });

  it("ignores properties that are not about type", () => {
    const { declarations } = parseCss("a { color: red; display: block; margin: 0 }");
    expect(declarations).toEqual([]);
  });

  it("strips comments", () => {
    const { declarations } = parseCss("/* h1 { font-size: 99px } */ p { font-size: 1rem }");
    expect(declarations).toHaveLength(1);
    expect(declarations[0].selector).toBe("p");
  });

  it("records the media query a rule sits inside", () => {
    const { declarations, mediaQueries } = parseCss(
      "@media (min-width: 768px) { h1 { font-size: 3rem } }",
    );
    expect(declarations[0].media).toBe("(min-width: 768px)");
    expect(mediaQueries).toEqual(["(min-width: 768px)"]);
  });

  it("descends into @supports and @layer", () => {
    const { declarations } = parseCss(
      "@layer base { @supports (display: grid) { p { font-size: 14px } } }",
    );
    expect(declarations).toHaveLength(1);
    expect(declarations[0].value).toBe("14px");
  });

  it("does not mistake keyframes for rules", () => {
    const { declarations } = parseCss(
      "@keyframes x { from { font-size: 1px } to { font-size: 2px } } p { font-size: 16px }",
    );
    expect(declarations).toHaveLength(1);
    expect(declarations[0].selector).toBe("p");
  });

  it("reads @font-face families and sources", () => {
    const { fontFaces } = parseCss(`
      @font-face {
        font-family: "Custom Sans";
        font-weight: 400;
        src: url("/fonts/custom.woff2") format("woff2"), url('/fonts/custom.woff');
      }
    `);
    expect(fontFaces).toHaveLength(1);
    expect(fontFaces[0].family).toBe("Custom Sans");
    expect(fontFaces[0].weights).toEqual(["400"]);
    expect(fontFaces[0].sources).toEqual(["/fonts/custom.woff2", "/fonts/custom.woff"]);
  });

  it("collects @import URLs", () => {
    const { imports } = parseCss(`
      @import url("https://fonts.googleapis.com/css2?family=Inter&display=swap");
      @import 'other.css';
      body { font-size: 16px }
    `);
    expect(imports).toEqual([
      "https://fonts.googleapis.com/css2?family=Inter&display=swap",
      "other.css",
    ]);
  });

  it("collects custom properties", () => {
    const { customProperties } = parseCss(":root { --font-body: Inter, sans-serif }");
    expect(customProperties["--font-body"]).toBe("Inter, sans-serif");
  });

  it("does not split on a semicolon inside url()", () => {
    const { fontFaces } = parseCss(
      '@font-face { font-family: A; src: url("data:font/woff2;base64,AAAA") }',
    );
    expect(fontFaces[0].sources).toEqual(["data:font/woff2;base64,AAAA"]);
  });

  it("survives an unclosed block without hanging", () => {
    expect(() => parseCss("p { font-size: 16px")).not.toThrow();
  });
});

describe("splitFontFamilies", () => {
  it("splits a stack on commas", () => {
    expect(splitFontFamilies('"Helvetica Neue", Arial, sans-serif')).toEqual([
      "Helvetica Neue",
      "Arial",
      "sans-serif",
    ]);
  });

  it("keeps commas that live inside quotes", () => {
    expect(splitFontFamilies("'Font, Weird', serif")).toEqual(["Font, Weird", "serif"]);
  });

  it("returns nothing for an empty value", () => {
    expect(splitFontFamilies("  ")).toEqual([]);
  });
});

describe("unquote", () => {
  it("removes matching quotes only", () => {
    expect(unquote('"Inter"')).toBe("Inter");
    expect(unquote("'Inter'")).toBe("Inter");
    expect(unquote("Inter")).toBe("Inter");
    expect(unquote("\"Inter'")).toBe("\"Inter'");
  });
});

describe("parseLength", () => {
  it("converts absolute units to px", () => {
    expect(parseLength("16px")?.px).toBe(16);
    expect(parseLength("1rem")?.px).toBe(16);
    expect(parseLength("1.5rem")?.px).toBe(24);
    expect(parseLength("12pt")?.px).toBe(16);
    expect(parseLength("1in")?.px).toBe(96);
  });

  it("keeps relative units but reports no px value", () => {
    expect(parseLength("1.2em")).toMatchObject({ unit: "em", px: null });
    expect(parseLength("120%")).toMatchObject({ unit: "%", px: null });
  });

  it("resolves CSS keyword sizes", () => {
    expect(parseLength("medium")?.px).toBe(16);
    expect(parseLength("x-large")?.px).toBe(24);
  });

  it("refuses to guess at computed values", () => {
    expect(parseLength("calc(1rem + 2px)")).toBeNull();
    expect(parseLength("clamp(1rem, 2vw, 3rem)")).toBeNull();
    expect(parseLength("var(--size)")).toBeNull();
    expect(parseLength("inherit")).toBeNull();
  });
});

describe("parseLineHeight", () => {
  it("reads a unitless ratio", () => {
    expect(parseLineHeight("1.5")).toMatchObject({ ratio: 1.5, unitless: true });
  });

  it("treats normal as roughly 1.2", () => {
    expect(parseLineHeight("normal").ratio).toBeCloseTo(1.2, 5);
  });

  it("converts a px line-height against the font size", () => {
    expect(parseLineHeight("24px", 16).ratio).toBeCloseTo(1.5, 5);
  });

  it("reads a percentage", () => {
    expect(parseLineHeight("150%").ratio).toBeCloseTo(1.5, 5);
  });
});

describe("analyzeScale", () => {
  it("recognises a major third scale", () => {
    const sizes = [16, 20, 25, 31.25, 39.06];
    const result = analyzeScale(sizes);
    expect(result.ratio?.name).toBe("Major third");
    expect(result.base).toBe(16);
    expect(result.consistency).toBeGreaterThan(90);
  });

  it("recognises a perfect fourth scale", () => {
    const result = analyzeScale([16, 21.33, 28.43, 37.9]);
    expect(result.ratio?.name).toBe("Perfect fourth");
  });

  it("scores an ad-hoc set of sizes badly", () => {
    const result = analyzeScale([11, 12, 13, 14, 15, 16, 42, 90]);
    expect(result.consistency).toBeLessThan(50);
  });

  it("will not name a ratio from a single step", () => {
    // Two sizes make one step, which is not enough to call it a scale.
    expect(analyzeScale([16, 17]).ratio).toBeNull();
    expect(analyzeScale([16, 17]).consistency).toBe(0);
  });

  it("does not force a named ratio onto sizes that follow none", () => {
    expect(analyzeScale([16, 17.5, 44, 46]).ratio).toBeNull();
  });

  it("handles fewer than two sizes", () => {
    expect(analyzeScale([16])).toMatchObject({ base: 16, ratio: null, consistency: 0 });
    expect(analyzeScale([])).toMatchObject({ base: null, consistency: 0 });
  });

  it("deduplicates and sorts sizes", () => {
    expect(analyzeScale([24, 16, 16, 24, 32]).sizes).toEqual([16, 24, 32]);
  });

  it("picks the size nearest 16px as the base", () => {
    expect(analyzeScale([13, 18, 40]).base).toBe(18);
  });
});

describe("buildScale", () => {
  it("puts the base at step 0 and one step below it", () => {
    const steps = buildScale(16, 1.25, 4);
    expect(steps[0]).toMatchObject({ step: -1, px: 12.8 });
    expect(steps[1]).toMatchObject({ step: 0, px: 16, rem: 1 });
    expect(steps[2].px).toBe(20);
    expect(steps[3].px).toBe(25);
  });
});

describe("googleFontFamilies", () => {
  it("reads css2 family parameters", () => {
    const families = googleFontFamilies([
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display&display=swap",
    ]);
    expect(families).toEqual(new Set(["inter", "playfair display"]));
  });

  it("reads the legacy css endpoint", () => {
    expect(
      googleFontFamilies(["https://fonts.googleapis.com/css?family=Roboto:400,700"]),
    ).toEqual(new Set(["roboto"]));
  });

  it("ignores URLs from anywhere else", () => {
    expect(googleFontFamilies(["https://example.com/style.css"]).size).toBe(0);
  });
});

describe("readHeadings", () => {
  it("counts each level", () => {
    const structure = readHeadings("<h1>a</h1><h2>b</h2><h2 class='x'>c</h2>");
    expect(structure.counts).toMatchObject({ h1: 1, h2: 2, h3: 0 });
    expect(structure.levels).toEqual([1, 2]);
  });

  it("does not count <header> as <h...>", () => {
    expect(readHeadings("<header></header>").counts.h1).toBe(0);
  });
});

describe("readBreakpoints", () => {
  it("extracts and sorts widths", () => {
    expect(
      readBreakpoints([
        "(min-width: 1024px)",
        "screen and (max-width: 48rem)",
        "(min-width: 640px)",
      ]),
    ).toEqual(["640px", "768px", "1024px"]);
  });

  it("deduplicates equivalent widths", () => {
    expect(readBreakpoints(["(min-width: 48rem)", "(min-width: 768px)"])).toEqual([
      "768px",
    ]);
  });
});

describe("analyzeTypography", () => {
  const html = `
    <html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700">
    </head><body><h1>Title</h1><h2>Sub</h2><p>Body</p></body></html>`;

  const css = `
    :root { font-size: 16px; line-height: 1.6 }
    body { font-family: Inter, sans-serif; font-size: 16px }
    h1 { font-size: 2.5rem; font-weight: 700 }
    h2 { font-size: 2rem; font-weight: 600 }
    @media (min-width: 768px) { h1 { font-size: 3rem } }`;

  it("ranks the families it finds and identifies their origin", () => {
    const report = analyzeTypography({ html, css: [css] });
    const inter = report.families.find((f) => f.name === "Inter");
    expect(inter?.origin).toBe("google-fonts");
    expect(report.families.some((f) => f.name === "sans-serif" && f.generic)).toBe(true);
  });

  it("inventories sizes in px", () => {
    const report = analyzeTypography({ html, css: [css] });
    expect(report.sizes.map((size) => size.px)).toEqual([16, 32, 40, 48]);
  });

  it("finds the page's breakpoints", () => {
    expect(analyzeTypography({ html, css: [css] }).breakpoints).toEqual(["768px"]);
  });

  it("detects a missing viewport meta tag", () => {
    const report = analyzeTypography({ html: "<h1>x</h1>", css: [css] });
    expect(report.hasViewportMeta).toBe(false);
    expect(report.findings.some((f) => f.title.includes("viewport"))).toBe(true);
  });

  it("flags body copy below 16px", () => {
    const report = analyzeTypography({
      html,
      css: ["body { font-size: 13px }"],
    });
    expect(report.findings.some((f) => f.title.includes("13px"))).toBe(true);
  });

  it("reads body copy from `body`, not from `:root`", () => {
    // :root sets the rem base; body is what paragraphs actually inherit.
    const report = analyzeTypography({
      html,
      css: [":root { font-size: 16px } body { font-size: 13px }"],
    });
    expect(report.findings.some((f) => f.title.includes("13px"))).toBe(true);
  });

  it("ignores a body size set only inside a media query", () => {
    const report = analyzeTypography({
      html,
      css: ["body { font-size: 16px } @media (max-width: 400px) { body { font-size: 13px } }"],
    });
    expect(report.findings.some((f) => f.title.includes("13px"))).toBe(false);
  });

  it("takes the last body rule when there are several", () => {
    const report = analyzeTypography({
      html,
      css: ["body { font-size: 16px } body { font-size: 12px }"],
    });
    expect(report.findings.some((f) => f.title.includes("12px"))).toBe(true);
  });

  it("flags a cramped body line-height", () => {
    const report = analyzeTypography({
      html,
      css: ["body { font-size: 16px; line-height: 1.15 }"],
    });
    expect(report.findings.some((f) => f.title.includes("line-height"))).toBe(true);
  });

  it("flags more than one h1", () => {
    const report = analyzeTypography({ html: "<h1>a</h1><h1>b</h1>", css: [css] });
    expect(report.findings.some((f) => f.title.includes("2 <h1>"))).toBe(true);
  });

  it("flags skipped heading levels", () => {
    const report = analyzeTypography({ html: "<h1>a</h1><h4>b</h4>", css: [css] });
    expect(report.findings.some((f) => f.title.includes("skip"))).toBe(true);
  });

  it("flags a sprawling set of sizes", () => {
    const many = Array.from({ length: 14 }, (_, i) => `.s${i} { font-size: ${10 + i}px }`).join("");
    const report = analyzeTypography({ html, css: [many] });
    expect(report.findings.some((f) => f.title.includes("distinct font sizes"))).toBe(true);
  });

  it("analyzes pasted CSS with no HTML at all", () => {
    const report = analyzeTypography({ html: "", css: [css] });
    expect(report.sizes.length).toBeGreaterThan(0);
    // With no document to inspect, it must not invent structural findings.
    expect(report.findings.some((f) => f.title.includes("<h1>"))).toBe(false);
  });

  it("returns an empty report for empty input rather than throwing", () => {
    const report = analyzeTypography({ html: "", css: [] });
    expect(report.declarationCount).toBe(0);
    expect(report.families).toEqual([]);
  });
});
