/**
 * The one server-side endpoint in this app: it fetches a page the user names
 * so the browser-side tools can read sites that do not send CORS headers.
 *
 * It is deliberately narrow. It returns the page's HTML, its stylesheets and
 * its framing headers, and nothing else. See lib/net/url-guard.ts for why the
 * address checks are shaped the way they are.
 */

import { NextResponse } from "next/server";

import { fetchSite } from "@/lib/net/fetch-site";
import { BlockedUrlError } from "@/lib/net/url-guard";

// dns.lookup is needed for the SSRF checks, so this cannot run on the edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Comfortably above the fetcher's own 12s budget, so a slow site hits our
// timeout and gets a useful message rather than being cut off by the host's
// default function limit and returning an opaque platform error.
export const maxDuration = 20;

/**
 * A best-effort per-IP rate limit.
 *
 * This is in-process memory: it resets on redeploy and is per-instance, so it
 * does not hold across a horizontally scaled deployment. It is here to stop
 * one person hammering a self-hosted copy, not as a security boundary. If you
 * deploy this publicly, put a real rate limiter in front of it.
 */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 20 };
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });

    // Opportunistic cleanup; without it the map grows forever.
    if (buckets.size > 5000) {
      for (const [id, entry] of buckets) {
        if (now > entry.resetAt) buckets.delete(id);
      }
    }

    return { allowed: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${limit.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let url: unknown;
  try {
    const body = await request.json();
    url = (body as { url?: unknown })?.url;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof url !== "string" || url.length > 2048) {
    return NextResponse.json(
      { error: 'Send a JSON body of the form { "url": "https://example.com" }.' },
      { status: 400 },
    );
  }

  try {
    const snapshot = await fetchSite(url);
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof BlockedUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // Anything else is a bug on our side; do not leak the stack to the client.
    console.error("fetch-site failed:", error);
    return NextResponse.json(
      { error: "Something went wrong fetching that page." },
      { status: 500 },
    );
  }
}
