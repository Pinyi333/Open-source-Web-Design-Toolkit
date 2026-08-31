/**
 * Fetches a page and its stylesheets on behalf of the browser, so the tools can
 * analyze sites that do not send CORS headers.
 *
 * Every limit here exists to stop this endpoint being useful to someone who is
 * not the user: bounded time, bounded bytes, bounded redirects, and an address
 * check on every hop. See lib/net/url-guard.ts for the reasoning.
 */

import { lookup } from "node:dns/promises";
import {
  BlockedUrlError,
  isBlockedAddress,
  isBlockedHostname,
  parseTargetUrl,
} from "./url-guard";

export const LIMITS = {
  /** Whole-request budget, shared across the page and its stylesheets. */
  totalTimeoutMs: 12_000,
  /** Per-request budget. */
  requestTimeoutMs: 8_000,
  maxRedirects: 3,
  maxHtmlBytes: 2 * 1024 * 1024,
  maxCssBytes: 1024 * 1024,
  maxStylesheets: 10,
} as const;

export const USER_AGENT =
  "web-design-toolkit/0.1 (+https://github.com/Pinyi333/Open-source-Web-Design-Toolkit)";

export interface FetchedStylesheet {
  href: string;
  css: string;
  /** True when the stylesheet was inline in a <style> element. */
  inline: boolean;
}

export interface EmbeddingPolicy {
  /** Raw X-Frame-Options header, if the site sent one. */
  xFrameOptions: string | null;
  /** The frame-ancestors directive from the CSP header, if present. */
  frameAncestors: string | null;
  /** Our reading of whether an iframe on another origin will be refused. */
  embeddable: boolean;
  /** Human-readable explanation, present only when `embeddable` is false. */
  reason?: string;
}

export interface SiteSnapshot {
  /** The URL we ended up at, after redirects. */
  finalUrl: string;
  status: number;
  html: string;
  stylesheets: FetchedStylesheet[];
  embedding: EmbeddingPolicy;
  /** Non-fatal problems, e.g. a stylesheet that timed out. */
  notes: string[];
}

/** Resolves a hostname and rejects it if any answer is in private space. */
async function assertHostAllowed(url: URL): Promise<void> {
  const hostCheck = isBlockedHostname(url.hostname);
  if (hostCheck.blocked) {
    throw new BlockedUrlError(
      `Refusing to fetch ${url.hostname} (${hostCheck.reason}). ` +
        `Private and local addresses are blocked; paste the page source instead.`,
    );
  }

  // A literal IP was already checked by isBlockedHostname and needs no lookup.
  if (/^[\d.]+$/.test(url.hostname) || url.hostname.includes(":")) return;

  let answers: { address: string }[];
  try {
    answers = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new BlockedUrlError(`Could not resolve ${url.hostname}.`);
  }

  if (answers.length === 0) {
    throw new BlockedUrlError(`Could not resolve ${url.hostname}.`);
  }

  for (const { address } of answers) {
    const check = isBlockedAddress(address);
    if (check.blocked) {
      throw new BlockedUrlError(
        `Refusing to fetch ${url.hostname}: it resolves to ${address} (${check.reason}).`,
      );
    }
  }
}

/** Reads a response body up to `maxBytes`, then gives up on the rest. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, value.byteLength - (total - maxBytes)));
        break;
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const merged = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

interface SafeFetchResult {
  response: Response;
  finalUrl: URL;
}

/**
 * Follows redirects by hand so that each hop can be re-validated. `fetch` with
 * `redirect: "follow"` would happily walk from a public host into 127.0.0.1.
 */
async function safeFetch(
  target: URL,
  signal: AbortSignal,
  accept: string,
): Promise<SafeFetchResult> {
  let url = target;

  for (let hop = 0; hop <= LIMITS.maxRedirects; hop += 1) {
    await assertHostAllowed(url);

    const timeout = AbortSignal.timeout(LIMITS.requestTimeoutMs);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.any([signal, timeout]),
      headers: {
        "user-agent": USER_AGENT,
        accept,
        "accept-language": "en",
      },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    const location = response.headers.get("location");

    if (!isRedirect || !location) {
      return { response, finalUrl: url };
    }

    await response.body?.cancel().catch(() => {});

    let next: URL;
    try {
      next = new URL(location, url);
    } catch {
      throw new BlockedUrlError(`Server redirected to an invalid URL: ${location}`);
    }

    if (next.protocol !== "http:" && next.protocol !== "https:") {
      throw new BlockedUrlError(
        `Server redirected to an unsupported protocol: ${next.protocol}`,
      );
    }

    url = next;
  }

  throw new BlockedUrlError(
    `Too many redirects (more than ${LIMITS.maxRedirects}).`,
  );
}

/**
 * Reads X-Frame-Options and CSP frame-ancestors to work out whether the page
 * can be shown in the Responsive Tester's iframe. We only report what the
 * headers say; we never try to bypass them.
 */
export function readEmbeddingPolicy(headers: Headers): EmbeddingPolicy {
  const xfo = headers.get("x-frame-options");
  const csp = headers.get("content-security-policy");

  let frameAncestors: string | null = null;
  if (csp) {
    for (const directive of csp.split(";")) {
      const trimmed = directive.trim();
      if (trimmed.toLowerCase().startsWith("frame-ancestors")) {
        frameAncestors = trimmed.slice("frame-ancestors".length).trim();
        break;
      }
    }
  }

  const xfoValue = xfo?.trim().toLowerCase() ?? null;
  if (xfoValue === "deny") {
    return {
      xFrameOptions: xfo,
      frameAncestors,
      embeddable: false,
      reason: "The site sends X-Frame-Options: DENY, so no site may frame it.",
    };
  }
  if (xfoValue === "sameorigin") {
    return {
      xFrameOptions: xfo,
      frameAncestors,
      embeddable: false,
      reason:
        "The site sends X-Frame-Options: SAMEORIGIN, so only its own pages may frame it.",
    };
  }

  if (frameAncestors) {
    const value = frameAncestors.toLowerCase();
    if (value === "'none'") {
      return {
        xFrameOptions: xfo,
        frameAncestors,
        embeddable: false,
        reason: "The site's Content-Security-Policy sets frame-ancestors 'none'.",
      };
    }
    if (!value.includes("*")) {
      return {
        xFrameOptions: xfo,
        frameAncestors,
        embeddable: false,
        reason:
          `The site's Content-Security-Policy only allows framing by ${frameAncestors}.`,
      };
    }
  }

  return { xFrameOptions: xfo, frameAncestors, embeddable: true };
}

/** Pulls <style> blocks and <link rel="stylesheet"> hrefs out of raw HTML. */
export function extractStyleRefs(html: string, baseUrl: URL): {
  inline: string[];
  links: string[];
} {
  const inline: string[] = [];
  const styleTag = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleTag.exec(html)) !== null) {
    const css = match[1].trim();
    if (css) inline.push(css);
  }

  const links: string[] = [];
  const linkTag = /<link\b[^>]*>/gi;
  while ((match = linkTag.exec(html)) !== null) {
    const tag = match[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;

    const href = /href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
    const value = href?.[1] ?? href?.[2] ?? href?.[3];
    if (!value) continue;

    try {
      const resolved = new URL(value, baseUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        links.push(resolved.toString());
      }
    } catch {
      // A malformed href is the site's problem, not ours; skip it.
    }
  }

  return { inline, links };
}

/**
 * Fetches a page plus up to `LIMITS.maxStylesheets` of its stylesheets.
 * Throws `BlockedUrlError` for anything the guard refuses; every other failure
 * is reported through `notes` so a partial result is still useful.
 */
export async function fetchSite(rawUrl: string): Promise<SiteSnapshot> {
  const target = parseTargetUrl(rawUrl);
  const budget = AbortSignal.timeout(LIMITS.totalTimeoutMs);
  const notes: string[] = [];

  const { response, finalUrl } = await safeFetch(target, budget, "text/html,*/*;q=0.8")
    .catch((error: unknown) => {
      throw normalizeFetchError(error, target);
    });

  const embedding = readEmbeddingPolicy(response.headers);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new BlockedUrlError(
      `${finalUrl.host} responded with HTTP ${response.status}.`,
    );
  }

  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    await response.body?.cancel().catch(() => {});
    throw new BlockedUrlError(
      `Expected an HTML page but ${finalUrl.host} returned "${contentType}".`,
    );
  }

  const html = await readCapped(response, LIMITS.maxHtmlBytes);
  const { inline, links } = extractStyleRefs(html, finalUrl);

  const stylesheets: FetchedStylesheet[] = inline.map((css, index) => ({
    href: `inline #${index + 1}`,
    css,
    inline: true,
  }));

  const budgetedLinks = links.slice(0, LIMITS.maxStylesheets);
  if (links.length > budgetedLinks.length) {
    notes.push(
      `The page links ${links.length} stylesheets; only the first ${budgetedLinks.length} were fetched.`,
    );
  }

  const results = await Promise.all(
    budgetedLinks.map(async (href) => {
      try {
        const sheet = await safeFetch(new URL(href), budget, "text/css,*/*;q=0.1");
        if (!sheet.response.ok) {
          await sheet.response.body?.cancel().catch(() => {});
          return { href, error: `HTTP ${sheet.response.status}` };
        }
        const css = await readCapped(sheet.response, LIMITS.maxCssBytes);
        return { href, css };
      } catch (error) {
        return {
          href,
          error: error instanceof Error ? error.message : "could not be fetched",
        };
      }
    }),
  );

  for (const result of results) {
    if ("css" in result && result.css) {
      stylesheets.push({ href: result.href, css: result.css, inline: false });
    } else if ("error" in result) {
      notes.push(`Skipped ${result.href}: ${result.error}`);
    }
  }

  return {
    finalUrl: finalUrl.toString(),
    status: response.status,
    html,
    stylesheets,
    embedding,
    notes,
  };
}

function normalizeFetchError(error: unknown, target: URL): Error {
  if (error instanceof BlockedUrlError) return error;
  if (error instanceof Error && error.name === "TimeoutError") {
    return new BlockedUrlError(`${target.host} took too long to respond.`);
  }
  if (error instanceof Error && error.name === "AbortError") {
    return new BlockedUrlError(`The request to ${target.host} was cut short.`);
  }
  return new BlockedUrlError(
    `Could not reach ${target.host}. It may be down, or blocking automated requests.`,
  );
}
