/**
 * The case library and the matcher that ranks it against a plan.
 *
 * Matching is a transparent points system, not embeddings: every score comes
 * with the reasons that produced it, so a designer can see *why* a site was
 * suggested and disagree with it.
 */

import { getIndustry, resolveIndustry } from "./industries";
import type { CaseMatch, IndustryId, SiteBrief, SiteCase } from "./types";

/**
 * A small starter library of well-known public sites, so the matcher has
 * something to show before a Notion library is connected. Tags are this
 * project's own reading of each site and can be out of date; replace them
 * with your own library for real work.
 */
export const SAMPLE_CASES: SiteCase[] = [
  { id: "stripe", name: "Stripe", url: "https://stripe.com", industry: "saas", styleTags: ["gradient", "technical", "premium"], features: ["blog", "multilingual"], source: "sample" },
  { id: "linear", name: "Linear", url: "https://linear.app", industry: "saas", styleTags: ["minimal", "dark", "technical"], features: ["blog"], source: "sample" },
  { id: "notion", name: "Notion", url: "https://www.notion.com", industry: "saas", styleTags: ["playful", "illustrative", "clean"], features: ["blog", "multilingual"], source: "sample" },
  { id: "allbirds", name: "Allbirds", url: "https://www.allbirds.com", industry: "ecommerce", styleTags: ["clean", "photographic", "warm"], features: ["shop", "search", "membership", "newsletter"], source: "sample" },
  { id: "patagonia", name: "Patagonia", url: "https://www.patagonia.com", industry: "ecommerce", styleTags: ["photographic", "editorial", "bold"], features: ["shop", "search", "blog", "membership"], source: "sample" },
  { id: "aesop", name: "Aesop", url: "https://www.aesop.com", industry: "ecommerce", styleTags: ["premium", "minimal", "editorial", "warm"], features: ["shop", "multilingual", "search"], source: "sample" },
  { id: "sweetgreen", name: "Sweetgreen", url: "https://www.sweetgreen.com", industry: "restaurant", styleTags: ["warm", "photographic", "playful"], features: ["shop", "membership"], source: "sample" },
  { id: "shake-shack", name: "Shake Shack", url: "https://shakeshack.com", industry: "restaurant", styleTags: ["bold", "playful", "photographic"], features: ["shop", "search"], source: "sample" },
  { id: "ideo", name: "IDEO", url: "https://www.ideo.com", industry: "corporate", styleTags: ["editorial", "clean", "bold"], features: ["blog", "newsletter"], source: "sample" },
  { id: "mckinsey", name: "McKinsey & Company", url: "https://www.mckinsey.com", industry: "corporate", styleTags: ["corporate", "editorial", "clean"], features: ["blog", "search", "multilingual", "newsletter"], source: "sample" },
  { id: "pentagram", name: "Pentagram", url: "https://www.pentagram.com", industry: "portfolio", styleTags: ["minimal", "typographic", "editorial"], features: ["blog"], source: "sample" },
  { id: "one-medical", name: "One Medical", url: "https://www.onemedical.com", industry: "healthcare", styleTags: ["calm", "clean", "trustworthy"], features: ["booking", "membership"], source: "sample" },
  { id: "zocdoc", name: "Zocdoc", url: "https://www.zocdoc.com", industry: "healthcare", styleTags: ["friendly", "clean", "illustrative"], features: ["booking", "search"], source: "sample" },
  { id: "khan-academy", name: "Khan Academy", url: "https://www.khanacademy.org", industry: "education", styleTags: ["friendly", "illustrative", "clean"], features: ["membership", "search", "multilingual"], source: "sample" },
  { id: "coursera", name: "Coursera", url: "https://www.coursera.org", industry: "education", styleTags: ["clean", "corporate"], features: ["search", "membership", "blog"], source: "sample" },
  { id: "zillow", name: "Zillow", url: "https://www.zillow.com", industry: "real-estate", styleTags: ["clean", "photographic"], features: ["search", "membership", "booking"], source: "sample" },
  { id: "compass", name: "Compass", url: "https://www.compass.com", industry: "real-estate", styleTags: ["premium", "minimal", "photographic"], features: ["search", "membership"], source: "sample" },
  { id: "charity-water", name: "charity: water", url: "https://www.charitywater.org", industry: "nonprofit", styleTags: ["human", "photographic", "bold"], features: ["newsletter", "membership"], source: "sample" },
  { id: "wikimedia", name: "Wikimedia Foundation", url: "https://wikimediafoundation.org", industry: "nonprofit", styleTags: ["clean", "editorial"], features: ["blog", "multilingual", "newsletter"], source: "sample" },
  { id: "ted", name: "TED Conferences", url: "https://www.ted.com/attend", industry: "events", styleTags: ["bold", "photographic"], features: ["membership", "newsletter", "multilingual"], source: "sample" },
];

/** Industries that share audiences or patterns, and so make useful second-best references. */
const RELATED: Record<IndustryId, IndustryId[]> = {
  restaurant: ["ecommerce", "events"],
  ecommerce: ["restaurant", "saas"],
  saas: ["corporate", "education"],
  corporate: ["saas", "portfolio"],
  portfolio: ["corporate", "events"],
  healthcare: ["corporate", "education"],
  education: ["saas", "nonprofit"],
  "real-estate": ["ecommerce", "corporate"],
  nonprofit: ["education", "events"],
  events: ["portfolio", "nonprofit"],
};

const POINTS = {
  sameIndustry: 50,
  relatedIndustry: 20,
  perFeature: 8,
  maxFeatures: 24,
  perStyle: 9,
  maxStyle: 26,
};

export interface MatchOptions {
  limit?: number;
  /** Drop matches below this score. Default 1, so unrelated cases are hidden. */
  minScore?: number;
}

const normalize = (value: string) => value.trim().toLowerCase();

export function matchCases(brief: Pick<SiteBrief, "industry" | "features" | "styleTags">, cases: SiteCase[], options: MatchOptions = {}): CaseMatch[] {
  const limit = options.limit ?? 6;
  const minScore = options.minScore ?? 1;
  const industry = getIndustry(brief.industry);

  // Style preference: what the user asked for, or the industry's usual style.
  const wantedStyles = new Set((brief.styleTags.length ? brief.styleTags : industry?.styleTags ?? []).map(normalize));
  const wantedFeatures = new Set(brief.features.map(normalize));
  const related = RELATED[brief.industry] ?? [];

  const matches: CaseMatch[] = cases.map((entry) => {
    let score = 0;
    const reasons: string[] = [];
    const caseIndustry = resolveIndustry(entry.industry);

    if (caseIndustry === brief.industry) {
      score += POINTS.sameIndustry;
      reasons.push(`Same industry (${industry?.name ?? brief.industry})`);
    } else if (caseIndustry && related.includes(caseIndustry)) {
      score += POINTS.relatedIndustry;
      reasons.push(`Related industry (${getIndustry(caseIndustry)?.name ?? caseIndustry})`);
    }

    const sharedFeatures = entry.features.filter((feature) => wantedFeatures.has(normalize(feature)));
    if (sharedFeatures.length) {
      score += Math.min(POINTS.maxFeatures, sharedFeatures.length * POINTS.perFeature);
      reasons.push(`Has ${sharedFeatures.join(", ")}`);
    }

    const sharedStyles = entry.styleTags.filter((tag) => wantedStyles.has(normalize(tag)));
    if (sharedStyles.length) {
      score += Math.min(POINTS.maxStyle, sharedStyles.length * POINTS.perStyle);
      reasons.push(`${brief.styleTags.length ? "Matches your style" : "Typical style"}: ${sharedStyles.join(", ")}`);
    }

    return { case: entry, score: Math.min(100, score), reasons };
  });

  return matches
    .filter((match) => match.score >= minScore)
    .sort((a, b) => b.score - a.score || a.case.name.localeCompare(b.case.name))
    .slice(0, limit);
}
