import { describe, expect, it } from "vitest";

import {
  DEVICES,
  DEFAULT_DEVICE_IDS,
  MAX_VIEWPORT,
  MIN_VIEWPORT,
  clampViewport,
  fitScale,
  getDevice,
  isLocalUrl,
  rotate,
} from "@/lib/responsive/devices";
import { TOOLS, STABLE_TOOLS, getTool } from "@/lib/tools";

describe("device presets", () => {
  it("has unique ids", () => {
    expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length);
  });

  it("uses plausible CSS pixel dimensions", () => {
    for (const device of DEVICES) {
      expect(device.width).toBeGreaterThanOrEqual(320);
      expect(device.width).toBeLessThanOrEqual(MAX_VIEWPORT);
      expect(device.height).toBeGreaterThan(device.width * 0.4);
    }
  });

  it("resolves the default selection", () => {
    for (const id of DEFAULT_DEVICE_IDS) {
      expect(getDevice(id)).toBeDefined();
    }
  });

  it("returns undefined for an unknown id", () => {
    expect(getDevice("nope")).toBeUndefined();
  });
});

describe("rotate", () => {
  it("swaps the axes", () => {
    expect(rotate({ width: 390, height: 844 })).toEqual({ width: 844, height: 390 });
  });

  it("is its own inverse", () => {
    const viewport = { width: 375, height: 667 };
    expect(rotate(rotate(viewport))).toEqual(viewport);
  });
});

describe("fitScale", () => {
  it("shrinks a viewport that does not fit", () => {
    expect(fitScale({ width: 1000, height: 500 }, { width: 500, height: 500 })).toBe(0.5);
  });

  it("never enlarges past 1", () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 1000, height: 1000 })).toBe(1);
  });

  it("uses whichever axis is tighter", () => {
    expect(fitScale({ width: 1000, height: 1000 }, { width: 800, height: 400 })).toBe(0.4);
  });

  it("falls back to 1 for degenerate input", () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 100, height: 100 })).toBe(1);
  });
});

describe("clampViewport", () => {
  it("keeps values within the supported range", () => {
    expect(clampViewport(10)).toBe(MIN_VIEWPORT);
    expect(clampViewport(99999)).toBe(MAX_VIEWPORT);
    expect(clampViewport(768)).toBe(768);
  });

  it("rounds fractional widths", () => {
    expect(clampViewport(767.6)).toBe(768);
  });

  it("handles NaN", () => {
    expect(clampViewport(Number.NaN)).toBe(MIN_VIEWPORT);
  });
});

describe("isLocalUrl", () => {
  it.each([
    "http://localhost:3000",
    "http://localhost",
    "http://app.localhost:3000",
    "http://127.0.0.1:8080",
    "http://127.1.1.1",
    "http://[::1]:3000",
  ])("recognises %s as local", (url) => {
    expect(isLocalUrl(url)).toBe(true);
  });

  it.each(["https://example.com", "http://192.168.1.5", "not a url"])(
    "does not treat %s as local",
    (url) => {
      expect(isLocalUrl(url)).toBe(false);
    },
  );
});

describe("tool registry", () => {
  it("has unique slugs", () => {
    expect(new Set(TOOLS.map((tool) => tool.slug)).size).toBe(TOOLS.length);
  });

  it("uses url-safe slugs", () => {
    for (const tool of TOOLS) {
      expect(tool.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("ships the three v1 tools as stable", () => {
    expect(STABLE_TOOLS.map((tool) => tool.slug)).toEqual([
      "color-extractor",
      "typography-analyzer",
      "responsive-tester",
    ]);
  });

  it("gives every tool the copy the UI needs", () => {
    for (const tool of TOOLS) {
      expect(tool.name.length).toBeGreaterThan(0);
      expect(tool.tagline.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.icon.length).toBeGreaterThan(0);
    }
  });

  it("looks a tool up by slug", () => {
    expect(getTool("color-extractor")?.name).toBe("Color Extractor");
    expect(getTool("missing")).toBeUndefined();
  });
});
