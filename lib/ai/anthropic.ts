/**
 * A minimal Anthropic Messages API client for bring-your-own-key features.
 *
 * The request goes straight from the visitor's browser to api.anthropic.com
 * with the visitor's own key, so the key never touches the server running
 * this app and the project ships no credentials of its own.
 *
 * Plain fetch rather than the Anthropic SDK, because the web app keeps its
 * runtime dependencies to next/react/react-dom (see CLAUDE.md).
 */

export const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
export const ANTHROPIC_VERSION = "2023-06-01";

export const CLAUDE_MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest)" },
] as const;

export const DEFAULT_CLAUDE_MODEL: string = CLAUDE_MODELS[0].id;

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface MessagesRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function looksLikeAnthropicKey(key: string): boolean {
  return key.trim().startsWith("sk-ant-");
}

/** Sends one request and returns the concatenated text of the reply. */
export async function callClaude({
  apiKey,
  body,
  fetchImpl = fetch,
  signal,
}: {
  apiKey: string;
  body: MessagesRequest;
  fetchImpl?: FetchLike;
  signal?: AbortSignal;
}): Promise<string> {
  const key = apiKey.trim();
  if (!looksLikeAnthropicKey(key)) {
    throw new ClaudeError("That does not look like an Anthropic API key (it should start with sk-ant-).");
  }

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
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
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

  if (payload?.stop_reason === "refusal") throw new ClaudeError("Claude declined this request.");

  const text = (payload?.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");
  if (payload?.stop_reason === "max_tokens" && !text.includes("}")) {
    throw new ClaudeError("Claude's reply was cut off. Try again.");
  }
  return text;
}

/** Pulls the first-to-last brace span out of a reply and parses it. */
export function extractJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ClaudeError("Claude's reply did not contain JSON.");
  try {
    const value: unknown = JSON.parse(text.slice(start, end + 1));
    return (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  } catch {
    throw new ClaudeError("Claude's reply was not valid JSON.");
  }
}
