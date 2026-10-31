/**
 * Reads a case library from a Notion database.
 *
 * Bring-your-own-token: the token belongs to whoever runs the planner and is
 * never stored by this code. The request only ever goes to api.notion.com,
 * with a database id that has been reduced to 32 hex characters first, so
 * the user-supplied part of the URL cannot point anywhere else.
 *
 * Notion's API does not send CORS headers, which is why the web app calls
 * this from a server route (app/api/notion/cases) instead of the browser.
 */

import type { SiteCase } from "./types";

export const NOTION_API_BASE = "https://api.notion.com/v1";
/** The API version this parser was written against. */
export const NOTION_VERSION = "2022-06-28";

/** Hard cap on result pages fetched (100 rows each). */
const MAX_RESULT_PAGES = 5;
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Column names the parser looks for, first match wins, case-insensitive.
 * English and Traditional Chinese are both accepted so a library can be set
 * up in either language without configuration.
 */
export const NOTION_PROPERTY_ALIASES = {
  name: ["Name", "Title", "名稱", "網站名稱", "標題"],
  url: ["URL", "Link", "Website", "網址", "連結"],
  industry: ["Industry", "Category", "產業", "類型", "產業類型"],
  styleTags: ["Style", "Styles", "Style tags", "Tags", "風格", "風格標籤"],
  features: ["Features", "Feature", "功能"],
  image: ["Screenshot", "Image", "Cover", "截圖", "圖片"],
  notes: ["Notes", "Description", "備註", "說明"],
} as const;

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Accepts a raw id (with or without dashes) or a full Notion URL, and returns
 * the canonical dashed UUID, or null when nothing id-shaped is found.
 *
 * In a database URL like notion.so/team/Cases-<id>?v=<viewId> the database id
 * is the last 32-hex run in the *path*; the query string holds the view id.
 */
export function parseNotionDatabaseId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      candidate = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }

  const compact = candidate.replace(/-/g, "");
  const runs = compact.match(/[0-9a-f]{32}/gi);
  if (!runs) return null;
  const hex = runs[runs.length - 1].toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Cheap shape check so an obviously wrong value fails before a request.
 * Internal integration tokens start with "ntn_" (current) or "secret_" (older).
 */
export function isPlausibleNotionToken(token: string): boolean {
  return /^(ntn_|secret_)[A-Za-z0-9_-]{20,}$/.test(token.trim());
}

// --- parsing --------------------------------------------------------------------

interface RichText {
  plain_text?: string;
}

interface NotionProperty {
  type?: string;
  title?: RichText[];
  rich_text?: RichText[];
  url?: string | null;
  select?: { name?: string } | null;
  multi_select?: { name?: string }[];
  files?: { type?: string; external?: { url?: string }; file?: { url?: string } }[];
}

export interface NotionPage {
  id?: string;
  url?: string;
  properties?: Record<string, NotionProperty>;
  cover?: { type?: string; external?: { url?: string }; file?: { url?: string } } | null;
}

function findProperty(properties: Record<string, NotionProperty>, aliases: readonly string[]): NotionProperty | undefined {
  const byLower = new Map(Object.entries(properties).map(([key, value]) => [key.trim().toLowerCase(), value]));
  for (const alias of aliases) {
    const hit = byLower.get(alias.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

function textOf(prop: NotionProperty | undefined): string {
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return (prop.title ?? []).map((part) => part.plain_text ?? "").join("").trim();
    case "rich_text":
      return (prop.rich_text ?? []).map((part) => part.plain_text ?? "").join("").trim();
    case "url":
      return (prop.url ?? "").trim();
    case "select":
      return (prop.select?.name ?? "").trim();
    case "multi_select":
      return (prop.multi_select ?? []).map((option) => option.name ?? "").join(", ");
    default:
      return "";
  }
}

function listOf(prop: NotionProperty | undefined): string[] {
  if (!prop) return [];
  if (prop.type === "multi_select") {
    return (prop.multi_select ?? []).map((option) => (option.name ?? "").trim()).filter(Boolean);
  }
  // Tolerate a comma-separated text or a single select.
  return textOf(prop)
    .split(/[,，、]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function fileUrl(file: { type?: string; external?: { url?: string }; file?: { url?: string } } | null | undefined): string | undefined {
  if (!file) return undefined;
  return file.type === "external" ? file.external?.url : file.file?.url;
}

function safeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** One database row → one case, or null when the row has no usable name and URL. */
export function notionPageToCase(page: NotionPage): SiteCase | null {
  const props = page.properties ?? {};
  const name = textOf(findProperty(props, NOTION_PROPERTY_ALIASES.name));
  const url = safeHttpUrl(textOf(findProperty(props, NOTION_PROPERTY_ALIASES.url)));
  if (!name || !url) return null;

  const imageProp = findProperty(props, NOTION_PROPERTY_ALIASES.image);
  const image = safeHttpUrl(fileUrl(imageProp?.files?.[0]) ?? fileUrl(page.cover));
  const notes = textOf(findProperty(props, NOTION_PROPERTY_ALIASES.notes));

  return {
    id: page.id ?? url,
    name,
    url,
    industry: textOf(findProperty(props, NOTION_PROPERTY_ALIASES.industry)),
    styleTags: listOf(findProperty(props, NOTION_PROPERTY_ALIASES.styleTags)),
    features: listOf(findProperty(props, NOTION_PROPERTY_ALIASES.features)),
    ...(notes ? { notes } : {}),
    ...(image ? { image } : {}),
    source: "notion",
  };
}

// --- request ----------------------------------------------------------------------

export interface NotionCasesResult {
  cases: SiteCase[];
  /** Rows skipped because they had no name or no valid URL. */
  skipped: number;
  /** True when the database had more rows than the cap. */
  truncated: boolean;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchNotionCases({
  token,
  databaseId,
  fetchImpl = fetch,
}: {
  token: string;
  databaseId: string;
  fetchImpl?: FetchLike;
}): Promise<NotionCasesResult> {
  const id = parseNotionDatabaseId(databaseId);
  if (!id) throw new NotionError("That does not look like a Notion database ID or link.", 400);
  if (!isPlausibleNotionToken(token)) {
    throw new NotionError("That does not look like a Notion integration token (it should start with ntn_ or secret_).", 400);
  }

  const cases: SiteCase[] = [];
  let skipped = 0;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_RESULT_PAGES; page++) {
    let response: Response;
    try {
      response = await fetchImpl(`${NOTION_API_BASE}/databases/${id}/query`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token.trim()}`,
          "notion-version": NOTION_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new NotionError("Notion took too long to answer.", 504);
      }
      throw new NotionError("Could not reach api.notion.com from this server.", 502);
    }

    if (!response.ok) throw new NotionError(await describeFailure(response), response.status);

    const data = (await response.json()) as { results?: NotionPage[]; has_more?: boolean; next_cursor?: string | null };
    for (const row of data.results ?? []) {
      const parsed = notionPageToCase(row);
      if (parsed) cases.push(parsed);
      else skipped++;
    }

    if (!data.has_more || !data.next_cursor) return { cases, skipped, truncated: false };
    cursor = data.next_cursor;
  }

  return { cases, skipped, truncated: true };
}

async function describeFailure(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { message?: string } | null;
  switch (response.status) {
    case 401:
      return "Notion rejected the token. Check it was copied in full and the integration still exists.";
    case 403:
    case 404:
      return "Notion could not find that database. Open it in Notion, choose ··· → Connections, and add your integration.";
    case 429:
      return "Notion is rate limiting requests. Wait a few seconds and try again.";
    default:
      return `Notion returned HTTP ${response.status}${body?.message ? `: ${body.message}` : "."}`;
  }
}
