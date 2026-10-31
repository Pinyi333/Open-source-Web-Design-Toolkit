/**
 * Optional: let Claude pick the options, with the visitor's own API key.
 *
 * The builder and its rule-based one-click match work without this. When a
 * visitor opts in, Claude sees the keyword and the full option catalogue and
 * answers with option ids plus a scene description. Ids it invents are
 * dropped, so the result always maps back onto the same chips the visitor
 * can see and edit.
 */

import { DEFAULT_CLAUDE_MODEL, callClaude, extractJsonObject, type MessagesRequest } from "../ai/anthropic";
import { GROUP_ORDER, OPTION_GROUPS } from "./options";
import type { OptionGroup, PromptLanguage, PromptSelection } from "./types";

export interface ClaudeMatch {
  selection: PromptSelection;
  rationale: string;
}

function catalogue(): string {
  return GROUP_ORDER.map((group) => {
    const ids = OPTION_GROUPS[group].map((option) => `${option.id} (${option.en})`).join(", ");
    return `${group}: ${ids}`;
  }).join("\n");
}

export function buildMatchRequest(
  keyword: string,
  options: { model?: string; language?: PromptLanguage; current?: Partial<PromptSelection>; locked?: OptionGroup[] } = {},
): MessagesRequest {
  const language = options.language ?? "en";
  const locked = (options.locked ?? []).filter((group) => options.current?.[group]);

  const system = [
    "You are an art director choosing a visual direction for website imagery.",
    "Given a keyword, pick exactly one option id per group from the catalogue below so the choices work together for that subject.",
    "Then write `scene`: one or two sentences describing a specific, photographable or drawable scene for the keyword (subject, setting, props, action). Do not repeat the style, palette or lighting words in it.",
    "Write `rationale` in Traditional Chinese (Taiwan usage), one or two sentences explaining the direction.",
    "Reply with a single JSON object and nothing else:",
    '{ "industry": string, "palette": string, "style": string, "mood": string, "shot": string, "lighting": string, "ratio": string, "scene": string, "rationale": string }',
    "",
    "Catalogue (group: id (label), ...):",
    catalogue(),
  ].join("\n");

  const lockedLines = locked.map((group) => `- ${group} must stay "${options.current![group]}"`);
  const user = [
    `Keyword: ${keyword.trim().slice(0, 500) || "(none: suggest something striking for a modern website hero)"}`,
    ...(lockedLines.length ? ["The visitor has fixed these choices:", ...lockedLines] : []),
    language === "zh-TW" ? "Write `scene` in Traditional Chinese." : "Write `scene` in English.",
  ].join("\n");

  return {
    model: options.model || DEFAULT_CLAUDE_MODEL,
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: user }],
  };
}

/** Validates Claude's reply against the catalogue. Unknown ids become undefined. */
export function parseMatch(text: string, keyword: string): ClaudeMatch {
  const raw = extractJsonObject(text);
  const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
  const valid = (group: OptionGroup) => {
    const id = str(raw[group]);
    return OPTION_GROUPS[group].some((option) => option.id === id) ? id : undefined;
  };

  return {
    selection: {
      keyword,
      industry: valid("industry"),
      palette: valid("palette"),
      style: valid("style"),
      mood: valid("mood"),
      shot: valid("shot"),
      lighting: valid("lighting"),
      ratio: valid("ratio"),
      scene: str(raw.scene).slice(0, 600) || undefined,
    },
    rationale: str(raw.rationale),
  };
}

export async function requestClaudeMatch({
  apiKey,
  keyword,
  model,
  language,
  current,
  locked,
  fetchImpl,
  signal,
}: {
  apiKey: string;
  keyword: string;
  model?: string;
  language?: PromptLanguage;
  current?: Partial<PromptSelection>;
  locked?: OptionGroup[];
  fetchImpl?: (input: string, init?: RequestInit) => Promise<Response>;
  signal?: AbortSignal;
}): Promise<ClaudeMatch> {
  const text = await callClaude({
    apiKey,
    body: buildMatchRequest(keyword, { model, language, current, locked }),
    fetchImpl,
    signal,
  });
  const match = parseMatch(text, keyword);
  // Locked groups win even if Claude ignored the instruction.
  for (const group of locked ?? []) {
    if (current?.[group]) match.selection[group] = current[group];
  }
  return match;
}
