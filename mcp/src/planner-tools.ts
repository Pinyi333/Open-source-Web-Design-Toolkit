/**
 * Site Planner tools: the same lib/planner code the web app's Site Planner
 * uses, exposed so an agent (your own Claude, on your own subscription) can
 * plan a site, draw wireframes and look up reference cases.
 */

import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { SAMPLE_CASES, matchCases } from "../../lib/planner/cases";
import { FEATURES, GOALS, INDUSTRIES, SCALES, SECTION_LABELS } from "../../lib/planner/industries";
import { NotionError, fetchNotionCases } from "../../lib/planner/notion";
import { buildSitePlan, planToMarkdown } from "../../lib/planner/plan";
import type { FeatureId, GoalId, IndustryId, SectionKind, SiteBrief, SiteScale } from "../../lib/planner/types";
import { renderWireframe } from "../../lib/planner/wireframe";

const INDUSTRY_IDS = INDUSTRIES.map((entry) => entry.id) as [IndustryId, ...IndustryId[]];
const GOAL_IDS = GOALS.map((entry) => entry.id) as [GoalId, ...GoalId[]];
const FEATURE_IDS = FEATURES.map((entry) => entry.id) as [FeatureId, ...FeatureId[]];
const SCALE_IDS = SCALES.map((entry) => entry.id) as [SiteScale, ...SiteScale[]];
const SECTION_IDS = Object.keys(SECTION_LABELS) as [SectionKind, ...SectionKind[]];

const briefShape = {
  industry: z.enum(INDUSTRY_IDS).describe("Industry template to start from"),
  name: z.string().max(80).optional().describe("Project name, used in headings and the wireframe nav"),
  goals: z.array(z.enum(GOAL_IDS)).optional().describe("Business goals, most important first. Omit to use the industry default."),
  scale: z.enum(SCALE_IDS).optional().describe("landing = one long page; small = core pages; medium = + recommended (default); large = everything"),
  features: z.array(z.enum(FEATURE_IDS)).optional().describe("Features the site needs"),
  style_tags: z.array(z.string().max(30)).max(12).optional().describe("Style words such as minimal, bold, editorial; used to rank cases"),
};

type BriefArgs = {
  industry: IndustryId;
  name?: string;
  goals?: GoalId[];
  scale?: SiteScale;
  features?: FeatureId[];
  style_tags?: string[];
};

function toBrief(args: BriefArgs): SiteBrief {
  return {
    industry: args.industry,
    name: args.name,
    goals: args.goals ?? [],
    scale: args.scale ?? "medium",
    features: args.features ?? [],
    styleTags: args.style_tags ?? [],
  };
}

function ok(payload: unknown) {
  return { content: [{ type: "text" as const, text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerPlannerTools(server: McpServer): void {
  server.registerTool(
    "list_industries",
    {
      title: "List Site Planner industries",
      description:
        "List the industry templates, goals, features, scales and section kinds the Site Planner understands, " +
        "with each industry's audiences, KPIs and typical style.",
      inputSchema: {},
    },
    async () =>
      ok({
        industries: INDUSTRIES.map(({ id, name, nameZh, summary, audiences, goals, suggestedFeatures, styleTags, kpis }) => ({
          id, name, nameZh, summary, audiences, goals, suggestedFeatures, styleTags, kpis,
        })),
        goals: GOALS,
        features: FEATURES,
        scales: SCALES,
        sections: SECTION_LABELS,
      }),
  );

  server.registerTool(
    "plan_site",
    {
      title: "Plan a website",
      description:
        "Build a site architecture from an industry template: a sitemap with the sections of every page, " +
        "header/footer navigation and the header button, KPIs and recommendations. Deterministic, so it is a " +
        "solid starting point to refine. Returns Markdown by default, or the full structured plan.",
      inputSchema: {
        ...briefShape,
        format: z.enum(["markdown", "json"]).optional().describe("markdown (default) or json"),
      },
    },
    async (args) => {
      try {
        const plan = buildSitePlan(toBrief(args));
        if (args.format === "json") {
          const { industry, ...rest } = plan;
          return ok({ ...rest, industry: { id: industry.id, name: industry.name, audiences: industry.audiences } });
        }
        return ok(planToMarkdown(plan));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
  );

  server.registerTool(
    "generate_wireframe",
    {
      title: "Generate a wireframe",
      description:
        "Draw a low-fidelity SVG wireframe of one page. Either give a brief and a page slug from plan_site, " +
        "or give your own list of sections. Returns the SVG markup, and writes it to output_path if given.",
      inputSchema: {
        ...briefShape,
        industry: z.enum(INDUSTRY_IDS).optional().describe("Industry template; needed unless sections is given"),
        page: z.string().optional().describe("Page slug from plan_site, e.g. home or pricing. Default home."),
        sections: z.array(z.enum(SECTION_IDS)).min(1).max(30).optional().describe("Draw these sections instead of a planned page; nav and footer are not added automatically"),
        viewport: z.enum(["desktop", "mobile"]).optional().describe("desktop (1200px, default) or mobile (390px)"),
        theme: z.enum(["light", "dark"]).optional(),
        labels: z.boolean().optional().describe("Label each section band (default true)"),
        output_path: z.string().optional().describe("Absolute path to write the .svg file to"),
      },
    },
    async (args) => {
      let title: string;
      let sections: SectionKind[];

      if (args.sections) {
        title = args.name || "Custom page";
        sections = args.sections;
      } else if (args.industry) {
        const plan = buildSitePlan(toBrief({ ...args, industry: args.industry }));
        const slug = args.page ?? "home";
        const page = plan.pages.find((entry) => entry.slug === slug);
        if (!page) {
          return fail(`No page "${slug}" in this plan. Pages: ${plan.pages.map((entry) => entry.slug).join(", ")}.`);
        }
        title = page.title;
        sections = page.sections;
      } else {
        return fail("Give an industry (and optionally a page slug), or a list of sections.");
      }

      const wireframe = renderWireframe({ title, sections }, { viewport: args.viewport, theme: args.theme, labels: args.labels, brand: args.name });

      if (args.output_path) {
        if (!isAbsolute(args.output_path) || !args.output_path.toLowerCase().endsWith(".svg")) {
          return fail("output_path must be an absolute path ending in .svg.");
        }
        try {
          await writeFile(args.output_path, wireframe.svg, "utf8");
        } catch (error) {
          return fail(`Could not write ${args.output_path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return ok({
        page: title,
        width: wireframe.width,
        height: wireframe.height,
        ...(args.output_path ? { written: args.output_path } : {}),
        svg: wireframe.svg,
      });
    },
  );

  server.registerTool(
    "match_cases",
    {
      title: "Find matching reference sites",
      description:
        "Rank reference websites against a brief by industry, features and style, with the reasons for each match. " +
        "Uses your Notion case library when NOTION_TOKEN and NOTION_CASES_DATABASE_ID are set in the server's " +
        "environment (or notion_database_id is passed), otherwise a built-in sample library.",
      inputSchema: {
        industry: briefShape.industry,
        features: briefShape.features,
        style_tags: briefShape.style_tags,
        limit: z.number().int().min(1).max(30).optional().describe("Maximum results (default 6)"),
        notion_database_id: z.string().optional().describe("Notion database id or link; overrides NOTION_CASES_DATABASE_ID"),
      },
    },
    async (args) => {
      const token = process.env.NOTION_TOKEN?.trim();
      const databaseId = args.notion_database_id?.trim() || process.env.NOTION_CASES_DATABASE_ID?.trim();
      let library = SAMPLE_CASES;
      let source = "sample library";
      const notes: string[] = [];

      if (databaseId && !token) {
        return fail("A Notion database was given but NOTION_TOKEN is not set in the MCP server's environment.");
      }
      if (token && databaseId) {
        try {
          const result = await fetchNotionCases({ token, databaseId });
          library = result.cases;
          source = "Notion";
          if (result.skipped) notes.push(`${result.skipped} Notion rows skipped (no name or URL).`);
          if (result.truncated) notes.push("Stopped at 500 Notion rows.");
        } catch (error) {
          return fail(error instanceof NotionError ? error.message : `Reading Notion failed: ${String(error)}`);
        }
      }

      const matches = matchCases(
        { industry: args.industry, features: args.features ?? [], styleTags: args.style_tags ?? [] },
        library,
        { limit: args.limit ?? 6 },
      );
      return ok({ source, librarySize: library.length, notes, matches });
    },
  );
}
