/**
 * Turns a PNG or JPEG file into the flat pixel list `lib/color` quantizes.
 *
 * This is deliberately the only place in the MCP server that needs image
 * dependencies: everything downstream is the same pure `lib/` code the web
 * app uses. Format is detected from magic bytes, not the file extension,
 * because agents pass paths they did not name themselves.
 */

import jpeg from "jpeg-js";
import { PNG } from "pngjs";

import type { Rgb } from "../../lib/color/convert";
import { pixelsFromImageData } from "../../lib/color/quantize";

/** Cap on sampled pixels; beyond this, quantization gains nothing but time. */
const MAX_SAMPLED_PIXELS = 200_000;

export interface DecodedImage {
  width: number;
  height: number;
  /** Opaque pixels, sampled down to at most MAX_SAMPLED_PIXELS. */
  pixels: Rgb[];
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length > 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

export function decodeImage(buffer: Buffer): DecodedImage {
  let width: number;
  let height: number;
  let data: Uint8Array;

  if (isPng(buffer)) {
    const png = PNG.sync.read(buffer);
    width = png.width;
    height = png.height;
    data = png.data;
  } else if (isJpeg(buffer)) {
    const decoded = jpeg.decode(buffer, {
      formatAsRGBA: true,
      maxMemoryUsageInMB: 512,
    });
    width = decoded.width;
    height = decoded.height;
    data = decoded.data;
  } else {
    throw new Error("Unsupported image format. Only PNG and JPEG are supported.");
  }

  const total = width * height;
  const step = Math.max(1, Math.ceil(total / MAX_SAMPLED_PIXELS));
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  return { width, height, pixels: pixelsFromImageData(rgba, step) };
}
