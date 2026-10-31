import { describe, expect, it, vi } from "vitest";

import { SAMPLE_CASES, matchCases } from "@/lib/planner/cases";
import { ClaudeError, buildReviewRequest, parseReview, requestPlanReview } from "@/lib/planner/claude";
import { INDUSTRIES, SECTION_LABELS, resolveIndustry } from "@/lib/planner/industries";
import {
  NotionError,
  fetchNotionCases,
  isPlausibleNotionToken,
  notionPageToCase,
  parseNotionDatabaseId,
  type NotionPage,
} from "@/lib/planner/notion";
import { UnknownIndustryError, buildSitePlan, planToMarkdown } from "@/lib/planner/plan";
import type { SectionKind, SiteBrief, SiteCase } from "@/lib/planner/types";
import { renderWireframe } from "@/lib/planner/wireframe";

const brief = (overrides: Partial<SiteBrief> = {}): SiteBrief => ({
  industry: "saas",
  goals: [],
  scale: "medium",
  features: [],
  styleTags: [],
  ...overrides,
});

const slugs = (b: SiteBrief) => buildSitePlan(b).pages.map((page) => page.slug);

describe("buildSitePlan", () => {
  it.each(INDUSTRIES.map((industry) => industry.id))("builds a sane plan for %s at every scale", (industry) => {
    for (const scale of ["landing", "small", "medium", "large"] as const) {
      const plan = buildSitePlan(brief({ industry, scale }));
      expect(plan.pages[0].slug).toBe("home");
      expect(new Set(plan.pages.map((page) => page.slug)).size).toBe(plan.pages.length);
      for (const page of plan.pages) {
        expect(page.sections[0]).toBe("nav");
        expect(page.sections.at(-1)).toBe("footer");
      }
      // A child always comes after its parent.
      plan.pages.forEach((page, index) => {
        if (page.parent) {
          const parentIndex = plan.pages.findIndex((candidate) => candidate.slug === page.parent);
          expect(parentIndex).toBeGreaterThanOrEqual(0);
          expect(parentIndex).toBeLessThan(index);
        }
      });
    }
  });

  it("grows monotonically from small to large", () => {
    for (const industry of INDUSTRIES) {
      const small = slugs(brief({ industry: industry.id, scale: "small" }));
      const medium = slugs(brief({ industry: industry.id, scale: "medium" }));
      const large = slugs(brief({ industry: industry.id, scale: "large" }));
      expect(medium).toEqual(expect.arrayContaining(small));
      expect(large).toEqual(expect.arrayContaining(medium));
      expect(large.length).toBeGreaterThanOrEqual(medium.length);
    }
  });

  it("folds a landing page into a single page that ends on the conversion", () => {
    const plan = buildSitePlan(brief({ industry: "ecommerce", scale: "landing", features: ["newsletter"] }));
    expect(plan.pages).toHaveLength(1);
    const body = plan.pages[0].sections.slice(1, -1);
    expect(body).not.toContain("cart");
    expect(body).not.toContain("product-detail");
    expect(body.slice(-2)).toEqual(["cta", "newsletter"]);
    expect(new Set(body).size).toBe(body.length);
  });

  it("defaults to the industry's first goal when none are chosen", () => {
    expect(buildSitePlan(brief({ industry: "restaurant" })).goals).toEqual(["bookings"]);
  });

  it("adds shop pages for the shop feature, with product nested under shop", () => {
    const plan = buildSitePlan(brief({ industry: "corporate", features: ["shop"] }));
    const product = plan.pages.find((page) => page.slug === "product");
    expect(product?.parent).toBe("shop");
    expect(product?.depth).toBe(1);
    expect(plan.pages.find((page) => page.slug === "cart")?.addedBy).toBe("Online shop");
  });

  it("does not add a booking page when the template already has a booking section", () => {
    expect(slugs(brief({ industry: "restaurant", features: ["booking"] }))).not.toContain("book");
    expect(slugs(brief({ industry: "corporate", features: ["booking"] }))).toContain("book");
  });

  it("adds a blog with an article page beneath it", () => {
    const plan = buildSitePlan(brief({ features: ["blog"] }));
    expect(plan.pages.find((page) => page.slug === "article")?.parent).toBe("blog");
  });

  it("points the header button at the page that serves the primary goal", () => {
    expect(buildSitePlan(brief({ industry: "nonprofit", goals: ["donations"] })).navigation.cta).toEqual({ label: "Donate", target: "donate" });
    expect(buildSitePlan(brief({ industry: "restaurant", goals: ["bookings"] })).navigation.cta.target).toBe("reservations");
    expect(buildSitePlan(brief({ industry: "portfolio", goals: ["leads"] })).navigation.cta.target).toBe("contact");
  });

  it("keeps utility pages out of the header navigation", () => {
    const plan = buildSitePlan(brief({ industry: "ecommerce", scale: "large" }));
    expect(plan.navigation.primary).not.toContain("cart");
    expect(plan.navigation.primary).not.toContain("account");
    expect(plan.navigation.primary.length).toBeLessThanOrEqual(6);
  });

  it("adds feature advice and warns about competing goals", () => {
    const plan = buildSitePlan(brief({ features: ["multilingual"], goals: ["leads", "sales", "signups"] }));
    expect(plan.recommendations.some((tip) => tip.includes("hreflang"))).toBe(true);
    expect(plan.recommendations.some((tip) => tip.startsWith("Several goals"))).toBe(true);
  });

  it("rejects an unknown industry", () => {
    expect(() => buildSitePlan(brief({ industry: "casino" as never }))).toThrow(UnknownIndustryError);
  });

  it("exports Markdown with the sitemap, navigation and KPIs", () => {
    const md = planToMarkdown(buildSitePlan(brief({ name: "Acme" })));
    expect(md).toMatch(/^# Acme: site plan/);
    expect(md).toContain("## Sitemap");
    expect(md).toContain("**Pricing** `/pricing`");
    expect(md).toContain("## KPIs");
  });
});

describe("renderWireframe", () => {
  const allKinds = Object.keys(SECTION_LABELS) as SectionKind[];

  it.each(["desktop", "mobile"] as const)("draws every section kind at %s width", (viewport) => {
    const { svg, width, height } = renderWireframe({ title: "All", sections: allKinds }, { viewport });
    expect(width).toBe(viewport === "desktop" ? 1200 : 390);
    expect(height).toBeGreaterThan(allKinds.length * 50);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    for (const kind of allKinds) expect(svg).toContain(`data-section="${kind}"`);
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  it("escapes the brand and title", () => {
    const { svg } = renderWireframe({ title: `"><script>`, sections: ["nav"] }, { brand: "<b>&co" });
    expect(svg).not.toContain("<script>");
    expect(svg).not.toContain("<b>");
    expect(svg).toContain("&lt;b&gt;&amp;co");
  });

  it("can hide section labels", () => {
    const labelled = renderWireframe({ title: "x", sections: ["hero"] }).svg;
    const bare = renderWireframe({ title: "x", sections: ["hero"] }, { labels: false }).svg;
    expect(labelled).toContain("HERO");
    expect(bare).not.toContain("HERO");
  });
});

describe("resolveIndustry", () => {
  it("accepts ids, English names, Chinese names and synonyms", () => {
    expect(resolveIndustry("saas")).toBe("saas");
    expect(resolveIndustry("Real estate")).toBe("real-estate");
    expect(resolveIndustry("醫療診所")).toBe("healthcare");
    expect(resolveIndustry(" 餐廳 ")).toBe("restaurant");
    expect(resolveIndustry("NGO")).toBe("nonprofit");
  });

  it("returns undefined for unknown or empty labels", () => {
    expect(resolveIndustry("")).toBeUndefined();
    expect(resolveIndustry("aerospace")).toBeUndefined();
  });
});

describe("matchCases", () => {
  it("ranks same-industry cases first and explains why", () => {
    const matches = matchCases(brief({ industry: "saas" }), SAMPLE_CASES);
    expect(matches[0].case.industry).toBe("saas");
    expect(matches[0].reasons[0]).toMatch(/Same industry/);
  });

  it("rewards shared features and requested styles", () => {
    const cases: SiteCase[] = [
      { id: "a", name: "A", url: "https://a.test", industry: "ecommerce", styleTags: [], features: [], source: "sample" },
      { id: "b", name: "B", url: "https://b.test", industry: "ecommerce", styleTags: ["Minimal"], features: ["search"], source: "sample" },
    ];
    const [first, second] = matchCases(brief({ industry: "ecommerce", features: ["search"], styleTags: ["minimal"] }), cases);
    expect(first.case.id).toBe("b");
    expect(first.score).toBeGreaterThan(second.score);
    expect(first.reasons.join(" ")).toContain("Matches your style: Minimal");
  });

  it("hides unrelated cases and caps the result count", () => {
    const unrelated: SiteCase = { id: "x", name: "X", url: "https://x.test", industry: "mining", styleTags: [], features: [], source: "notion" };
    expect(matchCases(brief(), [unrelated])).toEqual([]);
    expect(matchCases(brief(), SAMPLE_CASES, { limit: 2 })).toHaveLength(2);
  });
});

describe("Notion parsing", () => {
  const id = "0123456789abcdef0123456789abcdef";
  const dashed = "01234567-89ab-cdef-0123-456789abcdef";

  it.each([
    [id, dashed],
    [dashed, dashed],
    [`https://www.notion.so/team/Cases-${id}?v=ffffffffffffffffffffffffffffffff`, dashed],
    [`https://www.notion.so/${id}`, dashed],
    ["not an id", null],
    ["", null],
    ["https://", null],
  ])("parses database id from %s", (input, expected) => {
    expect(parseNotionDatabaseId(input)).toBe(expected);
  });

  it("recognises token shapes", () => {
    expect(isPlausibleNotionToken("ntn_" + "a".repeat(40))).toBe(true);
    expect(isPlausibleNotionToken("secret_" + "a".repeat(40))).toBe(true);
    expect(isPlausibleNotionToken("sk-ant-123")).toBe(false);
  });

  const row = (props: Record<string, unknown>) => ({ id: "row", properties: props }) as NotionPage;

  it("reads a row with Chinese column names", () => {
    const parsed = notionPageToCase(
      row({
        名稱: { type: "title", title: [{ plain_text: "好吃" }, { plain_text: "餐廳" }] },
        網址: { type: "url", url: "example.com" },
        產業: { type: "select", select: { name: "餐飲" } },
        風格: { type: "multi_select", multi_select: [{ name: "warm" }, { name: "photographic" }] },
        功能: { type: "rich_text", rich_text: [{ plain_text: "booking, 外送" }] },
        截圖: { type: "files", files: [{ type: "external", external: { url: "https://img.test/a.png" } }] },
      }),
    );
    expect(parsed).toMatchObject({
      name: "好吃餐廳",
      url: "https://example.com/",
      industry: "餐飲",
      styleTags: ["warm", "photographic"],
      features: ["booking", "外送"],
      image: "https://img.test/a.png",
      source: "notion",
    });
    expect(resolveIndustry(parsed!.industry)).toBe("restaurant");
  });

  it("skips rows without a name or a safe URL", () => {
    expect(notionPageToCase(row({ Name: { type: "title", title: [] }, URL: { type: "url", url: "https://a.test" } }))).toBeNull();
    expect(notionPageToCase(row({ Name: { type: "title", title: [{ plain_text: "A" }] }, URL: { type: "url", url: "javascript:alert(1)" } }))).toBeNull();
  });
});

describe("fetchNotionCases", () => {
  const token = "ntn_" + "x".repeat(40);
  const page = (name: string) => ({
    id: name,
    properties: { Name: { type: "title", title: [{ plain_text: name }] }, URL: { type: "url", url: `https://${name}.test` } },
  });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("follows cursors and only ever calls api.notion.com", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ results: [page("a"), { properties: {} }], has_more: true, next_cursor: "c2" }))
      .mockResolvedValueOnce(json({ results: [page("b")], has_more: false, next_cursor: null }));

    const result = await fetchNotionCases({ token, databaseId: "https://evil.test/../" + "a".repeat(32), fetchImpl });
    expect(result.cases.map((entry) => entry.name)).toEqual(["a", "b"]);
    expect(result.skipped).toBe(1);
    expect(result.truncated).toBe(false);
    for (const [url] of fetchImpl.mock.calls) {
      expect(url).toBe("https://api.notion.com/v1/databases/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/query");
    }
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ page_size: 100, start_cursor: "c2" });
  });

  it("turns a 404 into advice about sharing the database", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ message: "nope" }, 404));
    await expect(fetchNotionCases({ token, databaseId: "a".repeat(32), fetchImpl })).rejects.toThrow(/Connections/);
  });

  it("reports network failures and timeouts as gateway errors", async () => {
    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(fetchNotionCases({ token, databaseId: "a".repeat(32), fetchImpl: offline })).rejects.toMatchObject({ status: 502 });
    const slow = vi.fn().mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    await expect(fetchNotionCases({ token, databaseId: "a".repeat(32), fetchImpl: slow })).rejects.toMatchObject({ status: 504 });
  });

  it("refuses bad input before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchNotionCases({ token, databaseId: "nope", fetchImpl })).rejects.toBeInstanceOf(NotionError);
    await expect(fetchNotionCases({ token: "bad", databaseId: "a".repeat(32), fetchImpl })).rejects.toBeInstanceOf(NotionError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Claude review", () => {
  const plan = buildSitePlan(brief({ name: "Acme" }));

  it("builds a request that carries the plan and the language", () => {
    const request = buildReviewRequest(plan, { language: "zh-TW", context: "B2B only" });
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.messages[0].content).toContain("# Acme: site plan");
    expect(request.messages[0].content).toContain("Traditional Chinese");
    expect(request.messages[0].content).toContain("B2B only");
  });

  it("parses JSON wrapped in prose and drops malformed entries", () => {
    const review = parseReview(
      'Sure:\n```json\n{"summary":"ok","pageChanges":[{"page":"home","change":"Add logos","why":"trust"},{"page":"x"}],"heroCopy":{"headline":"H"},"contentIdeas":["a",2],"risks":[]}\n```',
    );
    expect(review.summary).toBe("ok");
    expect(review.pageChanges).toEqual([{ page: "home", change: "Add logos", why: "trust" }]);
    expect(review.heroCopy).toEqual({ headline: "H", subheadline: "", cta: "" });
    expect(review.contentIdeas).toEqual(["a"]);
  });

  it("rejects replies without JSON", () => {
    expect(() => parseReview("no json here")).toThrow(ClaudeError);
    expect(() => parseReview("{ broken")).toThrow(ClaudeError);
  });

  it("sends the browser-access header and surfaces auth failures", async () => {
    const ok = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: "text", text: '{"summary":"fine"}' }], stop_reason: "end_turn" }), { status: 200 }),
    );
    const review = await requestPlanReview({ apiKey: "sk-ant-test", plan, fetchImpl: ok });
    expect(review.summary).toBe("fine");
    const headers = ok.mock.calls[0][1].headers;
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["x-api-key"]).toBe("sk-ant-test");

    const denied = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "bad" } }), { status: 401 }));
    await expect(requestPlanReview({ apiKey: "sk-ant-test", plan, fetchImpl: denied })).rejects.toThrow(/rejected the API key/);
  });

  it("refuses a key that is obviously not an Anthropic key", async () => {
    const fetchImpl = vi.fn();
    await expect(requestPlanReview({ apiKey: "ntn_abc", plan, fetchImpl })).rejects.toThrow(/sk-ant-/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
