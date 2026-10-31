/**
 * Optional: ask Claude to review a site plan, with the user's own API key.
 *
 * The planner works without this. When a user opts in, the deterministic plan
 * is sent as the starting point and Claude returns structured suggestions:
 * page changes, hero copy, content ideas and risks. The request goes straight
 * from the user's browser to api.anthropic.com, so the key never touches the
 * server running this app.
 *
 * Plain fetch rather than the Anthropic SDK, because the web app keeps its
 * runtime dependencies to next/react/react-dom (see CLAUDE.md).
 */

import { planToMarkdown } from "./plan";
import type { SitePlan } from "./types";

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export const CLAUDE_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest)" },
] as const;

export const DEFAULT_CLAUDE_MODEL = CLAUDE_MODELS[0].id;

export type ReviewLanguage = "en" | "zh-TW";

export interface PlanReview {
  summary: string;
  pageChanges: { page: string; change: string; why: string }[];
  heroCopy: { headline: string; subheadline: string; cta: string };
  contentIdeas: string[];
  risks: string[];
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const SYSTEM_PROMPT = [
  "You are a senior information architect and UX strategist reviewing a website plan.",
  "The plan was produced by a rule-based planner from an industry template. Improve it for this specific project; do not restate it.",
  "Be concrete: name pages by their slug, propose specific section changes, and give copy that could ship.",
  "Reply with a single JSON object and nothing else, matching this TypeScript type:",
  "{ summary: string; pageChanges: { page: string; change: string; why: string }[]; heroCopy: { headline: string; subheadline: string; cta: string }; contentIdeas: string[]; risks: string[] }",
  "Keep pageChanges to the 3-6 most valuable changes, contentIdeas to 5, risks to 3.",
].join("\n");

export function buildReviewRequest(plan: SitePlan, options: { model?: string; language?: ReviewLanguage; context?: string } = {}) {
  const language = options.language ?? "en";
  const languageLine =
    language === "zh-TW"
      ? "Write every string value in Traditional Chinese (Taiwan usage). Keep JSON keys and page slugs in English."
      : "Write every string value in English.";

  const extra = options.context?.trim();
  const user = [
    "Here is the site plan to review:",
    "",
    planToMarkdown(plan),
    ...(extra ? ["", "Additional context from the client:", extra.slice(0, 4000)] : []),
    "",
    languageLine,
  ].join("\n");

  return {
    model: options.model || DEFAULT_CLAUDE_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: user }],
  };
}

/** Pulls the first JSON object out of the reply and checks its shape. */
export function parseReview(text: string): PlanReview {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ClaudeError("Claude's reply did not contain JSON.");

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new ClaudeError("Claude's reply was not valid JSON.");
  }

  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" ? value : "");
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  const hero = (obj.heroCopy ?? {}) as Record<string, unknown>;

  return {
    summary: str(obj.summary),
    pageChanges: (Array.isArray(obj.pageChanges) ? obj.pageChanges : [])
      .map((item) => (item ?? {}) as Record<string, unknown>)
      .map((item) => ({ page: str(item.page), change: str(item.change), why: str(item.why) }))
      .filter((item) => item.change),
    heroCopy: { headline: str(hero.headline), subheadline: str(hero.subheadline), cta: str(hero.cta) },
    contentIdeas: strings(obj.contentIdeas),
    risks: strings(obj.risks),
  };
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function requestPlanReview({
  apiKey,
  plan,
  model,
  language,
  context,
  fetchImpl = fetch,
  signal,
}: {
  apiKey: string;
  plan: SitePlan;
  model?: string;
  language?: ReviewLanguage;
  context?: string;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<PlanReview> {
  const key = apiKey.trim();
  if (!key.startsWith("sk-ant-")) throw new ClaudeError("That does not look like an Anthropic API key (it should start with sk-ant-).");

  let response: Response;
  try {
    response = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        // Required for calls made from a browser. Acceptable here because the
        // key is the visitor's own and stays in their browser.
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(buildReviewRequest(plan, { model, language, context })),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ClaudeError("Could not reach api.anthropic.com. Check your connection.");
  }

  const payload = (await response.json().catch(() => null)) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    error?: { message?: string };
  } | null;

  if (!response.ok) {
    const detail = payload?.error?.message;
    if (response.status === 401) throw new ClaudeError("Anthropic rejected the API key.", 401);
    if (response.status === 429) throw new ClaudeError("Rate limited by the Anthropic API. Try again shortly.", 429);
    throw new ClaudeError(`The Anthropic API returned HTTP ${response.status}${detail ? `: ${detail}` : "."}`, response.status);
  }

  if (payload?.stop_reason === "refusal") throw new ClaudeError("Claude declined to review this plan.");

  const text = (payload?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (payload?.stop_reason === "max_tokens" && !text.includes("}")) {
    throw new ClaudeError("Claude's reply was cut off. Try again.");
  }

  return parseReview(text);
}
