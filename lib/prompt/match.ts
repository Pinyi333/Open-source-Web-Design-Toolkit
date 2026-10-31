/**
 * One-click match: fill the groups a visitor has not locked with options that
 * suit each other, without calling any AI.
 *
 * The rules are simple and written down here so they can be tuned:
 *  1. Industry: kept if locked, otherwise guessed from the keyword, otherwise random.
 *  2. Every other group: usually one of the industry's recommendations, now
 *     and then any option, so repeated clicks still surprise.
 *  3. A non-photographic style never gets the photo-only lighting setups.
 *  4. When possible, an unlocked group changes on each click.
 *
 * Randomness comes from a seeded generator, so a given seed always gives the
 * same match. That keeps tests exact and lets a result be shared by its seed.
 */

import { GROUP_LABELS, OPTION_GROUPS, getIndustry, getStyle, inferIndustry } from "./options";
import type { OptionGroup, PromptSelection } from "./types";

/** mulberry32: tiny, fast, good enough for picking from a short list. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lighting that reads as a photographic setup; skipped for illustration. */
const PHOTO_ONLY_LIGHTING = new Set(["softbox", "window", "golden-hour", "blue-hour", "overcast"]);

/** How often an unlocked group ignores the industry's recommendations. */
const WILDCARD_RATE = 0.2;

export type MatchableGroup = Exclude<OptionGroup, "industry">;

const MATCH_ORDER: MatchableGroup[] = ["style", "palette", "mood", "shot", "lighting", "ratio"];

export interface MatchResult {
  selection: PromptSelection;
  /** One short line per decision, in Traditional Chinese, for the UI. */
  reasons: string[];
}

function choose<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)];
}

export function autoMatch({
  keyword,
  current = {},
  locked = [],
  seed = Date.now(),
}: {
  keyword: string;
  current?: Partial<PromptSelection>;
  locked?: OptionGroup[];
  seed?: number;
}): MatchResult {
  const random = createRandom(seed);
  const isLocked = (group: OptionGroup) => locked.includes(group) && Boolean(current[group]);
  const reasons: string[] = [];

  // 1. Industry.
  let industryId: string;
  if (isLocked("industry")) {
    industryId = current.industry!;
  } else {
    const guessed = inferIndustry(keyword);
    if (guessed) {
      industryId = guessed;
      reasons.push(`從關鍵字判斷產業為「${getIndustry(guessed)!.zh}」`);
    } else {
      const others = OPTION_GROUPS.industry.filter((option) => option.id !== current.industry);
      industryId = choose(others, random).id;
      reasons.push(`關鍵字看不出產業，隨機選了「${getIndustry(industryId)!.zh}」`);
    }
  }
  const industry = getIndustry(industryId)!;

  const selection: PromptSelection = {
    keyword,
    scene: current.scene,
    industry: industryId,
  };

  // 2-4. The rest, style first because it constrains lighting.
  for (const group of MATCH_ORDER) {
    if (isLocked(group)) {
      selection[group] = current[group];
      continue;
    }

    let pool = OPTION_GROUPS[group].map((option) => option.id);
    if (group === "lighting" && getStyle(selection.style)?.medium === "illustration") {
      pool = pool.filter((id) => !PHOTO_ONLY_LIGHTING.has(id));
    }

    const recommended = industry.recommends[group].filter((id) => pool.includes(id));
    const wildcard = random() < WILDCARD_RATE || recommended.length === 0;
    let candidates = wildcard ? pool : recommended;

    // Prefer something different from what is on screen now.
    const fresh = candidates.filter((id) => id !== current[group]);
    if (fresh.length > 0) candidates = fresh;

    const picked = choose(candidates, random);
    selection[group] = picked;

    if (group === "style" || group === "palette") {
      const option = OPTION_GROUPS[group].find((entry) => entry.id === picked)!;
      reasons.push(
        wildcard
          ? `${GROUP_LABELS[group].zh}換個口味，試試「${option.zh}」`
          : `${industry.zh}常用的${GROUP_LABELS[group].zh}：「${option.zh}」`,
      );
    }
  }

  return { selection, reasons };
}
