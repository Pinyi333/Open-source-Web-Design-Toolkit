import { describe, expect, it } from "vitest";

import {
  formatOklch,
  hexToRgb,
  hslToRgb,
  linearToSrgb,
  oklchToRgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  srgbToLinear,
  type Rgb,
} from "@/lib/color/convert";
import {
  BLACK,
  WHITE,
  contrastRatio,
  contrastReport,
  readableForeground,
  relativeLuminance,
} from "@/lib/color/contrast";
import { medianCut, pixelsFromImageData } from "@/lib/color/quantize";
import { exportPalette } from "@/lib/color/export";

describe("hex conversion", () => {
  it("formats channels as two-digit lowercase hex", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
    expect(rgbToHex({ r: 18, g: 52, b: 86 })).toBe("#123456");
  });

  it("clamps out-of-range channels instead of producing invalid hex", () => {
    expect(rgbToHex({ r: -20, g: 300, b: 128.6 })).toBe("#00ff81");
  });

  it("parses 3, 4, 6 and 8 digit hex", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#ff0000ff")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#f00f")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("123456")).toEqual({ r: 18, g: 52, b: 86 });
  });

  it("returns null rather than throwing on junk", () => {
    expect(hexToRgb("#gggggg")).toBeNull();
    expect(hexToRgb("#12345")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });

  it("round-trips through hex", () => {
    for (const color of [
      { r: 12, g: 200, b: 43 },
      { r: 255, g: 128, b: 0 },
      { r: 1, g: 2, b: 3 },
    ]) {
      expect(hexToRgb(rgbToHex(color))).toEqual(color);
    }
  });
});

describe("hsl conversion", () => {
  it("matches known values", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
  });

  it("reports zero saturation for greys", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0);
  });

  it("round-trips within rounding error", () => {
    for (const color of [
      { r: 200, g: 30, b: 90 },
      { r: 20, g: 180, b: 200 },
    ]) {
      const back = hslToRgb(rgbToHsl(color));
      expect(Math.abs(back.r - color.r)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.g - color.g)).toBeLessThanOrEqual(3);
      expect(Math.abs(back.b - color.b)).toBeLessThanOrEqual(3);
    }
  });
});

describe("srgb transfer function", () => {
  it("maps the endpoints exactly", () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(255)).toBeCloseTo(1, 10);
    expect(linearToSrgb(0)).toBe(0);
    expect(linearToSrgb(1)).toBe(255);
  });
});

describe("oklch conversion", () => {
  it("puts white at lightness 1 with no chroma", () => {
    const white = rgbToOklch(WHITE);
    expect(white.l).toBeCloseTo(1, 2);
    expect(white.c).toBeCloseTo(0, 3);
  });

  it("puts black at lightness 0", () => {
    expect(rgbToOklch(BLACK).l).toBeCloseTo(0, 3);
  });

  it("round-trips sRGB colors within one channel step", () => {
    for (const color of [
      { r: 255, g: 0, b: 0 },
      { r: 34, g: 139, b: 34 },
      { r: 70, g: 130, b: 180 },
      { r: 210, g: 180, b: 140 },
    ]) {
      const back = oklchToRgb(rgbToOklch(color));
      expect(Math.abs(back.r - color.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - color.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - color.b)).toBeLessThanOrEqual(1);
    }
  });

  it("formats as valid CSS", () => {
    expect(formatOklch(rgbToOklch({ r: 255, g: 0, b: 0 }))).toMatch(
      /^oklch\(\d+\.\d% \d\.\d{3} \d+\.\d\)$/,
    );
  });
});

describe("WCAG contrast", () => {
  it("puts white at luminance 1 and black at 0", () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
    expect(relativeLuminance(BLACK)).toBe(0);
  });

  it("gives black on white the maximum 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 5);
  });

  it("gives a color against itself 1:1", () => {
    expect(contrastRatio({ r: 90, g: 120, b: 30 }, { r: 90, g: 120, b: 30 })).toBeCloseTo(1, 10);
  });

  it("is symmetric", () => {
    const a = { r: 12, g: 90, b: 200 };
    const b = { r: 240, g: 240, b: 210 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("matches the published ratio for #767676 on white", () => {
    // 4.54:1 is the classic "smallest grey that passes AA on white".
    expect(contrastRatio({ r: 118, g: 118, b: 118 }, WHITE)).toBeCloseTo(4.54, 2);
  });

  it("grades against the WCAG thresholds", () => {
    expect(contrastReport(BLACK, WHITE).level).toBe("AAA");
    expect(contrastReport({ r: 118, g: 118, b: 118 }, WHITE).level).toBe("AA");
    expect(contrastReport({ r: 140, g: 140, b: 140 }, WHITE).level).toBe("AA Large");
    expect(contrastReport({ r: 230, g: 230, b: 230 }, WHITE).level).toBe("Fail");
  });

  it("picks the more readable of black and white", () => {
    expect(readableForeground({ r: 255, g: 255, b: 0 })).toEqual(BLACK);
    expect(readableForeground({ r: 20, g: 20, b: 60 })).toEqual(WHITE);
  });
});

describe("median cut", () => {
  const red = { r: 255, g: 0, b: 0 };
  const blue = { r: 0, g: 0, b: 255 };

  it("returns nothing for empty input", () => {
    expect(medianCut([], 5)).toEqual([]);
    expect(medianCut([red], 0)).toEqual([]);
  });

  it("separates two clearly different colors", () => {
    const pixels = [...Array(50).fill(red), ...Array(50).fill(blue)];
    const palette = medianCut(pixels, 2);

    expect(palette).toHaveLength(2);
    expect(palette.map((swatch) => swatch.color)).toEqual(
      expect.arrayContaining([red, blue]),
    );
  });

  it("orders swatches by how much of the image they cover", () => {
    const pixels = [...Array(90).fill(red), ...Array(10).fill(blue)];
    const palette = medianCut(pixels, 2);

    expect(palette[0].color).toEqual(red);
    expect(palette[0].share).toBeCloseTo(0.9, 5);
    expect(palette[1].share).toBeCloseTo(0.1, 5);
  });

  it("never returns more swatches than there are distinct colors", () => {
    const palette = medianCut([...Array(20).fill(red), ...Array(20).fill(blue)], 8);
    expect(palette.length).toBeLessThanOrEqual(8);
  });

  it("is deterministic", () => {
    const pixels = Array.from({ length: 200 }, (_, i) => ({
      r: (i * 7) % 256,
      g: (i * 13) % 256,
      b: (i * 29) % 256,
    }));
    expect(medianCut(pixels, 6)).toEqual(medianCut(pixels, 6));
  });

  it("keeps splitting when the biggest region is a single solid color", () => {
    // A flat design image: five solid bands. The largest band cannot be split
    // (every pixel in it is identical), which used to abandon the whole loop
    // and silently return three swatches instead of five.
    const bands: [Rgb, number][] = [
      [{ r: 34, g: 87, b: 214 }, 40],
      [{ r: 244, g: 168, b: 56 }, 25],
      [{ r: 22, g: 163, b: 116 }, 15],
      [{ r: 225, g: 72, b: 92 }, 12],
      [{ r: 24, g: 26, b: 34 }, 8],
    ];
    const pixels = bands.flatMap(([color, count]) => Array(count).fill(color));

    const palette = medianCut(pixels, 6);

    expect(palette).toHaveLength(5);
    expect(palette.map((swatch) => swatch.color)).toEqual(
      expect.arrayContaining(bands.map(([color]) => color)),
    );
    expect(palette.map((swatch) => swatch.count)).toEqual([40, 25, 15, 12, 8]);
  });

  it("stops at the number of distinct colors, however many are asked for", () => {
    const pixels = [
      ...Array(30).fill({ r: 10, g: 10, b: 10 }),
      ...Array(20).fill({ r: 200, g: 200, b: 200 }),
    ];

    const palette = medianCut(pixels, 12);

    expect(palette).toHaveLength(2);
    expect(palette.reduce((sum, s) => sum + s.count, 0)).toBe(50);
  });

  it("splits a solid region no further than it can go, and still fills the rest", () => {
    // One huge solid block plus a gradient: the block is unsplittable and is
    // also the largest box on the first pass, so the gradient only gets
    // divided if an unsplittable box is skipped rather than fatal.
    const solid = Array(500).fill({ r: 255, g: 255, b: 255 });
    const gradient = Array.from({ length: 100 }, (_, i) => ({ r: i, g: 0, b: 0 }));

    const palette = medianCut([...solid, ...gradient], 5);

    expect(palette).toHaveLength(5);
    expect(palette[0].color).toEqual({ r: 255, g: 255, b: 255 });
    expect(palette[0].count).toBe(500);
  });

  it("has shares that sum to 1", () => {
    const pixels = Array.from({ length: 137 }, (_, i) => ({
      r: i % 256,
      g: (i * 3) % 256,
      b: (i * 5) % 256,
    }));
    const total = medianCut(pixels, 5).reduce((sum, s) => sum + s.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("pixelsFromImageData", () => {
  it("drops mostly transparent pixels", () => {
    const data = [255, 0, 0, 255, 0, 255, 0, 10];
    expect(pixelsFromImageData(data)).toEqual([{ r: 255, g: 0, b: 0 }]);
  });

  it("samples every step-th pixel", () => {
    const data = [1, 1, 1, 255, 2, 2, 2, 255, 3, 3, 3, 255, 4, 4, 4, 255];
    expect(pixelsFromImageData(data, 2)).toEqual([
      { r: 1, g: 1, b: 1 },
      { r: 3, g: 3, b: 3 },
    ]);
  });
});

describe("palette export", () => {
  const palette = medianCut(
    [...Array(60).fill({ r: 255, g: 0, b: 0 }), ...Array(40).fill({ r: 0, g: 0, b: 255 })],
    2,
  );

  it("emits CSS custom properties", () => {
    const css = exportPalette(palette, "css");
    expect(css).toContain(":root {");
    expect(css).toContain("--color-1: #ff0000;");
  });

  it("emits a Tailwind v4 theme block", () => {
    const css = exportPalette(palette, "tailwind");
    expect(css).toContain("@theme {");
    expect(css).toContain("--color-color-1: oklch(");
  });

  it("emits parseable JSON", () => {
    const parsed = JSON.parse(exportPalette(palette, "json"));
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ name: "color-1", hex: "#ff0000" });
  });

  it("emits W3C design tokens", () => {
    const parsed = JSON.parse(exportPalette(palette, "tokens"));
    expect(parsed.color["color-1"]).toEqual({ $type: "color", $value: "#ff0000" });
  });
});
