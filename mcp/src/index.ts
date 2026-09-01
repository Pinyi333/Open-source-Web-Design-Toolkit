#!/usr/bin/env node
/**
 * MCP server for the Web Design Toolkit.
 *
 * Exposes the same pure analysis library the web app uses — palette
 * extraction, WCAG contrast, typography auditing — over stdio, so AI coding
 * agents can call it as tools. Everything of substance lives in ../../lib;
 * this file is registration and error shaping only.
 *
 * The URL-fetching tool reuses lib/net's SSRF guard unchanged, so private and
 * local addresses are refused here too. For a localhost dev server, pass the
 * HTML/CSS directly — the agent has the files anyway.
 */

import { readFile } from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { contrastReport } from "../../lib/color/contrast";
import { exportPalette, type ExportFormat } from "../../lib/color/export";
import { medianCut } from "../../lib/color/quantize";
import { fetchSite } from "../../lib/net/fetch-site";
import { BlockedUrlError } from "../../lib/net/url-guard";
import { COMMON_BREAKPOINTS, DEVICES } from "../../lib/responsive/devices";
import { analyzeTypography } from "../../lib/typography/analyze";
import { decodeImage } from "./decode-image";
import {
  describeColor,
  describeSwatch,
  parseHex,
  swatchesFromColors,
} from "./palette";

const server = new McpServer({
  name: "web-design-toolkit",
  version: "0.1.0",
});

const EXPORT_FORMAT_IDS = ["css", "tailwind", "json", "tokens"] as const;

function ok(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function fail(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// --- extract_palette ------------------------------------------------------

server.registerTool(
  "extract_palette",
  {
    title: "Extract color palette",
    description:
      "Extract the dominant color palette from a PNG or JPEG image using " +
      "median-cut quantization. Returns swatches in HEX/RGB/HSL/OKLCH ordered " +
      "by coverage, and optionally a ready-to-paste export.",
    inputSchema: {
      image_path: z.string().describe("Path to a PNG or JPEG file on disk"),
      max_colors: z
        .number()
        .int()
        .min(3)
        .max(12)
        .optional()
        .describe("Palette size, 3-12. Default 6."),
      format: z
        .enum(EXPORT_FORMAT_IDS)
        .optional()
        .describe(
          "Also return the palette as code: css (custom properties), " +
            "tailwind (v4 @theme), json, or tokens (W3C design tokens).",
        ),
    },
  },
  async ({ image_path, max_colors, format }) => {
    let buffer: Buffer;
    try {
      buffer = await readFile(image_path);
    } catch {
      return fail(`Could not read the file at ${image_path}.`);
    }

    let decoded;
    try {
      decoded = decodeImage(buffer);
    } catch (error) {
      return fail(errorMessage(error));
    }

    if (decoded.pixels.length === 0) {
      return fail("The image has no opaque pixels to sample.");
    }

    const swatches = medianCut(decoded.pixels, max_colors ?? 6);
    return ok({
      image: { width: decoded.width, height: decoded.height },
      palette: swatches.map(describeSwatch),
      ...(format
        ? { export: exportPalette(swatches, format as ExportFormat) }
        : {}),
    });
  },
);

// --- convert_color --------------------------------------------------------

server.registerTool(
  "convert_color",
  {
    title: "Convert a color",
    description:
      "Convert a hex color to RGB, HSL and OKLCH, and report which of black " +
      "or white text reads better on it.",
    inputSchema: {
      color: z.string().describe("Hex color, e.g. #1a2b3c or #abc"),
    },
  },
  async ({ color }) => {
    try {
      const rgb = parseHex(color);
      const onBlack = contrastReport(rgb, { r: 0, g: 0, b: 0 });
      const onWhite = contrastReport(rgb, { r: 255, g: 255, b: 255 });
      return ok({
        ...describeColor(rgb),
        readableForeground:
          onBlack.ratio >= onWhite.ratio ? "#000000" : "#ffffff",
      });
    } catch (error) {
      return fail(errorMessage(error));
    }
  },
);

// --- check_contrast -------------------------------------------------------

server.registerTool(
  "check_contrast",
  {
    title: "Check WCAG contrast",
    description:
      "Compute the WCAG 2.1 contrast ratio between two colors and report " +
      "which levels pass: AAA (7:1), AA (4.5:1), AA Large (3:1, for text " +
      ">=24px or >=18.66px bold).",
    inputSchema: {
      foreground: z.string().describe("Text color as hex, e.g. #333333"),
      background: z.string().describe("Background color as hex, e.g. #ffffff"),
    },
  },
  async ({ foreground, background }) => {
    try {
      const fg = parseHex(foreground, "foreground color");
      const bg = parseHex(background, "background color");
      const report = contrastReport(fg, bg);
      return ok({
        ratio: Number(report.ratio.toFixed(2)),
        level: report.level,
        passes: {
          aa: report.aa,
          aaa: report.aaa,
          aaLarge: report.aaLarge,
        },
      });
    } catch (error) {
      return fail(errorMessage(error));
    }
  },
);

// --- export_palette -------------------------------------------------------

server.registerTool(
  "export_palette",
  {
    title: "Export a palette as code",
    description:
      "Turn a list of hex colors into paste-ready code: CSS custom " +
      "properties, a Tailwind v4 @theme block, JSON, or W3C design tokens.",
    inputSchema: {
      colors: z
        .array(z.string())
        .min(1)
        .max(16)
        .describe("Hex colors in order, e.g. [\"#0f172a\", \"#38bdf8\"]"),
      format: z.enum(EXPORT_FORMAT_IDS).describe("Output format"),
    },
  },
  async ({ colors, format }) => {
    try {
      const rgbs = colors.map((color) => parseHex(color));
      const code = exportPalette(swatchesFromColors(rgbs), format as ExportFormat);
      return ok({ format, code });
    } catch (error) {
      return fail(errorMessage(error));
    }
  },
);

// --- analyze_typography ---------------------------------------------------

server.registerTool(
  "analyze_typography",
  {
    title: "Analyze typography",
    description:
      "Audit a page's typography: font families and where they load from, " +
      "the size scale and its consistency, weights, heading structure, media " +
      "query breakpoints, and readability/performance findings. Pass a public " +
      "URL, or pass html/css directly (required for localhost or private " +
      "sites, which the URL fetcher refuses by design).",
    inputSchema: {
      url: z
        .string()
        .url()
        .optional()
        .describe("Public http(s) URL to fetch and analyze"),
      html: z.string().optional().describe("Raw HTML to analyze instead of a URL"),
      css: z
        .array(z.string())
        .optional()
        .describe("Stylesheet contents to analyze alongside the HTML"),
    },
  },
  async ({ url, html, css }) => {
    if (url) {
      try {
        const snapshot = await fetchSite(url);
        const report = analyzeTypography({
          html: snapshot.html,
          css: snapshot.stylesheets.map((sheet) => sheet.css),
        });
        return ok({
          finalUrl: snapshot.finalUrl,
          stylesheetsAnalyzed: snapshot.stylesheets.length,
          notes: snapshot.notes,
          report,
        });
      } catch (error) {
        if (error instanceof BlockedUrlError) return fail(error.message);
        return fail(`Fetching ${url} failed: ${errorMessage(error)}`);
      }
    }

    if (html === undefined && (css === undefined || css.length === 0)) {
      return fail("Provide a url, or html and/or css to analyze.");
    }

    const report = analyzeTypography({ html: html ?? "", css: css ?? [] });
    return ok({ report });
  },
);

// --- list_device_presets --------------------------------------------------

server.registerTool(
  "list_device_presets",
  {
    title: "List device presets",
    description:
      "List the device viewport presets (CSS pixels, the number media " +
      "queries compare against) and the common Tailwind-style breakpoints " +
      "used by the Responsive Tester.",
    inputSchema: {},
  },
  async () => ok({ devices: DEVICES, commonBreakpoints: COMMON_BREAKPOINTS }),
);

// --- start ----------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the protocol channel; anything human goes to stderr.
  console.error("web-design-toolkit MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
