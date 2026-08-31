/**
 * Browser-side wrapper around POST /api/fetch-site.
 * Shared by the Typography Analyzer and the Responsive Tester.
 */

import type { SiteSnapshot } from "./fetch-site";

export type { SiteSnapshot };

export class FetchSiteError extends Error {}

export async function fetchSiteSnapshot(
  url: string,
  signal?: AbortSignal,
): Promise<SiteSnapshot> {
  let response: Response;
  try {
    response = await fetch("/api/fetch-site", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new FetchSiteError("Could not reach the analyzer endpoint.");
  }

  const payload = (await response.json().catch(() => null)) as
    | (SiteSnapshot & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new FetchSiteError(
      payload?.error ?? `The request failed with HTTP ${response.status}.`,
    );
  }

  return payload;
}
