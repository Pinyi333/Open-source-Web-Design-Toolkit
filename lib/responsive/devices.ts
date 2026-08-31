/**
 * Device presets for the Responsive Tester.
 *
 * The widths are CSS pixels — the number a media query compares against — not
 * the hardware pixels a spec sheet quotes. A 15 Pro Max is 1290 physical
 * pixels wide but 430 CSS pixels, and it is 430 that decides which breakpoint
 * applies.
 */

export type DeviceCategory = "phone" | "tablet" | "laptop" | "desktop";

export interface Device {
  id: string;
  name: string;
  width: number;
  height: number;
  category: DeviceCategory;
  /** Device pixel ratio, shown for context; the preview is not scaled by it. */
  dpr: number;
}

export const DEVICES: Device[] = [
  { id: "iphone-se", name: "iPhone SE", width: 375, height: 667, category: "phone", dpr: 2 },
  { id: "iphone-15", name: "iPhone 15", width: 393, height: 852, category: "phone", dpr: 3 },
  { id: "iphone-15-pro-max", name: "iPhone 15 Pro Max", width: 430, height: 932, category: "phone", dpr: 3 },
  { id: "pixel-8", name: "Pixel 8", width: 412, height: 915, category: "phone", dpr: 2.6 },
  { id: "galaxy-s24", name: "Galaxy S24", width: 360, height: 780, category: "phone", dpr: 3 },
  { id: "ipad-mini", name: "iPad mini", width: 744, height: 1133, category: "tablet", dpr: 2 },
  { id: "ipad-air", name: "iPad Air", width: 820, height: 1180, category: "tablet", dpr: 2 },
  { id: "ipad-pro-12", name: 'iPad Pro 12.9"', width: 1024, height: 1366, category: "tablet", dpr: 2 },
  { id: "surface-pro", name: "Surface Pro", width: 912, height: 1368, category: "tablet", dpr: 2 },
  { id: "laptop-1280", name: "Laptop", width: 1280, height: 800, category: "laptop", dpr: 2 },
  { id: "laptop-1440", name: 'MacBook Pro 14"', width: 1512, height: 982, category: "laptop", dpr: 2 },
  { id: "desktop-1920", name: "Desktop", width: 1920, height: 1080, category: "desktop", dpr: 1 },
];

export const DEFAULT_DEVICE_IDS = ["iphone-15", "ipad-air", "laptop-1280"];

export function getDevice(id: string): Device | undefined {
  return DEVICES.find((device) => device.id === id);
}

/** The common Tailwind-style breakpoints, offered as one-click frame widths. */
export const COMMON_BREAKPOINTS = [320, 480, 640, 768, 1024, 1280, 1536];

export interface Viewport {
  width: number;
  height: number;
}

export function rotate({ width, height }: Viewport): Viewport {
  return { width: height, height: width };
}

/**
 * Works out the scale that fits `viewport` inside `available`.
 * Never scales above 1: blowing a 375px frame up to fill a desktop monitor
 * would show you a layout nobody will ever see.
 */
export function fitScale(viewport: Viewport, available: Viewport): number {
  if (viewport.width <= 0 || viewport.height <= 0) return 1;
  const scale = Math.min(
    available.width / viewport.width,
    available.height / viewport.height,
  );
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(1, scale);
}

export const MIN_VIEWPORT = 240;
export const MAX_VIEWPORT = 4096;

export function clampViewport(value: number): number {
  if (!Number.isFinite(value)) return MIN_VIEWPORT;
  return Math.min(MAX_VIEWPORT, Math.max(MIN_VIEWPORT, Math.round(value)));
}

/**
 * True when a URL points at the machine running the browser. These are worth
 * singling out: they are the one case the server-side prefetch cannot check,
 * but they embed in an iframe perfectly well.
 */
export function isLocalUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host.startsWith("127.") ||
      host === "::1" ||
      host === "0.0.0.0"
    );
  } catch {
    return false;
  }
}
