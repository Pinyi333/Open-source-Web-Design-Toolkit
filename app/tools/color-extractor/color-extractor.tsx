"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatHsl,
  formatOklch,
  formatRgb,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  type Rgb,
} from "@/lib/color/convert";
import {
  BLACK,
  WHITE,
  contrastRatio,
  contrastReport,
  readableForeground,
} from "@/lib/color/contrast";
import { medianCut, pixelsFromImageData, type Swatch } from "@/lib/color/quantize";
import { EXPORT_FORMATS, exportPalette, type ExportFormat } from "@/lib/color/export";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  Dropzone,
  Notice,
  Spinner,
  Tabs,
  useCopy,
} from "@/components/ui";

/**
 * Longest edge the image is scaled to before quantizing. 200px is roughly
 * 40,000 samples, which is plenty to characterise a palette and fast enough
 * to feel instant on a phone.
 */
const SAMPLE_SIZE = 200;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Analysis {
  palette: Swatch[];
  previewUrl: string;
  fileName: string;
  dimensions: { width: number; height: number };
}

/** Draws the image into a canvas at reduced size and reads its pixels back. */
async function samplePixels(file: File): Promise<{
  pixels: Rgb[];
  dimensions: { width: number; height: number };
}> {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error("That file could not be decoded as an image."));
      element.src = url;
    });

    const { naturalWidth: width, naturalHeight: height } = image;
    if (!width || !height) {
      throw new Error("That image has no dimensions.");
    }

    const scale = Math.min(1, SAMPLE_SIZE / Math.max(width, height));
    const canvasWidth = Math.max(1, Math.round(width * scale));
    const canvasHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("This browser would not give us a canvas context.");

    context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    let data: ImageData;
    try {
      data = context.getImageData(0, 0, canvasWidth, canvasHeight);
    } catch {
      // Only same-origin or CORS-clean images can be read back. Files chosen
      // from disk always can, so this is close to unreachable in practice.
      throw new Error("The browser blocked reading this image's pixels.");
    }

    return {
      pixels: pixelsFromImageData(data.data),
      dimensions: { width, height },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ColorExtractor() {
  const [colorCount, setColorCount] = useState(6);
  const [pixels, setPixels] = useState<Rgb[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>("css");

  // Kept in a ref so the cleanup effect can revoke it without re-running on
  // every render.
  const previewRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" is not an image.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 20 MB.`,
        );
        return;
      }

      setBusy(true);
      try {
        const { pixels: sampled, dimensions } = await samplePixels(file);
        if (sampled.length === 0) {
          setError("Every pixel in that image is transparent.");
          return;
        }

        if (previewRef.current) URL.revokeObjectURL(previewRef.current);
        const previewUrl = URL.createObjectURL(file);
        previewRef.current = previewUrl;

        setPixels(sampled);
        setAnalysis({
          palette: medianCut(sampled, colorCount),
          previewUrl,
          fileName: file.name,
          dimensions,
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not read that image.");
      } finally {
        setBusy(false);
      }
    },
    [colorCount],
  );

  // Re-quantizing is cheap once the pixels are sampled, so the count slider
  // updates the palette without re-reading the file.
  const onCountChange = useCallback(
    (count: number) => {
      setColorCount(count);
      if (pixels) {
        setAnalysis((current) =>
          current ? { ...current, palette: medianCut(pixels, count) } : current,
        );
      }
    },
    [pixels],
  );

  const reset = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPixels(null);
    setAnalysis(null);
    setError(null);
  }, []);

  const exported = useMemo(
    () => (analysis ? exportPalette(analysis.palette, format) : ""),
    [analysis, format],
  );

  if (!analysis) {
    return (
      <div className="space-y-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Dropzone onFile={(file) => void handleFile(file)}>
          {busy ? (
            <>
              <Spinner className="text-accent" />
              <p className="text-sm text-muted">Reading the image…</p>
            </>
          ) : (
            <>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-raised text-faint">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 16V4M8 8l4-4 4 4" />
                  <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
                </svg>
              </span>
              <p className="text-sm font-medium text-ink">
                Drop an image here, or click to choose one
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted">
                PNG, JPEG, WebP, GIF or SVG. You can also paste one from the clipboard.
                The file is read in your browser and never uploaded anywhere.
              </p>
            </>
          )}
        </Dropzone>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Source image"
              actions={
                <Button size="sm" variant="ghost" onClick={reset}>
                  Replace
                </Button>
              }
            />
            <div className="p-4">
              {/* A blob URL of a user-chosen file: next/image would add a
                  loader and an optimization round-trip for no benefit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={analysis.previewUrl}
                alt={analysis.fileName}
                className="w-full rounded-lg border border-line bg-canvas object-contain"
                style={{ maxHeight: 260 }}
              />
              <p className="mt-3 truncate text-xs text-muted" title={analysis.fileName}>
                {analysis.fileName}
              </p>
              <p className="text-xs text-faint">
                {analysis.dimensions.width} × {analysis.dimensions.height} px
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Palette size" />
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={1}
                  value={colorCount}
                  onChange={(event) => onCountChange(Number(event.target.value))}
                  aria-label="Number of colors to extract"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-line accent-accent"
                />
                <span className="w-6 text-right font-mono text-sm text-ink">
                  {colorCount}
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Colors are grouped with median cut, so each swatch represents a real
                region of the image rather than a single sampled pixel.
              </p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <PaletteStrip palette={analysis.palette} />
          <SwatchTable palette={analysis.palette} />
          <ContrastMatrix palette={analysis.palette} />

          <Card>
            <CardHeader
              title="Export"
              description="Paste straight into a stylesheet or a token file."
              actions={
                <Tabs
                  label="Export format"
                  value={format}
                  onChange={setFormat}
                  options={EXPORT_FORMATS.map((option) => ({
                    id: option.id,
                    label: option.label,
                  }))}
                />
              }
            />
            <div className="p-4">
              <CodeBlock code={exported} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PaletteStrip({ palette }: { palette: Swatch[] }) {
  const { copied, copy } = useCopy();

  return (
    <div className="flex h-28 w-full overflow-hidden rounded-card border border-line">
      {palette.map((swatch, index) => {
        const hex = rgbToHex(swatch.color);
        const ink = rgbToHex(readableForeground(swatch.color));
        return (
          <button
            key={`${hex}-${index}`}
            type="button"
            onClick={() => void copy(hex)}
            title={`Copy ${hex}`}
            className="group relative flex items-end justify-center pb-3 transition-[flex-grow] duration-300"
            style={{
              backgroundColor: hex,
              color: ink,
              flexGrow: Math.max(swatch.share, 0.04),
            }}
          >
            <span className="font-mono text-[11px] font-medium opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {copied === hex ? "Copied" : hex}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SwatchTable({ palette }: { palette: Swatch[] }) {
  return (
    <Card>
      <CardHeader
        title="Swatches"
        description="Click any value to copy it. Contrast is measured against pure white and pure black."
      />
      <div className="divide-y divide-line">
        {palette.map((swatch, index) => (
          <SwatchRow key={index} swatch={swatch} index={index} />
        ))}
      </div>
    </Card>
  );
}

function SwatchRow({ swatch, index }: { swatch: Swatch; index: number }) {
  const { copied, copy } = useCopy();
  const hex = rgbToHex(swatch.color);

  const values = [
    { label: "HEX", value: hex },
    { label: "RGB", value: formatRgb(swatch.color) },
    { label: "HSL", value: formatHsl(rgbToHsl(swatch.color)) },
    { label: "OKLCH", value: formatOklch(rgbToOklch(swatch.color)) },
  ];

  const onWhite = contrastReport(swatch.color, WHITE);
  const onBlack = contrastReport(swatch.color, BLACK);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <span
          className="h-11 w-11 shrink-0 rounded-lg border border-line"
          style={{ backgroundColor: hex }}
          aria-hidden="true"
        />
        <div>
          <p className="font-mono text-xs text-faint">color-{index + 1}</p>
          <p className="text-xs text-muted">{(swatch.share * 100).toFixed(1)}% of image</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {values.map((entry) => (
          <button
            key={entry.label}
            type="button"
            onClick={() => void copy(entry.value)}
            title={`Copy ${entry.label}`}
            className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {copied === entry.value ? "Copied" : entry.value}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ContrastPill label="on white" report={onWhite} />
        <ContrastPill label="on black" report={onBlack} />
      </div>
    </div>
  );
}

function ContrastPill({
  label,
  report,
}: {
  label: string;
  report: ReturnType<typeof contrastReport>;
}) {
  const tone =
    report.level === "AAA" || report.level === "AA"
      ? "positive"
      : report.level === "AA Large"
        ? "caution"
        : "critical";

  return (
    <Badge tone={tone} title={`${report.ratio.toFixed(2)}:1 — WCAG ${report.level}`}>
      {label} {report.ratio.toFixed(1)}
    </Badge>
  );
}

/**
 * Every pair in the palette, graded. This is the question you actually have
 * when picking two colors out of a palette: can I put this text on that
 * background?
 */
function ContrastMatrix({ palette }: { palette: Swatch[] }) {
  const colors = palette.map((swatch) => swatch.color);

  return (
    <Card>
      <CardHeader
        title="Contrast matrix"
        description="Each cell is the contrast ratio of the row color as text on the column color. Green passes WCAG AA for body text, amber passes for large text only."
      />
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[420px] border-collapse text-center">
          <caption className="sr-only">
            Contrast ratios between every pair of palette colors
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-16" />
              {colors.map((color, index) => (
                <th key={index} scope="col" className="p-1">
                  <span
                    className="mx-auto block h-5 w-full max-w-10 rounded border border-line"
                    style={{ backgroundColor: rgbToHex(color) }}
                    title={rgbToHex(color)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colors.map((rowColor, row) => (
              <tr key={row}>
                <th scope="row" className="p-1">
                  <span
                    className="block h-5 w-full rounded border border-line"
                    style={{ backgroundColor: rgbToHex(rowColor) }}
                    title={rgbToHex(rowColor)}
                  />
                </th>
                {colors.map((columnColor, column) => {
                  if (row === column) {
                    return (
                      <td key={column} className="p-1">
                        <span className="block rounded bg-raised py-1.5 font-mono text-[11px] text-faint">
                          —
                        </span>
                      </td>
                    );
                  }

                  const ratio = contrastRatio(rowColor, columnColor);
                  const tone =
                    ratio >= 4.5
                      ? "bg-positive/15 text-positive"
                      : ratio >= 3
                        ? "bg-caution/15 text-caution"
                        : "bg-critical/10 text-faint";

                  return (
                    <td key={column} className="p-1">
                      <span
                        className={`block rounded py-1.5 font-mono text-[11px] font-medium ${tone}`}
                        title={`${ratio.toFixed(2)}:1`}
                      >
                        {ratio.toFixed(1)}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
