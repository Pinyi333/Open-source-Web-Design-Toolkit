/**
 * Low-fidelity wireframes as SVG strings.
 *
 * Each section kind has a recipe that draws grey boxes at desktop or mobile
 * width. The output is a self-contained SVG: it renders inline in the app,
 * downloads as a file, and opens in Figma or Illustrator as editable shapes.
 * No DOM is involved, so tests can assert on the markup directly.
 */

import { SECTION_LABELS } from "./industries";
import type { PlannedPage, SectionKind } from "./types";

export type WireframeViewport = "desktop" | "mobile";
export type WireframeTheme = "light" | "dark";

export interface WireframeOptions {
  viewport?: WireframeViewport;
  theme?: WireframeTheme;
  /** Draw the section name in the top-left corner of each band. Default true. */
  labels?: boolean;
  /** Brand name drawn in the nav. */
  brand?: string;
}

export const VIEWPORT_WIDTH: Record<WireframeViewport, number> = { desktop: 1200, mobile: 390 };

const PALETTE: Record<WireframeTheme, Record<"bg" | "band" | "block" | "line" | "ink" | "label" | "accent" | "accentInk", string>> = {
  light: { bg: "#ffffff", band: "#f6f7f9", block: "#e4e7ec", line: "#cfd4dc", ink: "#b3bac5", label: "#6b7280", accent: "#1f2937", accentInk: "#ffffff" },
  dark: { bg: "#15171c", band: "#1b1e24", block: "#2a2e37", line: "#3a3f4a", ink: "#4b5260", label: "#9aa3b2", accent: "#e5e7eb", accentInk: "#111318" },
};

interface Ctx {
  width: number;
  /** Horizontal page margin. */
  margin: number;
  mobile: boolean;
  colors: (typeof PALETTE)["light"];
  brand: string;
}

/** A recipe draws one section starting at y and returns its markup and height. */
type Recipe = (ctx: Ctx, y: number) => { height: number; svg: string };

// --- primitives --------------------------------------------------------------

const round = (value: number) => Math.round(value * 10) / 10;

function rect(x: number, y: number, w: number, h: number, fill: string, r = 6): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${r}" fill="${fill}"/>`;
}

function outline(x: number, y: number, w: number, h: number, stroke: string, r = 6): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${r}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`;
}

/** An image placeholder: a box with a cross through it. */
function image(ctx: Ctx, x: number, y: number, w: number, h: number): string {
  const c = ctx.colors;
  return (
    rect(x, y, w, h, c.block, 8) +
    `<path d="M${round(x)} ${round(y)}L${round(x + w)} ${round(y + h)}M${round(x + w)} ${round(y)}L${round(x)} ${round(y + h)}" stroke="${c.line}" stroke-width="1.5"/>`
  );
}

/** Stand-in text: bars of decreasing width. */
function lines(ctx: Ctx, x: number, y: number, w: number, count: number, size = 10, gap = 8): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const width = i === count - 1 && count > 1 ? w * 0.62 : w;
    out += rect(x, y + i * (size + gap), width, size, ctx.colors.ink, size / 2);
  }
  return out;
}

function heading(ctx: Ctx, x: number, y: number, w: number, size = 22): string {
  return rect(x, y, w, size, ctx.colors.accent, 4);
}

function button(ctx: Ctx, x: number, y: number, w = 140, h = 40, filled = true): string {
  return filled ? rect(x, y, w, h, ctx.colors.accent, h / 2) : outline(x, y, w, h, ctx.colors.accent, h / 2);
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function text(ctx: Ctx, x: number, y: number, value: string, size = 11, color = ctx.colors.label, weight = 500): string {
  return `<text x="${round(x)}" y="${round(y)}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(value)}</text>`;
}

/** Splits the content width into n columns. */
function columns(ctx: Ctx, n: number, gap = ctx.mobile ? 12 : 24): { x: number; w: number }[] {
  const inner = ctx.width - ctx.margin * 2;
  const w = (inner - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: ctx.margin + i * (w + gap), w }));
}

/** A grid of cards; returns markup and total height. */
function cardGrid(
  ctx: Ctx,
  y: number,
  count: number,
  desktopCols: number,
  mobileCols: number,
  draw: (x: number, y: number, w: number) => { svg: string; height: number },
): { svg: string; height: number } {
  const cols = columns(ctx, ctx.mobile ? mobileCols : desktopCols);
  const rowGap = ctx.mobile ? 16 : 28;
  let svg = "";
  let rowHeight = 0;
  let cursor = y;

  for (let i = 0; i < count; i++) {
    const col = i % cols.length;
    if (col === 0 && i > 0) {
      cursor += rowHeight + rowGap;
      rowHeight = 0;
    }
    const card = draw(cols[col].x, cursor, cols[col].w);
    svg += card.svg;
    rowHeight = Math.max(rowHeight, card.height);
  }

  return { svg, height: cursor + rowHeight - y };
}

/** Section title block: small heading + one line of intro. */
function sectionIntro(ctx: Ctx, y: number, centered = false): { svg: string; height: number } {
  const w = ctx.mobile ? ctx.width * 0.6 : 360;
  const x = centered ? (ctx.width - w) / 2 : ctx.margin;
  return {
    svg: heading(ctx, x, y, w, ctx.mobile ? 18 : 22) + lines(ctx, x, y + (ctx.mobile ? 30 : 36), w, 1),
    height: ctx.mobile ? 52 : 60,
  };
}

// --- recipes -------------------------------------------------------------------

const PAD = { desktop: 64, mobile: 36 };

function padded(ctx: Ctx, y: number, draw: (top: number) => { svg: string; height: number }) {
  const pad = ctx.mobile ? PAD.mobile : PAD.desktop;
  const inner = draw(y + pad);
  return { svg: inner.svg, height: inner.height + pad * 2 };
}

/** Intro block, then a body below it. */
function introThen(ctx: Ctx, y: number, body: (top: number) => { svg: string; height: number }, centered = false) {
  return padded(ctx, y, (top) => {
    const intro = sectionIntro(ctx, top, centered);
    const gap = ctx.mobile ? 20 : 32;
    const rest = body(top + intro.height + gap);
    return { svg: intro.svg + rest.svg, height: intro.height + gap + rest.height };
  });
}

const RECIPES: Record<SectionKind, Recipe> = {
  nav: (ctx, y) => {
    const h = ctx.mobile ? 56 : 72;
    const c = ctx.colors;
    let svg = rect(0, y, ctx.width, h, c.bg, 0) + `<line x1="0" y1="${y + h}" x2="${ctx.width}" y2="${y + h}" stroke="${c.line}"/>`;
    svg += text(ctx, ctx.margin, y + h / 2 + 5, ctx.brand, ctx.mobile ? 14 : 16, c.accent, 700);
    if (ctx.mobile) {
      for (let i = 0; i < 3; i++) svg += rect(ctx.width - ctx.margin - 22, y + h / 2 - 7 + i * 6, 22, 2.5, c.accent, 1);
    } else {
      for (let i = 0; i < 4; i++) svg += rect(ctx.width / 2 - 170 + i * 90, y + h / 2 - 5, 60, 10, c.ink, 5);
      svg += button(ctx, ctx.width - ctx.margin - 120, y + h / 2 - 18, 120, 36);
    }
    return { height: h, svg };
  },

  hero: (ctx, y) => {
    if (ctx.mobile) {
      return padded(ctx, y, (top) => {
        const w = ctx.width - ctx.margin * 2;
        const svg =
          heading(ctx, ctx.margin, top, w, 30) +
          heading(ctx, ctx.margin, top + 40, w * 0.7, 30) +
          lines(ctx, ctx.margin, top + 92, w, 3) +
          button(ctx, ctx.margin, top + 160, w, 46) +
          image(ctx, ctx.margin, top + 226, w, 220);
        return { svg, height: 446 };
      });
    }
    return padded(ctx, y, (top) => {
      const [left, right] = columns(ctx, 2, 56);
      const svg =
        heading(ctx, left.x, top + 40, left.w, 44) +
        heading(ctx, left.x, top + 96, left.w * 0.75, 44) +
        lines(ctx, left.x, top + 172, left.w * 0.9, 3, 12, 10) +
        button(ctx, left.x, top + 252, 170, 48) +
        button(ctx, left.x + 186, top + 252, 150, 48, false) +
        image(ctx, right.x, top, right.w, 380);
      return { svg, height: 380 };
    });
  },

  logos: (ctx, y) =>
    padded(ctx, y, (top) => {
      const count = ctx.mobile ? 4 : 6;
      const grid = cardGrid(ctx, top, count, 6, 2, (x, cy, w) => ({ svg: rect(x + w * 0.15, cy, w * 0.7, 28, ctx.colors.block, 4), height: 28 }));
      return grid;
    }),

  features: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, ctx.mobile ? 3 : 3, 3, 1, (x, cy, w) => ({
        svg: rect(x, cy, 44, 44, ctx.colors.block, 12) + heading(ctx, x, cy + 64, w * 0.6, 16) + lines(ctx, x, cy + 94, w, 3),
        height: 148,
      })),
    true),

  split: (ctx, y) =>
    padded(ctx, y, (top) => {
      if (ctx.mobile) {
        const w = ctx.width - ctx.margin * 2;
        return { svg: image(ctx, ctx.margin, top, w, 200) + heading(ctx, ctx.margin, top + 224, w * 0.8) + lines(ctx, ctx.margin, top + 262, w, 4), height: 334 };
      }
      const [left, right] = columns(ctx, 2, 64);
      return {
        svg: image(ctx, left.x, top, left.w, 320) + heading(ctx, right.x, top + 80, right.w * 0.8, 28) + lines(ctx, right.x, top + 128, right.w, 4, 11, 10) + button(ctx, right.x, top + 220, 150, 44, false),
        height: 320,
      };
    }),

  stats: (ctx, y) =>
    padded(ctx, y, (top) =>
      cardGrid(ctx, top, 4, 4, 2, (x, cy, w) => ({
        svg: heading(ctx, x, cy, w * 0.5, ctx.mobile ? 28 : 40) + lines(ctx, x, cy + (ctx.mobile ? 40 : 56), w * 0.8, 1),
        height: ctx.mobile ? 56 : 70,
      })),
    ),

  gallery: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, 6, 3, 2, (x, cy, w) => ({ svg: image(ctx, x, cy, w, w * 0.75), height: w * 0.75 })),
    ),

  "product-grid": (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, ctx.mobile ? 4 : 8, 4, 2, (x, cy, w) => ({
        svg: image(ctx, x, cy, w, w * 1.1) + lines(ctx, x, cy + w * 1.1 + 14, w * 0.8, 1) + rect(x, cy + w * 1.1 + 34, w * 0.35, 10, ctx.colors.accent, 5),
        height: w * 1.1 + 44,
      })),
    ),

  "product-detail": (ctx, y) =>
    padded(ctx, y, (top) => {
      if (ctx.mobile) {
        const w = ctx.width - ctx.margin * 2;
        const svg =
          image(ctx, ctx.margin, top, w, w) +
          heading(ctx, ctx.margin, top + w + 24, w * 0.8) +
          rect(ctx.margin, top + w + 60, 90, 16, ctx.colors.accent, 4) +
          lines(ctx, ctx.margin, top + w + 96, w, 3) +
          button(ctx, ctx.margin, top + w + 160, w, 48);
        return { svg, height: w + 208 };
      }
      const [left, right] = columns(ctx, 2, 56);
      let svg = image(ctx, left.x, top, left.w, 440);
      for (let i = 0; i < 4; i++) svg += image(ctx, left.x + i * ((left.w - 36) / 4 + 12), top + 456, (left.w - 36) / 4, 70);
      svg +=
        heading(ctx, right.x, top + 8, right.w * 0.8, 30) +
        rect(right.x, top + 58, 110, 22, ctx.colors.accent, 4) +
        lines(ctx, right.x, top + 104, right.w, 4) +
        outline(right.x, top + 196, right.w, 48, ctx.colors.line) +
        button(ctx, right.x, top + 264, right.w, 52) +
        lines(ctx, right.x, top + 340, right.w * 0.7, 3);
      return { svg, height: 526 };
    }),

  menu: (ctx, y) =>
    introThen(ctx, y, (top) => {
      const cols = ctx.mobile ? 1 : 2;
      return cardGrid(ctx, top, 8, cols, 1, (x, cy, w) => ({
        svg: rect(x, cy, w * 0.55, 14, ctx.colors.accent, 4) + rect(x + w - 50, cy, 50, 14, ctx.colors.accent, 4) + lines(ctx, x, cy + 26, w * 0.8, 1) + `<line x1="${x}" y1="${cy + 56}" x2="${x + w}" y2="${cy + 56}" stroke="${ctx.colors.line}"/>`,
        height: 56,
      }));
    }),

  pricing: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, 3, 3, 1, (x, cy, w) => {
        const h = 300;
        return {
          svg: outline(x, cy, w, h, ctx.colors.line, 14) + heading(ctx, x + 24, cy + 28, w * 0.4, 16) + heading(ctx, x + 24, cy + 64, w * 0.35, 32) + lines(ctx, x + 24, cy + 124, w - 48, 5) + button(ctx, x + 24, cy + h - 68, w - 48, 44),
          height: h,
        };
      }),
    true),

  testimonials: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, ctx.mobile ? 2 : 3, 3, 1, (x, cy, w) => ({
        svg: rect(x, cy, w, 190, ctx.colors.band, 14) + lines(ctx, x + 24, cy + 28, w - 48, 4) + `<circle cx="${x + 44}" cy="${cy + 150}" r="18" fill="${ctx.colors.block}"/>` + rect(x + 74, cy + 144, w * 0.35, 12, ctx.colors.ink, 6),
        height: 190,
      })),
    true),

  team: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, ctx.mobile ? 4 : 4, 4, 2, (x, cy, w) => ({
        svg: image(ctx, x, cy, w, w) + heading(ctx, x, cy + w + 14, w * 0.6, 14) + lines(ctx, x, cy + w + 38, w * 0.45, 1),
        height: w + 50,
      })),
    ),

  timeline: (ctx, y) =>
    introThen(ctx, y, (top) => {
      const rows = 4;
      const rowH = ctx.mobile ? 70 : 64;
      const lineX = ctx.margin + 8;
      let svg = `<line x1="${lineX}" y1="${top}" x2="${lineX}" y2="${top + rows * rowH - 30}" stroke="${ctx.colors.line}" stroke-width="2"/>`;
      for (let i = 0; i < rows; i++) {
        const ry = top + i * rowH;
        svg += `<circle cx="${lineX}" cy="${ry + 6}" r="6" fill="${ctx.colors.accent}"/>`;
        svg += rect(lineX + 24, ry, ctx.mobile ? 70 : 90, 12, ctx.colors.accent, 4);
        svg += lines(ctx, lineX + 24, ry + 22, (ctx.width - ctx.margin * 2) * (ctx.mobile ? 0.8 : 0.55), ctx.mobile ? 2 : 1);
      }
      return { svg, height: rows * rowH - 20 };
    }),

  list: (ctx, y) =>
    introThen(ctx, y, (top) =>
      cardGrid(ctx, top, ctx.mobile ? 3 : 6, 3, 1, (x, cy, w) => ({
        svg: image(ctx, x, cy, w, w * 0.56) + rect(x, cy + w * 0.56 + 14, 60, 10, ctx.colors.ink, 5) + heading(ctx, x, cy + w * 0.56 + 34, w * 0.85, 16) + lines(ctx, x, cy + w * 0.56 + 62, w, 2),
        height: w * 0.56 + 98,
      })),
    ),

  article: (ctx, y) =>
    padded(ctx, y, (top) => {
      const w = ctx.mobile ? ctx.width - ctx.margin * 2 : 680;
      const x = (ctx.width - w) / 2;
      const svg = lines(ctx, x, top, w, 6, 11, 11) + image(ctx, x, top + 140, w, ctx.mobile ? 180 : 320) + lines(ctx, x, top + (ctx.mobile ? 344 : 484), w, 5, 11, 11);
      return { svg, height: ctx.mobile ? 454 : 594 };
    }),

  faq: (ctx, y) =>
    introThen(ctx, y, (top) => {
      const w = ctx.mobile ? ctx.width - ctx.margin * 2 : 760;
      const x = (ctx.width - w) / 2;
      let svg = "";
      for (let i = 0; i < 5; i++) {
        const ry = top + i * 64;
        svg += outline(x, ry, w, 52, ctx.colors.line, 10) + rect(x + 20, ry + 20, w * 0.55, 12, ctx.colors.ink, 6) + text(ctx, x + w - 32, ry + 32, "+", 18, ctx.colors.label, 400);
      }
      return { svg, height: 5 * 64 - 12 };
    }, true),

  cta: (ctx, y) =>
    padded(ctx, y, (top) => {
      const w = ctx.width - ctx.margin * 2;
      const h = ctx.mobile ? 220 : 240;
      const inner = ctx.mobile ? w - 48 : 520;
      const x = (ctx.width - inner) / 2;
      const svg =
        rect(ctx.margin, top, w, h, ctx.colors.band, 20) +
        heading(ctx, x, top + 52, inner, ctx.mobile ? 24 : 32) +
        lines(ctx, x + inner * 0.1, top + 104, inner * 0.8, 1) +
        button(ctx, (ctx.width - 180) / 2, top + (ctx.mobile ? 144 : 150), 180, 48);
      return { svg, height: h };
    }),

  form: (ctx, y) =>
    introThen(ctx, y, (top) => {
      const w = ctx.mobile ? ctx.width - ctx.margin * 2 : 560;
      const x = (ctx.width - w) / 2;
      let svg = "";
      const fields = 4;
      for (let i = 0; i < fields; i++) {
        const fy = top + i * 76;
        svg += rect(x, fy, 90, 10, ctx.colors.ink, 5) + outline(x, fy + 20, w, i === fields - 1 ? 44 : 44, ctx.colors.line, 8);
      }
      svg += button(ctx, x, top + fields * 76 + 8, ctx.mobile ? w : 180, 48);
      return { svg, height: fields * 76 + 56 };
    }, true),

  booking: (ctx, y) =>
    introThen(ctx, y, (top) => {
      const w = ctx.width - ctx.margin * 2;
      if (ctx.mobile) {
        let svg = "";
        for (let i = 0; i < 3; i++) svg += outline(ctx.margin, top + i * 60, w, 48, ctx.colors.line, 10);
        svg += cardGrid(ctx, top + 190, 6, 3, 3, (x, cy, cw) => ({ svg: outline(x, cy, cw, 40, ctx.colors.line, 20), height: 40 })).svg;
        svg += button(ctx, ctx.margin, top + 300, w, 48);
        return { svg, height: 348 };
      }
      const [calendar, slots] = columns(ctx, 2, 40);
      let svg = outline(calendar.x, top, calendar.w, 320, ctx.colors.line, 14);
      const cell = (calendar.w - 48) / 7;
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 7; c++) {
          svg += rect(calendar.x + 24 + c * cell + 4, top + 60 + r * 48, cell - 8, 36, (r * 7 + c) % 9 === 4 ? ctx.colors.accent : ctx.colors.block, 8);
        }
      }
      svg += heading(ctx, calendar.x + 24, top + 22, 140, 16);
      svg += cardGrid({ ...ctx, margin: slots.x, width: slots.x * 2 + slots.w }, top, 8, 2, 2, (x, cy, cw) => ({ svg: outline(x, cy, cw, 44, ctx.colors.line, 22), height: 44 })).svg;
      svg += button(ctx, slots.x, top + 272, slots.w, 48);
      return { svg, height: 320 };
    }, true),

  map: (ctx, y) =>
    padded(ctx, y, (top) => {
      if (ctx.mobile) {
        const w = ctx.width - ctx.margin * 2;
        return { svg: image(ctx, ctx.margin, top, w, 220) + heading(ctx, ctx.margin, top + 244, w * 0.5, 16) + lines(ctx, ctx.margin, top + 276, w, 3), height: 330 };
      }
      const cols = columns(ctx, 3, 40);
      const mapW = cols[1].x + cols[1].w - cols[0].x;
      return {
        svg: image(ctx, cols[0].x, top, mapW, 340) + heading(ctx, cols[2].x, top + 20, cols[2].w * 0.6, 18) + lines(ctx, cols[2].x, top + 60, cols[2].w, 4) + lines(ctx, cols[2].x, top + 160, cols[2].w * 0.8, 3) + button(ctx, cols[2].x, top + 250, 160, 44, false),
        height: 340,
      };
    }),

  search: (ctx, y) =>
    padded(ctx, y, (top) => {
      const w = ctx.width - ctx.margin * 2;
      let svg = outline(ctx.margin, top, w, 52, ctx.colors.line, 26) + `<circle cx="${ctx.margin + 28}" cy="${top + 26}" r="8" fill="none" stroke="${ctx.colors.label}" stroke-width="2"/>` + rect(ctx.margin + 50, top + 21, w * 0.3, 10, ctx.colors.ink, 5);
      const chips = ctx.mobile ? 3 : 6;
      for (let i = 0; i < chips; i++) svg += outline(ctx.margin + i * 112, top + 72, 100, 34, ctx.colors.line, 17);
      return { svg, height: 106 };
    }),

  cart: (ctx, y) =>
    padded(ctx, y, (top) => {
      const w = ctx.width - ctx.margin * 2;
      const listW = ctx.mobile ? w : w * 0.62;
      let svg = "";
      for (let i = 0; i < 3; i++) {
        const ry = top + i * 112;
        svg += image(ctx, ctx.margin, ry, 88, 88) + heading(ctx, ctx.margin + 108, ry + 8, listW * 0.4, 14) + lines(ctx, ctx.margin + 108, ry + 36, listW * 0.3, 1) + rect(ctx.margin + listW - 60, ry + 8, 60, 14, ctx.colors.accent, 4);
      }
      if (ctx.mobile) {
        svg += rect(ctx.margin, top + 346, w, 170, ctx.colors.band, 14) + lines(ctx, ctx.margin + 20, top + 370, w - 40, 3) + button(ctx, ctx.margin + 20, top + 450, w - 40, 48);
        return { svg, height: 516 };
      }
      const sx = ctx.margin + listW + 40;
      const sw = w - listW - 40;
      svg += rect(sx, top, sw, 300, ctx.colors.band, 14) + heading(ctx, sx + 24, top + 24, sw * 0.5, 16) + lines(ctx, sx + 24, top + 64, sw - 48, 4) + button(ctx, sx + 24, top + 228, sw - 48, 48);
      return { svg, height: 336 };
    }),

  newsletter: (ctx, y) =>
    padded(ctx, y, (top) => {
      const w = ctx.mobile ? ctx.width - ctx.margin * 2 : 560;
      const x = (ctx.width - w) / 2;
      const svg = heading(ctx, x + w * 0.15, top, w * 0.7, 20) + lines(ctx, x + w * 0.1, top + 34, w * 0.8, 1) + outline(x, top + 68, ctx.mobile ? w : w - 150, 48, ctx.colors.line, 24) + button(ctx, ctx.mobile ? x : x + w - 136, ctx.mobile ? top + 128 : top + 68, ctx.mobile ? w : 136, 48);
      return { svg, height: ctx.mobile ? 176 : 116 };
    }),

  footer: (ctx, y) => {
    const c = ctx.colors;
    const pad = ctx.mobile ? 32 : 56;
    let svg = "";
    const cols = cardGrid(ctx, y + pad, 4, 4, 2, (x, cy, w) => ({ svg: heading(ctx, x, cy, w * 0.4, 12) + lines(ctx, x, cy + 28, w * 0.7, 4, 8, 12), height: 104 }));
    svg += cols.svg;
    const bottom = y + pad + cols.height + 32;
    svg += `<line x1="${ctx.margin}" y1="${bottom}" x2="${ctx.width - ctx.margin}" y2="${bottom}" stroke="${c.line}"/>`;
    svg += rect(ctx.margin, bottom + 20, 160, 10, c.ink, 5);
    const height = bottom + 50 - y + pad / 2;
    return { height, svg: rect(0, y, ctx.width, height, c.band, 0) + svg };
  },
};

// --- page ------------------------------------------------------------------------

export interface Wireframe {
  svg: string;
  width: number;
  height: number;
}

export function renderWireframe(page: Pick<PlannedPage, "title" | "sections">, options: WireframeOptions = {}): Wireframe {
  const viewport = options.viewport ?? "desktop";
  const theme = options.theme ?? "light";
  const labels = options.labels ?? true;
  const width = VIEWPORT_WIDTH[viewport];
  const ctx: Ctx = {
    width,
    margin: viewport === "mobile" ? 20 : 60,
    mobile: viewport === "mobile",
    colors: PALETTE[theme],
    brand: (options.brand?.trim() || "Brand").slice(0, 24),
  };

  let y = 0;
  let body = "";
  page.sections.forEach((kind, index) => {
    const recipe = RECIPES[kind];
    if (!recipe) return;
    const drawn = recipe(ctx, y);
    // Alternate band backgrounds so sections read as separate blocks.
    const fill = kind === "nav" || kind === "footer" ? "" : rect(0, y, width, drawn.height, index % 2 === 0 ? ctx.colors.bg : ctx.colors.band, 0);
    body += `<g data-section="${kind}">${fill}${drawn.svg}`;
    if (labels && kind !== "nav") {
      body += text(ctx, ctx.mobile ? 8 : 12, y + 16, SECTION_LABELS[kind].toUpperCase(), 9, ctx.colors.label, 600);
    }
    body += "</g>";
    y += drawn.height;
  });

  const height = Math.max(1, Math.round(y));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${page.title} wireframe (${viewport})`)}">` +
    `<title>${escapeXml(`${page.title}: ${viewport} wireframe`)}</title>` +
    rect(0, 0, width, height, ctx.colors.bg, 0) +
    body +
    "</svg>";

  return { svg, width, height };
}
