/**
 * Shared types for the Site Planner.
 *
 * Everything in lib/planner is pure: no DOM, no React, no network except the
 * two clearly-named request helpers (notion.ts, claude.ts) that take `fetch`
 * as a parameter so tests can stub it.
 */

/** A building block of a page. Each one has a wireframe recipe in wireframe.ts. */
export type SectionKind =
  | "nav"
  | "hero"
  | "logos"
  | "features"
  | "split"
  | "stats"
  | "gallery"
  | "product-grid"
  | "product-detail"
  | "menu"
  | "pricing"
  | "testimonials"
  | "team"
  | "timeline"
  | "list"
  | "article"
  | "faq"
  | "cta"
  | "form"
  | "booking"
  | "map"
  | "search"
  | "cart"
  | "newsletter"
  | "footer";

export type IndustryId =
  | "restaurant"
  | "ecommerce"
  | "saas"
  | "corporate"
  | "portfolio"
  | "healthcare"
  | "education"
  | "real-estate"
  | "nonprofit"
  | "events";

export type GoalId =
  | "leads"
  | "sales"
  | "bookings"
  | "awareness"
  | "signups"
  | "recruitment"
  | "donations";

export type FeatureId =
  | "blog"
  | "booking"
  | "shop"
  | "membership"
  | "search"
  | "multilingual"
  | "newsletter"
  | "live-chat";

/**
 * How big the site is meant to be. Drives which template pages survive:
 * a landing page folds everything into one long page.
 */
export type SiteScale = "landing" | "small" | "medium" | "large";

export type PagePriority = "core" | "recommended" | "optional";

/** A page as an industry template describes it. */
export interface PageTemplate {
  slug: string;
  title: string;
  /** One line: what this page has to achieve. */
  purpose: string;
  priority: PagePriority;
  /** Sections between the nav and the footer, top to bottom. */
  sections: SectionKind[];
  /** Slug of the parent page, for nesting in the sitemap. */
  parent?: string;
}

export interface IndustryTemplate {
  id: IndustryId;
  name: string;
  /** Traditional Chinese name, also accepted when matching Notion values. */
  nameZh: string;
  summary: string;
  /** Who the site is for, most important first. */
  audiences: string[];
  /** Goals that make sense for this industry, best first. */
  goals: GoalId[];
  /** Features usually worth having. */
  suggestedFeatures: FeatureId[];
  /** Style words that tend to fit. Used to rank cases. */
  styleTags: string[];
  /** What to measure. */
  kpis: string[];
  /** Industry-specific advice that is not obvious from the page list. */
  tips: string[];
  pages: PageTemplate[];
}

/** What the user tells the planner. */
export interface SiteBrief {
  industry: IndustryId;
  /** Optional project name, used in headings and exports. */
  name?: string;
  /** Empty means "use the industry's default goal". */
  goals: GoalId[];
  scale: SiteScale;
  features: FeatureId[];
  /** Preferred style words, e.g. "minimal", "bold". Used to rank cases. */
  styleTags: string[];
}

/** A page in a finished plan. */
export interface PlannedPage {
  slug: string;
  title: string;
  purpose: string;
  priority: PagePriority;
  /** Full section list including nav and footer. */
  sections: SectionKind[];
  /** 0 for top-level pages. */
  depth: number;
  parent?: string;
  /** Why this page is here, when it came from a goal or feature rather than the template. */
  addedBy?: string;
}

export interface SitePlan {
  brief: SiteBrief;
  industry: IndustryTemplate;
  /** The goals actually used, after defaults were applied. */
  goals: GoalId[];
  /** Pages in sitemap order (parents before children). */
  pages: PlannedPage[];
  navigation: {
    primary: string[];
    footer: string[];
    /** The one button in the header. */
    cta: { label: string; target: string };
  };
  kpis: string[];
  recommendations: string[];
}

/** A reference website in the case library. */
export interface SiteCase {
  id: string;
  name: string;
  url: string;
  /** Matched against IndustryId; unknown values are kept but never score as an industry match. */
  industry: string;
  styleTags: string[];
  features: string[];
  notes?: string;
  /** Screenshot or cover image URL, if the library has one. */
  image?: string;
  source: "sample" | "notion";
}

export interface CaseMatch {
  case: SiteCase;
  /** 0-100. */
  score: number;
  reasons: string[];
}
