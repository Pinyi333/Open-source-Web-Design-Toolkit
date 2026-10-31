/**
 * Turns a brief (industry, goals, scale, features) into a site plan:
 * a sitemap with sections per page, navigation, KPIs and recommendations.
 *
 * Deterministic on purpose. The same brief always produces the same plan, so
 * the plan can be tested, diffed and handed to an LLM as a fixed starting
 * point rather than asking a model to invent an architecture from nothing.
 */

import { GOALS, SECTION_LABELS, getIndustry } from "./industries";
import type {
  GoalId,
  IndustryTemplate,
  PagePriority,
  PageTemplate,
  PlannedPage,
  SectionKind,
  SiteBrief,
  SitePlan,
} from "./types";

/** A landing page stops growing past this many sections between nav and footer. */
const LANDING_MAX_SECTIONS = 10;
/** Header navigation gets crowded past this. */
const PRIMARY_NAV_MAX = 6;

interface Draft extends PageTemplate {
  addedBy?: string;
}

const PRIORITY_KEEP: Record<SitePlan["brief"]["scale"], PagePriority[]> = {
  landing: ["core"],
  small: ["core"],
  medium: ["core", "recommended"],
  large: ["core", "recommended", "optional"],
};

export class UnknownIndustryError extends Error {}

export function buildSitePlan(brief: SiteBrief): SitePlan {
  const industry = getIndustry(brief.industry);
  if (!industry) {
    throw new UnknownIndustryError(`Unknown industry "${brief.industry}".`);
  }

  const goals: GoalId[] = brief.goals.length > 0 ? unique(brief.goals) : [industry.goals[0]];
  const keep = PRIORITY_KEEP[brief.scale];

  let drafts: Draft[] = industry.pages
    .filter((page) => keep.includes(page.priority))
    .map((page) => ({ ...page, sections: [...page.sections] }));

  drafts = applyFeatures(drafts, brief, goals);

  if (brief.scale === "landing") {
    drafts = [collapseToLanding(drafts)];
  }

  const pages = toSitemapOrder(drafts);

  return {
    brief: { ...brief, goals, features: unique(brief.features), styleTags: unique(brief.styleTags) },
    industry,
    goals,
    pages,
    navigation: buildNavigation(pages, goals),
    kpis: unique([...industry.kpis, ...goals.flatMap((goal) => GOAL_KPIS[goal])]),
    recommendations: buildRecommendations(industry, brief, goals),
  };
}

// --- additions from goals and features ------------------------------------

function hasSection(drafts: Draft[], kinds: SectionKind[]): boolean {
  return drafts.some((page) => page.sections.some((section) => kinds.includes(section)));
}

function addPage(drafts: Draft[], page: Draft): void {
  if (drafts.some((existing) => existing.slug === page.slug)) return;
  drafts.push(page);
}

function ensureHomeSection(drafts: Draft[], kind: SectionKind): void {
  const home = drafts.find((page) => page.slug === "home");
  if (home && !home.sections.includes(kind)) home.sections.push(kind);
}

function applyFeatures(drafts: Draft[], brief: SiteBrief, goals: GoalId[]): Draft[] {
  const out = [...drafts];
  const features = new Set(brief.features);

  if (features.has("shop") || (goals.includes("sales") && !hasSection(out, ["cart", "pricing"]))) {
    const addedBy = features.has("shop") ? "Online shop" : "Goal: sell online";
    addPage(out, { slug: "shop", title: "Shop", purpose: "Browse and buy online.", priority: "core", sections: ["search", "product-grid"], addedBy });
    addPage(out, { slug: "product", title: "Product detail", purpose: "Everything needed to add to cart.", priority: "core", parent: "shop", sections: ["product-detail", "testimonials"], addedBy });
    addPage(out, { slug: "cart", title: "Cart & checkout", purpose: "Finish the purchase.", priority: "core", sections: ["cart"], addedBy });
  }

  if ((features.has("booking") || goals.includes("bookings")) && !hasSection(out, ["booking"])) {
    addPage(out, {
      slug: "book",
      title: "Book now",
      purpose: "Pick a time and confirm.",
      priority: "core",
      sections: ["booking", "faq"],
      addedBy: features.has("booking") ? "Online booking" : "Goal: take bookings",
    });
  }

  if (goals.includes("leads") && !hasSection(out, ["form"])) {
    addPage(out, { slug: "contact", title: "Contact", purpose: "Turn interest into an enquiry.", priority: "core", sections: ["form", "map"], addedBy: "Goal: generate enquiries" });
  }

  if (goals.includes("signups") && !hasSection(out, ["form", "pricing"])) {
    addPage(out, { slug: "sign-up", title: "Sign up", purpose: "Create an account or join.", priority: "core", sections: ["form", "faq"], addedBy: "Goal: get sign-ups" });
  }

  if (goals.includes("recruitment")) {
    addPage(out, { slug: "careers", title: "Careers", purpose: "Open roles and why join.", priority: "recommended", sections: ["hero", "features", "list", "cta"], addedBy: "Goal: recruit people" });
  }

  if (goals.includes("donations")) {
    addPage(out, { slug: "donate", title: "Donate", purpose: "Give once or monthly in a few taps.", priority: "core", sections: ["stats", "form", "faq"], addedBy: "Goal: raise donations" });
  }

  if (features.has("blog")) {
    addPage(out, { slug: "blog", title: "Blog", purpose: "Articles that answer customer questions.", priority: "recommended", sections: ["list", "newsletter"], addedBy: "Blog / articles" });
    addPage(out, { slug: "article", title: "Article", purpose: "One readable post with a next step.", priority: "recommended", parent: "blog", sections: ["article", "cta"], addedBy: "Blog / articles" });
  }

  if (features.has("membership")) {
    addPage(out, { slug: "account", title: "Account", purpose: "Sign in, profile and history.", priority: "recommended", sections: ["form", "list"], addedBy: "Member accounts" });
  }

  if (features.has("search")) {
    addPage(out, { slug: "search", title: "Search results", purpose: "Find anything on the site.", priority: "optional", sections: ["search", "list"], addedBy: "Site search" });
  }

  if (features.has("newsletter")) ensureHomeSection(out, "newsletter");

  return out;
}

/** Folds every page's distinctive sections into one long home page. */
function collapseToLanding(drafts: Draft[]): Draft {
  const home = drafts.find((page) => page.slug === "home") ?? drafts[0];
  const sections: SectionKind[] = [];

  const push = (kind: SectionKind) => {
    if (kind === "cart" || kind === "product-detail") return; // never on a landing page
    if (!sections.includes(kind)) sections.push(kind);
  };

  home.sections.filter((kind) => kind !== "cta" && kind !== "newsletter").forEach(push);
  for (const page of drafts) {
    if (page === home) continue;
    page.sections.forEach(push);
  }

  // The close of a landing page is always the conversion, then the sign-up.
  const trimmed: SectionKind[] = sections
    .filter((kind) => kind !== "cta" && kind !== "newsletter")
    .slice(0, LANDING_MAX_SECTIONS - 1);
  trimmed.push("cta");
  if (home.sections.includes("newsletter")) trimmed.push("newsletter");

  return {
    ...home,
    title: "Landing page",
    purpose: "One page that takes a visitor from first impression to the main action.",
    sections: trimmed,
  };
}

/** Parents first, each followed by its children; orphans become top-level. */
function toSitemapOrder(drafts: Draft[]): PlannedPage[] {
  const slugs = new Set(drafts.map((page) => page.slug));
  const topLevel = drafts.filter((page) => !page.parent || !slugs.has(page.parent));
  // Home always first.
  topLevel.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : 0));

  const out: PlannedPage[] = [];
  const visit = (page: Draft, depth: number) => {
    out.push({
      slug: page.slug,
      title: page.title,
      purpose: page.purpose,
      priority: page.priority,
      sections: ["nav", ...page.sections, "footer"],
      depth,
      ...(depth > 0 && page.parent ? { parent: page.parent } : {}),
      ...(page.addedBy ? { addedBy: page.addedBy } : {}),
    });
    for (const child of drafts) {
      if (child.parent === page.slug) visit(child, depth + 1);
    }
  };

  topLevel.forEach((page) => visit(page, 0));
  return out;
}

// --- navigation, KPIs, advice ----------------------------------------------

const UTILITY_PAGES = new Set(["cart", "account", "search", "student-portal"]);

const GOAL_TARGET_SECTIONS: Record<GoalId, SectionKind[]> = {
  bookings: ["booking"],
  sales: ["cart", "pricing", "product-grid"],
  leads: ["form"],
  signups: ["form", "pricing"],
  donations: ["form"],
  recruitment: ["list"],
  awareness: [],
};

function buildNavigation(pages: PlannedPage[], goals: GoalId[]): SitePlan["navigation"] {
  const topLevel = pages.filter((page) => page.depth === 0 && page.slug !== "home");
  const primaryCandidates = topLevel.filter(
    (page) => !UTILITY_PAGES.has(page.slug) && page.priority !== "optional",
  );
  const primary = primaryCandidates.slice(0, PRIMARY_NAV_MAX).map((page) => page.slug);
  const footer = topLevel
    .map((page) => page.slug)
    .filter((slug) => !primary.includes(slug) && slug !== "cart");

  const goal = goals[0];
  const goalInfo = GOALS.find((entry) => entry.id === goal);
  const label = goalInfo?.cta ?? "Get in touch";

  // Prefer a dedicated page for the goal (donate, careers...), then any page
  // holding the section the goal needs, then home.
  const dedicated: Partial<Record<GoalId, string>> = { donations: "donate", recruitment: "careers" };
  const wanted = GOAL_TARGET_SECTIONS[goal] ?? [];
  const target =
    pages.find((page) => page.slug === dedicated[goal])?.slug ??
    pages.find((page) => page.slug !== "home" && page.sections.some((kind) => wanted.includes(kind)))?.slug ??
    "home";

  return { primary, footer, cta: { label, target } };
}

const GOAL_KPIS: Record<GoalId, string[]> = {
  leads: ["Form submissions", "Lead-to-customer rate"],
  sales: ["Revenue per visitor"],
  bookings: ["Booking completion rate"],
  awareness: ["Organic search traffic", "Returning visitors"],
  signups: ["Sign-up conversion rate"],
  recruitment: ["Applications per open role"],
  donations: ["Average gift", "Recurring donor share"],
};

const FEATURE_ADVICE: Partial<Record<string, string>> = {
  multilingual:
    "Multiple languages: give each language its own URL (/en/, /zh-tw/) with hreflang tags, and put the switcher in the header and footer. Never auto-redirect by IP.",
  "live-chat":
    "Live chat: load the widget after the page is interactive, and staff it during the hours the site gets traffic. An unanswered chat is worse than none.",
  search: "Site search: log searches with no results; they are a free list of missing content.",
  booking: "Online booking: confirm by email immediately and send a reminder; no-shows fall sharply.",
  shop: "Online shop: plan product data (variants, sizes, stock) before the design; templates depend on it.",
  membership: "Member accounts: allow guest checkout or browsing anyway; forced sign-up loses people.",
  newsletter: "Newsletter: say what subscribers get and how often, next to the field.",
  blog: "Blog: plan at least a dozen posts before launch, mapped to real customer questions.",
};

function buildRecommendations(industry: IndustryTemplate, brief: SiteBrief, goals: GoalId[]): string[] {
  const out = [...industry.tips];

  for (const feature of unique(brief.features)) {
    const advice = FEATURE_ADVICE[feature];
    if (advice) out.push(advice);
  }

  if (brief.scale === "landing") {
    out.push("Landing page: one goal, one primary button repeated down the page, and no navigation that leads away from it.");
  }

  const goalLabels = goals.map((goal) => GOALS.find((entry) => entry.id === goal)?.label ?? goal);
  if (goals.length > 2) {
    out.push(`Several goals (${goalLabels.join(", ")}) compete for attention. Pick one primary action per page.`);
  }

  return out;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

// --- export ----------------------------------------------------------------

/** The plan as Markdown: readable on GitHub, pasteable into Notion or a chat with Claude. */
export function planToMarkdown(plan: SitePlan): string {
  const title = plan.brief.name?.trim() || `${plan.industry.name} website`;
  const goalLabels = plan.goals.map((goal) => GOALS.find((entry) => entry.id === goal)?.label ?? goal);
  const lines: string[] = [
    `# ${title}: site plan`,
    "",
    `- **Industry:** ${plan.industry.name} (${plan.industry.nameZh})`,
    `- **Goals:** ${goalLabels.join(", ")}`,
    `- **Scale:** ${plan.brief.scale}`,
    ...(plan.brief.features.length ? [`- **Features:** ${plan.brief.features.join(", ")}`] : []),
    ...(plan.brief.styleTags.length ? [`- **Style:** ${plan.brief.styleTags.join(", ")}`] : []),
    `- **Audiences:** ${plan.industry.audiences.join("; ")}`,
    "",
    "## Sitemap",
    "",
  ];

  for (const page of plan.pages) {
    const indent = "  ".repeat(page.depth);
    const body = page.sections.filter((kind) => kind !== "nav" && kind !== "footer");
    lines.push(`${indent}- **${page.title}** \`/${page.slug === "home" ? "" : page.slug}\` (${page.priority}): ${page.purpose}`);
    lines.push(`${indent}  - Sections: ${body.map((kind) => SECTION_LABELS[kind]).join(" → ")}`);
  }

  lines.push(
    "",
    "## Navigation",
    "",
    `- **Header:** ${plan.navigation.primary.join(", ") || "(none)"}`,
    `- **Header button:** "${plan.navigation.cta.label}" → /${plan.navigation.cta.target === "home" ? "" : plan.navigation.cta.target}`,
    `- **Footer:** ${plan.navigation.footer.join(", ") || "(none)"}`,
    "",
    "## KPIs",
    "",
    ...plan.kpis.map((kpi) => `- ${kpi}`),
    "",
    "## Recommendations",
    "",
    ...plan.recommendations.map((tip) => `- ${tip}`),
    "",
  );

  return lines.join("\n");
}
