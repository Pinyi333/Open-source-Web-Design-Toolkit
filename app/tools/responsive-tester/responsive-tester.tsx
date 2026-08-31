"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { fetchSiteSnapshot, FetchSiteError } from "@/lib/net/client";
import type { EmbeddingPolicy } from "@/lib/net/fetch-site";
import {
  DEFAULT_DEVICE_IDS,
  DEVICES,
  clampViewport,
  getDevice,
  isLocalUrl,
  rotate,
  type Device,
  type Viewport,
} from "@/lib/responsive/devices";
import { parseTargetUrl } from "@/lib/net/url-guard";
import { readBreakpoints } from "@/lib/typography/analyze";
import { parseCss } from "@/lib/typography/parse-css";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Notice,
  Spinner,
  Tabs,
  cx,
} from "@/components/ui";

type Layout = "grid" | "single";

interface Precheck {
  embedding: EmbeddingPolicy;
  breakpoints: number[];
  hasViewportMeta: boolean;
  finalUrl: string;
}

/** A frame currently on screen: either a named device or a custom width. */
interface Frame {
  id: string;
  label: string;
  viewport: Viewport;
}

function deviceFrame(device: Device): Frame {
  return {
    id: device.id,
    label: device.name,
    viewport: { width: device.width, height: device.height },
  };
}

export function ResponsiveTester() {
  const [input, setInput] = useState("");
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [precheck, setPrecheck] = useState<Precheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [layout, setLayout] = useState<Layout>("grid");
  const [selected, setSelected] = useState<string[]>(DEFAULT_DEVICE_IDS);
  const [singleId, setSingleId] = useState("iphone-15");
  const [landscape, setLandscape] = useState(false);
  const [customWidth, setCustomWidth] = useState("");
  const [customFrames, setCustomFrames] = useState<Frame[]>([]);

  // Bumping this key remounts every iframe, which is the only reliable way to
  // reload a cross-origin frame from the outside.
  const [reloadKey, setReloadKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setError(null);

    let target: string;
    try {
      target = parseTargetUrl(input).toString();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That URL is not valid.");
      return;
    }

    setLoadedUrl(target);
    setPrecheck(null);
    setReloadKey((key) => key + 1);

    // A local dev server is the most useful thing to preview and the one thing
    // the server cannot fetch, so skip the precheck rather than fail it.
    if (isLocalUrl(target)) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setChecking(true);

    try {
      const snapshot = await fetchSiteSnapshot(target, controller.signal);
      const mediaQueries = snapshot.stylesheets.flatMap(
        (sheet) => parseCss(sheet.css).mediaQueries,
      );

      setPrecheck({
        embedding: snapshot.embedding,
        breakpoints: readBreakpoints(mediaQueries).map((value) =>
          Number.parseInt(value, 10),
        ),
        hasViewportMeta: /<meta\b[^>]*name\s*=\s*["']?viewport/i.test(snapshot.html),
        finalUrl: snapshot.finalUrl,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      // The preview may still work even when the precheck cannot run, so this
      // is a note rather than a failure.
      setError(
        cause instanceof FetchSiteError
          ? `${cause.message} The preview below may still load.`
          : null,
      );
    } finally {
      setChecking(false);
    }
  }, [input]);

  const addCustomFrame = useCallback(() => {
    const width = clampViewport(Number(customWidth));
    const id = `custom-${width}`;
    setCustomFrames((frames) =>
      frames.some((frame) => frame.id === id)
        ? frames
        : [...frames, { id, label: `${width}px`, viewport: { width, height: 900 } }],
    );
    setCustomWidth("");
  }, [customWidth]);

  const addBreakpointFrames = useCallback(() => {
    if (!precheck) return;
    setCustomFrames((frames) => {
      const next = [...frames];
      for (const width of precheck.breakpoints) {
        const id = `custom-${width}`;
        if (!next.some((frame) => frame.id === id)) {
          next.push({ id, label: `${width}px`, viewport: { width, height: 900 } });
        }
      }
      return next;
    });
  }, [precheck]);

  const frames = useMemo(() => {
    const base =
      layout === "single"
        ? [getDevice(singleId)].filter((device): device is Device => Boolean(device)).map(deviceFrame)
        : selected
            .map((id) => getDevice(id))
            .filter((device): device is Device => Boolean(device))
            .map(deviceFrame);

    const all = layout === "single" ? base : [...base, ...customFrames];
    return landscape
      ? all.map((frame) => ({ ...frame, viewport: rotate(frame.viewport) }))
      : all;
  }, [layout, singleId, selected, customFrames, landscape]);

  const blocked = precheck?.embedding.embeddable === false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Page to preview" />
        <div className="space-y-4 p-5">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load();
            }}
          >
            <Field
              label="URL"
              htmlFor="target"
              hint="Your own site or a local dev server works best. Many public sites refuse to be shown in a frame; this tool checks the headers first and tells you when that is the case."
            >
              <div className="flex gap-2">
                <Input
                  id="target"
                  type="text"
                  inputMode="url"
                  placeholder="localhost:3000"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                />
                <Button type="submit" variant="primary" disabled={!input.trim()}>
                  {checking ? <Spinner /> : null}
                  Load
                </Button>
              </div>
            </Field>
          </form>

          {error ? <Notice tone="warning">{error}</Notice> : null}

          {blocked ? (
            <Notice tone="error" title="This site cannot be framed">
              <p>{precheck?.embedding.reason}</p>
              <p className="mt-2 text-xs">
                This is the site&apos;s decision and there is no way around it from a
                browser. Point the tool at your own site or a local dev server such as{" "}
                <code className="rounded bg-canvas px-1 py-0.5 font-mono">
                  localhost:3000
                </code>{" "}
                instead.
              </p>
            </Notice>
          ) : null}

          {precheck && !blocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="positive">Embeddable</Badge>
              {precheck.hasViewportMeta ? (
                <Badge tone="positive">viewport meta present</Badge>
              ) : (
                <Badge tone="critical">no viewport meta</Badge>
              )}
              {precheck.breakpoints.length > 0 ? (
                <>
                  <Badge>
                    {precheck.breakpoints.length} breakpoints in its CSS
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={addBreakpointFrames}>
                    Add a frame at each
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {precheck && !precheck.hasViewportMeta ? (
            <Notice tone="warning" title="No viewport meta tag">
              Without{" "}
              <code className="rounded bg-canvas px-1 py-0.5 font-mono text-[11px]">
                &lt;meta name=&quot;viewport&quot; content=&quot;width=device-width,
                initial-scale=1&quot;&gt;
              </code>{" "}
              phones render the page at about 980px wide and scale it down, so the frames
              below will not match what a real phone shows.
            </Notice>
          ) : null}
        </div>
      </Card>

      {!loadedUrl ? (
        <Card>
          <EmptyState
            title="Nothing loaded yet"
            description="Enter a URL above. The page opens in real iframes at each device width, so what you see is the site's own responsive behaviour rather than a screenshot."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title="Frames"
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setLandscape((v) => !v)}>
                    {landscape ? "Portrait" : "Landscape"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setReloadKey((key) => key + 1)}
                  >
                    Reload
                  </Button>
                  <Tabs
                    label="Layout"
                    value={layout}
                    onChange={setLayout}
                    options={[
                      { id: "grid", label: "Side by side" },
                      { id: "single", label: "One device" },
                    ]}
                  />
                </div>
              }
            />
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-1.5">
                {DEVICES.map((device) => {
                  const active =
                    layout === "single"
                      ? singleId === device.id
                      : selected.includes(device.id);
                  return (
                    <button
                      key={device.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        if (layout === "single") {
                          setSingleId(device.id);
                          return;
                        }
                        setSelected((current) =>
                          current.includes(device.id)
                            ? current.filter((id) => id !== device.id)
                            : [...current, device.id],
                        );
                      }}
                      className={cx(
                        "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                        active
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-line bg-canvas text-muted hover:border-line-strong hover:text-ink",
                      )}
                    >
                      {device.name}
                      <span className="ml-1.5 font-mono text-[10px] opacity-60">
                        {device.width}
                      </span>
                    </button>
                  );
                })}
              </div>

              {layout === "grid" ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-40">
                    <Field label="Custom width" htmlFor="custom">
                      <Input
                        id="custom"
                        type="number"
                        min={240}
                        max={4096}
                        placeholder="1440"
                        value={customWidth}
                        onChange={(event) => setCustomWidth(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addCustomFrame();
                          }
                        }}
                      />
                    </Field>
                  </div>
                  <Button size="md" onClick={addCustomFrame} disabled={!customWidth}>
                    Add frame
                  </Button>
                  {customFrames.length > 0 ? (
                    <Button size="md" variant="ghost" onClick={() => setCustomFrames([])}>
                      Clear custom
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          {frames.length === 0 ? (
            <Card>
              <EmptyState
                title="No devices selected"
                description="Pick at least one device above."
              />
            </Card>
          ) : (
            <div
              className={cx(
                "flex gap-6 overflow-x-auto pb-4",
                layout === "single" ? "justify-center" : "items-start",
              )}
            >
              {frames.map((frame) => (
                <PreviewFrame
                  key={`${frame.id}-${reloadKey}`}
                  frame={frame}
                  url={loadedUrl}
                  fullHeight={layout === "single"}
                />
              ))}
            </div>
          )}

          <p className="text-xs leading-relaxed text-faint">
            Each frame is a real iframe at that CSS width, so the site&apos;s own media
            queries decide what it shows. Frames scroll independently — a page on another
            origin will not let this one drive its scroll position.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * One device frame.
 *
 * The iframe is rendered at its true CSS size and then visually scaled with a
 * transform, so the page inside genuinely believes it is that wide. Setting a
 * smaller width and zooming would change which media queries apply.
 */
function PreviewFrame({
  frame,
  url,
  fullHeight,
}: {
  frame: Frame;
  url: string;
  fullHeight: boolean;
}) {
  const displayHeight = fullHeight ? frame.viewport.height : 620;
  const maxDisplayWidth = fullHeight ? 900 : 380;
  const scale = Math.min(1, maxDisplayWidth / frame.viewport.width);

  return (
    <figure className="shrink-0">
      <figcaption className="mb-2 flex items-baseline gap-2">
        <span className="text-xs font-medium text-ink">{frame.label}</span>
        <span className="font-mono text-[11px] text-faint">
          {frame.viewport.width}×{frame.viewport.height}
        </span>
        {scale < 1 ? (
          <span className="font-mono text-[11px] text-faint">
            {Math.round(scale * 100)}%
          </span>
        ) : null}
      </figcaption>

      <div
        className="overflow-hidden rounded-xl border border-line bg-canvas"
        style={{
          width: frame.viewport.width * scale,
          height: displayHeight * scale,
        }}
      >
        <iframe
          src={url}
          title={`${frame.label} preview`}
          loading="lazy"
          // Let the page run scripts and its own navigation, but keep it from
          // reaching back into this document or opening popups.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          style={{
            width: frame.viewport.width,
            height: displayHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: "none",
            display: "block",
          }}
        />
      </div>
    </figure>
  );
}
