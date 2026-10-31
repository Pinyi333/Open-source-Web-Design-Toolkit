/**
 * Browser-side wrapper around POST /api/notion/cases.
 */

import type { NotionCasesResult } from "./notion";

export class NotionClientError extends Error {}

export async function loadNotionCases(
  token: string,
  databaseId: string,
  signal?: AbortSignal,
): Promise<NotionCasesResult> {
  let response: Response;
  try {
    response = await fetch("/api/notion/cases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, databaseId }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new NotionClientError("Could not reach the Notion endpoint.");
  }

  const payload = (await response.json().catch(() => null)) as (NotionCasesResult & { error?: string }) | null;
  if (!response.ok || !payload) {
    throw new NotionClientError(payload?.error ?? `The request failed with HTTP ${response.status}.`);
  }
  return payload;
}
