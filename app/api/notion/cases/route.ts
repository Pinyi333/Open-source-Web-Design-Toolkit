/**
 * Reads the visitor's Notion case library on their behalf.
 *
 * Notion's API sends no CORS headers, so the browser cannot call it directly.
 * This route is a narrow pass-through: it only ever calls api.notion.com, with
 * a database id reduced to 32 hex characters (see lib/planner/notion.ts), and
 * returns parsed cases. The token arrives in the request body, is used for
 * that one call, and is never stored or logged.
 */

import { NextResponse } from "next/server";

import { NotionError, fetchNotionCases } from "@/lib/planner/notion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Up to five 100-row pages at 10s each would exceed this, but a real library
// answers in well under a second per page; this only stops a hung request.
export const maxDuration = 30;

/** Best-effort, in-memory, per-instance. Same caveats as /api/fetch-site. */
const RATE_LIMIT = { windowMs: 60_000, maxRequests: 10 };
const buckets = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    if (buckets.size > 5000) {
      for (const [id, entry] of buckets) if (now > entry.resetAt) buckets.delete(id);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT.maxRequests;
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  if (!allowed(clientKey(request))) {
    return NextResponse.json({ error: "Too many requests. Try again in a minute." }, { status: 429 });
  }

  let token: unknown;
  let databaseId: unknown;
  try {
    const body = (await request.json()) as { token?: unknown; databaseId?: unknown };
    token = body?.token;
    databaseId = body?.databaseId;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  if (typeof token !== "string" || typeof databaseId !== "string" || token.length > 512 || databaseId.length > 2048) {
    return NextResponse.json(
      { error: 'Send a JSON body of the form { "token": "ntn_…", "databaseId": "…" }.' },
      { status: 400 },
    );
  }

  try {
    const result = await fetchNotionCases({ token, databaseId });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof NotionError) {
      // Pass Notion's own 4xx and our 502/504 through so the UI can explain
      // them; any other upstream status is reported as a bad gateway.
      const status = error.status >= 400 && error.status < 500 ? error.status : error.status === 504 ? 504 : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    // Deliberately not logging the error object: it could carry request
    // details, and the token is in the request.
    console.error("notion/cases failed");
    return NextResponse.json({ error: "Something went wrong reading Notion." }, { status: 500 });
  }
}
