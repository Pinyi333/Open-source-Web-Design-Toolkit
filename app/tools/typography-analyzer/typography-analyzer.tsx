"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { fetchSiteSnapshot, FetchSiteError } from "@/lib/net/client";
import {
  analyzeTypography,
  type Finding,
  type FontFamilyUsage,
  type TypographyReport,
} from "@/lib/typography/analyze";
import { buildScale, ROOT_FONT_SIZE } from "@/lib/typography/scale";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CodeBlock,
  EmptyState,
  Field,
  Input,
  Notice,
  Spinner,
  Tabs,
  Textarea,
} from "@/components/ui";

type Mode = "url" | "paste";

interface Result {
  report: TypographyReport;
  source: string;
  notes: string[];
}

const SAMPLE_TEXT = "The quick brown fox jumps over the lazy dog";

export function TypographyAnalyzer() {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const analyzeUrl = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError(null);

    try {
      const snapshot = await fetchSiteSnapshot(url, controller.signal);
      setResult({
        report: analyzeTypography({
          html: snapshot.html,
          css: snapshot.stylesheets.map((sheet) => sheet.css),
        }),
        source: snapshot.finalUrl,
        notes: snapshot.notes,
      });
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(
        cause instanceof FetchSiteError
          ? cause.message
          : "Could not analyze that URL.",
      );
    } finally {
      setBusy(false);
    }
  }, [url]);

  /**
   * Pasted input can be a full page, a fragment, or bare CSS. Rather than
   * asking which, the same text is handed to the analyzer as both HTML and
   * CSS: <style> blocks get picked out of the HTML, and text with no tags is
   * read as a stylesheet.
   */
  const analyzePasted = useCallback(() => {
    setError(null);

    const text = pasted.trim();
    if (!text) {
      setError("Paste some HTML or CSS first.");
      return;
    }

    const looksLikeHtml = /<[a-z!][\s\S]*>/i.test(text);
    const inlineStyles = Array.from(
      text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
    ).map((match) => match[1]);

    const css = looksLikeHtml ? inlineStyles : [text];
    if (looksLikeHtml && inlineStyles.length === 0) {
      setError(
        "That looks like HTML, but it has no <style> blocks. Paste the CSS too, or use the URL tab.",
      );
      return;
    }

    setResult({
      report: analyzeTypography({ html: looksLikeHtml ? text : "", css }),
      source: "pasted source",
      notes: [],
    });
  }, [pasted]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="What should I analyze?"
          actions={
            <Tabs
              label="Input mode"
              value={mode}
              onChange={setMode}
              options={[
                { id: "url", label: "URL" },
                { id: "paste", label: "Paste source" },
              ]}
            />
          }
        />
        <div className="space-y-4 p-5">
          {mode === "url" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void analyzeUrl();
              }}
              className="space-y-4"
            >
              <Field
                label="Page URL"
                htmlFor="url"
                hint="The page and its stylesheets are fetched by this app's server, because browsers will not let a page read another site's CSS directly. Private and local addresses are refused."
              >
                <div className="flex gap-2">
                  <Input
                    id="url"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    placeholder="example.com"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                  />
                  <Button type="submit" variant="primary" disabled={busy || !url.trim()}>
                    {busy ? <Spinner /> : null}
                    {busy ? "Fetching…" : "Analyze"}
                  </Button>
                </div>
              </Field>
            </form>
          ) : (
            <div className="space-y-4">
              <Field
                label="HTML or CSS"
                htmlFor="pasted"
                hint="Works with a whole page, a fragment, or a bare stylesheet. Nothing leaves your browser in this mode."
              >
                <Textarea
                  id="pasted"
                  rows={10}
                  spellCheck={false}
                  placeholder={"body { font-family: Inter, sans-serif; font-size: 16px; line-height: 1.6 }\nh1 { font-size: 2.5rem }"}
                  value={pasted}
                  onChange={(event) => setPasted(event.target.value)}
                />
              </Field>
              <Button variant="primary" onClick={analyzePasted} disabled={!pasted.trim()}>
                Analyze
              </Button>
            </div>
          )}

          {error ? <Notice tone="error">{error}</Notice> : null}
        </div>
      </Card>

      {result ? <Report result={result} /> : (
        <Card>
          <EmptyState
            title="No analysis yet"
            description="Enter a URL or paste some source above. You will get an inventory of the fonts, sizes, weights and line heights in use, plus whatever readability and performance problems turn up."
          />
        </Card>
      )}
    </div>
  );
}

function Report({ result }: { result: Result }) {
  const { report } = result;

  const suggested = useMemo(() => {
    const base = report.scale.base ?? ROOT_FONT_SIZE;
    const ratio = report.scale.ratio?.ratio ?? 1.25;
    const steps = buildScale(base, ratio);

    const css = [
      ":root {",
      ...steps.map((step) => `  --text-${step.label}: ${step.rem}rem;`),
      "}",
    ].join("\n");

    return { base, ratio, steps, css };
  }, [report.scale]);

  if (report.declarationCount === 0) {
    return (
      <Card>
        <EmptyState
          title="No typography declarations found"
          description={`Nothing in ${result.source} set a font, size, weight or line height. If the page styles its text with a framework's utility classes, the analyzer will see those class definitions only if the stylesheet was reachable.`}
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{result.source}</Badge>
        <Badge>{report.declarationCount} type declarations</Badge>
        {report.breakpoints.length > 0 ? (
          <Badge>{report.breakpoints.length} breakpoints</Badge>
        ) : null}
      </div>

      {result.notes.length > 0 ? (
        <Notice tone="info" title="Partial fetch">
          <ul className="list-inside list-disc space-y-0.5 text-xs">
            {result.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      <Findings findings={report.findings} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Families families={report.families} />
        <Sizes report={report} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Suggested scale"
            description={
              report.scale.ratio
                ? `Built from the ${report.scale.ratio.name.toLowerCase()} ratio already in use, at a ${suggested.base}px base.`
                : `The sizes on this page do not follow one ratio, so this is a major-third scale at a ${suggested.base}px base as a starting point.`
            }
          />
          <div className="space-y-4 p-4">
            <div className="space-y-1.5">
              {suggested.steps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-baseline gap-3 overflow-hidden rounded-md px-2 py-1 hover:bg-raised"
                >
                  <span className="w-10 shrink-0 font-mono text-[11px] text-faint">
                    {step.label}
                  </span>
                  <span className="w-16 shrink-0 font-mono text-[11px] text-muted">
                    {step.px}px
                  </span>
                  <span
                    className="truncate text-ink"
                    style={{ fontSize: `${Math.min(step.px, 44)}px`, lineHeight: 1.15 }}
                  >
                    Ag
                  </span>
                </div>
              ))}
            </div>
            <CodeBlock code={suggested.css} />
          </div>
        </Card>

        <div className="space-y-6">
          <Weights report={report} />
          {report.breakpoints.length > 0 ? (
            <Card>
              <CardHeader
                title="Breakpoints"
                description="Widths this page's own media queries switch at."
              />
              <div className="flex flex-wrap gap-1.5 p-4">
                {report.breakpoints.map((breakpoint) => (
                  <span
                    key={breakpoint}
                    className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-muted"
                  >
                    {breakpoint}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Findings({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return (
      <Notice tone="success" title="Nothing to flag">
        No readability, structure or web-font problems turned up in what could be read.
      </Notice>
    );
  }

  const tones = { error: "critical", warning: "caution", info: "accent" } as const;

  return (
    <Card>
      <CardHeader
        title={`${findings.length} ${findings.length === 1 ? "finding" : "findings"}`}
        description="Ordered by severity."
      />
      <ul className="divide-y divide-line">
        {findings.map((finding, index) => (
          <li key={index} className="flex gap-3 px-5 py-3.5">
            <Badge tone={tones[finding.severity]} className="mt-0.5 shrink-0">
              {finding.severity}
            </Badge>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{finding.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{finding.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const ORIGIN_LABELS: Record<FontFamilyUsage["origin"], string> = {
  "google-fonts": "Google Fonts",
  "self-hosted": "self-hosted",
  system: "system",
  unknown: "unidentified",
};

function Families({ families }: { families: FontFamilyUsage[] }) {
  const [preview, setPreview] = useState<string | null>(null);

  const webFonts = families.filter(
    (family) => family.origin === "google-fonts" && !family.generic,
  );

  return (
    <Card>
      <CardHeader
        title="Font families"
        description="Ranked by how often they are declared."
      />

      {/* Loading a Google Font is a request to Google, so it happens only when
          the user asks for a preview — never on page load. */}
      {preview ? (
        <link
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
            preview.replace(/ /g, "+"),
          )}&display=swap`}
        />
      ) : null}

      <ul className="divide-y divide-line">
        {families.map((family) => (
          <li key={family.name} className="px-5 py-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-ink">{family.name}</span>
              <Badge tone={family.generic ? "neutral" : "accent"}>
                {ORIGIN_LABELS[family.origin]}
              </Badge>
              {family.classification !== "unknown" ? (
                <Badge>{family.classification}</Badge>
              ) : null}
              <span className="ml-auto font-mono text-[11px] text-faint">
                ×{family.count}
              </span>
            </div>

            {webFonts.some((font) => font.name === family.name) ? (
              preview === family.name ? (
                <p
                  className="mt-2 truncate text-lg text-muted"
                  style={{ fontFamily: `"${family.name}", sans-serif` }}
                >
                  {SAMPLE_TEXT}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setPreview(family.name)}
                  className="mt-1.5 text-xs text-accent underline underline-offset-2"
                >
                  Preview this font (loads it from Google Fonts)
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Sizes({ report }: { report: TypographyReport }) {
  const max = Math.max(...report.sizes.map((size) => size.count), 1);

  return (
    <Card>
      <CardHeader
        title={`${report.sizes.length} distinct font ${report.sizes.length === 1 ? "size" : "sizes"}`}
        description={
          report.scale.ratio
            ? `They follow a ${report.scale.ratio.name.toLowerCase()} scale (${report.scale.ratio.ratio}), consistency ${report.scale.consistency}/100.`
            : `Consistency ${report.scale.consistency}/100 — the steps between sizes vary too much to name a ratio.`
        }
      />
      <ul className="max-h-96 divide-y divide-line overflow-y-auto">
        {report.sizes.map((size) => (
          <li key={size.raw} className="flex items-center gap-3 px-5 py-2.5">
            <span className="w-20 shrink-0 font-mono text-xs text-ink">{size.raw}</span>
            <span className="w-14 shrink-0 font-mono text-[11px] text-faint">
              {size.px !== null ? `${size.px}px` : size.unit}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-raised">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${(size.count / max) * 100}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-mono text-[11px] text-faint">
              {size.count}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Weights({ report }: { report: TypographyReport }) {
  if (report.weights.length === 0 && report.letterSpacings.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Weights and letter spacing" />
      <div className="space-y-4 p-5">
        {report.weights.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
              Weights
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.weights.map((weight) => (
                <span
                  key={weight.value}
                  className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-muted"
                >
                  {weight.value}
                  <span className="ml-1.5 text-faint">×{weight.count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {report.letterSpacings.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
              Letter spacing
            </p>
            <div className="flex flex-wrap gap-1.5">
              {report.letterSpacings.map((spacing) => (
                <span
                  key={spacing.raw}
                  className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-muted"
                >
                  {spacing.raw}
                  <span className="ml-1.5 text-faint">×{spacing.count}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
