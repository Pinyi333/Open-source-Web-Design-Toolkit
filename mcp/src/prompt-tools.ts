/**
 * Image Prompt Builder tools: the same lib/prompt code the web page uses.
 *
 * This is the "bring your own Claude" path with no API key at all: an agent
 * running on your own subscription lists the options, picks ids itself (or
 * asks for the rule-based match), and gets back an assembled prompt.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildImagePrompt } from "../../lib/prompt/build";
import { autoMatch } from "../../lib/prompt/match";
import { GROUP_LABELS, GROUP_ORDER, OPTION_GROUPS } from "../../lib/prompt/options";
import type { OptionGroup, PromptSelection } from "../../lib/prompt/types";

const ids = (group: OptionGroup) => OPTION_GROUPS[group].map((option) => option.id) as [string, ...string[]];

const selectionShape = {
  keyword: z.string().max(500).describe("What the picture is of, in any language. May be empty."),
  scene: z.string().max(600).optional().describe("Extra scene detail: setting, props, action"),
  industry: z.enum(ids("industry")).optional(),
  palette: z.enum(ids("palette")).optional(),
  style: z.enum(ids("style")).optional(),
  mood: z.enum(ids("mood")).optional(),
  shot: z.enum(ids("shot")).optional(),
  lighting: z.enum(ids("lighting")).optional(),
  ratio: z.enum(ids("ratio")).optional(),
};

const outputShape = {
  format: z.enum(["natural", "midjourney", "sd"]).optional().describe("natural (default; Nano Banana, GPT Image, Flux…), midjourney, or sd (tags + negative)"),
  language: z.enum(["en", "zh-TW"]).optional().describe("Prompt language. Default en."),
};

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function registerPromptTools(server: McpServer) {
  server.registerTool(
    "list_image_prompt_options",
    {
      title: "List image prompt options",
      description:
        "List every option the image prompt builder knows, grouped by industry, palette, style, mood, shot, lighting and aspect ratio. " +
        "Use the ids with build_image_prompt.",
      inputSchema: {},
    },
    async () =>
      ok(
        Object.fromEntries(
          GROUP_ORDER.map((group) => [
            group,
            {
              label: GROUP_LABELS[group],
              options: OPTION_GROUPS[group].map((option) => ({ id: option.id, zh: option.zh, en: option.en, prompt: option.prompt })),
            },
          ]),
        ),
      ),
  );

  server.registerTool(
    "build_image_prompt",
    {
      title: "Build image prompt",
      description:
        "Assemble an image-generation prompt from a keyword and chosen option ids. Every option is optional. " +
        "Returns the prompt, a negative prompt and any extra settings (such as an SD image size).",
      inputSchema: { ...selectionShape, ...outputShape },
    },
    async ({ format, language, ...selection }) => ok(buildImagePrompt(selection as PromptSelection, { format, language })),
  );

  server.registerTool(
    "match_image_prompt",
    {
      title: "Match image prompt options",
      description:
        "Rule-based one-click match: guesses the industry from the keyword and fills the other groups with options that suit it. " +
        "Pass option ids plus `locked` to keep some choices fixed. Returns the selection, the reasons and the assembled prompt.",
      inputSchema: {
        ...selectionShape,
        ...outputShape,
        locked: z.array(z.enum(GROUP_ORDER as [OptionGroup, ...OptionGroup[]])).optional().describe("Groups to keep as given"),
        seed: z.number().int().optional().describe("Seed for a reproducible match"),
      },
    },
    async ({ format, language, locked, seed, ...current }) => {
      const result = autoMatch({ keyword: current.keyword, current, locked, seed });
      return ok({ ...result, built: buildImagePrompt(result.selection, { format, language }) });
    },
  );
}
