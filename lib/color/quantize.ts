/**
 * Median cut color quantization.
 *
 * Median cut repeatedly splits the box of colors along its longest channel at
 * the median, which keeps the palette representative of the image rather than
 * biased toward whichever color happens to be most common. The implementation
 * is deterministic: the same pixels always produce the same palette, which
 * matters both for tests and for users who expect a stable result.
 */

import type { Rgb } from "./convert";

export interface Swatch {
  color: Rgb;
  /** Number of sampled pixels represented by this swatch. */
  count: number;
  /** Share of sampled pixels, 0-1. */
  share: number;
}

interface Box {
  pixels: Rgb[];
}

const CHANNELS = ["r", "g", "b"] as const;
type Channel = (typeof CHANNELS)[number];

function longestChannel(pixels: Rgb[]): Channel {
  let best: Channel = "r";
  let bestRange = -1;

  for (const channel of CHANNELS) {
    let min = 255;
    let max = 0;
    for (const pixel of pixels) {
      const value = pixel[channel];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = max - min;
    if (range > bestRange) {
      bestRange = range;
      best = channel;
    }
  }

  return best;
}

function averageColor(pixels: Rgb[]): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const pixel of pixels) {
    r += pixel.r;
    g += pixel.g;
    b += pixel.b;
  }
  const n = pixels.length;
  return {
    r: Math.round(r / n),
    g: Math.round(g / n),
    b: Math.round(b / n),
  };
}

function splitBox(box: Box): [Box, Box] | null {
  if (box.pixels.length < 2) return null;

  const channel = longestChannel(box.pixels);
  const sorted = [...box.pixels].sort((a, b) => a[channel] - b[channel]);
  const mid = Math.floor(sorted.length / 2);

  // Cut at the value boundary nearest the median rather than at the median
  // index itself. Splitting on the index alone tears a run of identical
  // pixels in half, which is how an image of 60% red and 40% blue ends up
  // reporting purple: the "blue" box gets a slice of the reds mixed in.
  let cut = -1;
  let bestDistance = Infinity;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i][channel] === sorted[i - 1][channel]) continue;
    const distance = Math.abs(i - mid);
    if (distance < bestDistance) {
      bestDistance = distance;
      cut = i;
    }
  }

  // Every pixel shares the same value on the widest channel, so there is
  // nothing left to divide.
  if (cut === -1) return null;

  return [{ pixels: sorted.slice(0, cut) }, { pixels: sorted.slice(cut) }];
}

/**
 * Reduces `pixels` to at most `maxColors` swatches, ordered by how much of the
 * image they cover. Returns an empty array for empty input.
 */
export function medianCut(pixels: Rgb[], maxColors: number): Swatch[] {
  if (pixels.length === 0 || maxColors < 1) return [];

  let boxes: Box[] = [{ pixels }];

  while (boxes.length < maxColors) {
    // Always split the box holding the most pixels; that is what keeps the
    // palette from spending detail on a handful of stray pixels.
    let targetIndex = -1;
    let targetSize = 1;
    boxes.forEach((box, index) => {
      if (box.pixels.length > targetSize) {
        targetSize = box.pixels.length;
        targetIndex = index;
      }
    });
    if (targetIndex === -1) break;

    const split = splitBox(boxes[targetIndex]);
    if (!split) break;

    boxes = [
      ...boxes.slice(0, targetIndex),
      ...split,
      ...boxes.slice(targetIndex + 1),
    ];
  }

  const total = pixels.length;
  return boxes
    .map((box) => ({
      color: averageColor(box.pixels),
      count: box.pixels.length,
      share: box.pixels.length / total,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Flattens `ImageData`-style RGBA bytes into opaque pixels, skipping every
 * `step`-th pixel to keep quantization fast on large images. Pixels that are
 * more than half transparent are dropped: they are usually the checkerboard
 * background of a PNG, not part of the design.
 */
export function pixelsFromImageData(
  data: Uint8ClampedArray | number[],
  step = 1,
): Rgb[] {
  const pixels: Rgb[] = [];
  const stride = 4 * Math.max(1, Math.floor(step));

  for (let i = 0; i + 3 < data.length; i += stride) {
    if (data[i + 3] < 128) continue;
    pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }

  return pixels;
}
