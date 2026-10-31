import { describe, expect, it } from "vitest";

import { ClaudeError } from "@/lib/ai/anthropic";
import { buildImagePrompt, resolveSubject, suggestedSize } from "@/lib/prompt/build";
import { buildMatchRequest, parseMatch, requestClaudeMatch } from "@/lib/prompt/claude";
import { autoMatch, createRandom } from "@/lib/prompt/match";
import { GROUP_ORDER, INDUSTRIES, OPTION_GROUPS, RATIOS, inferIndustry } from "@/lib/prompt/options";
import type { PromptSelection } from "@/lib/prompt/types";

const FULL: PromptSelection = {
  keyword: "pour-over coffee",
  industry: "restaurant",
  palette: "warm-earth",
  style: "editorial",
  mood: "warm",
  shot: "close-up",
  lighting: "window",
  ratio: "16:9",
};

describe("option catalogue", () => {
  it("has unique, url-safe ids in every group", () => {
    for (const group of GROUP_ORDER) {
      const ids = OPTION_GROUPS[group].map((option) => option.id);
      expect(new Set(ids).size, group).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9:-]+$/);
    }
  });

  it("fills both labels and both prompt fragments", () => {
    for (const group of GROUP_ORDER) {
      for (const option of OPTION_GROUPS[group]) {
        expect(option.zh && option.en && option.prompt && option.promptZh, `${group}/${option.id}`).toBeTruthy();
      }
    }
  });

  it("only recommends options that exist", () => {
    for (const industry of INDUSTRIES) {
      for (const [group, ids] of Object.entries(industry.recommends)) {
        const known = OPTION_GROUPS[group as keyof typeof industry.recommends].map((option) => option.id);
        for (const id of ids) expect(known, `${industry.id} → ${group}/${id}`).toContain(id);
        expect(ids.length).toBeGreaterThan(0);
      }
      expect(industry.subjects.length).toBeGreaterThan(0);
    }
  });

  it("shares industry ids with the Site Planner where they overlap", () => {
    const ids = INDUSTRIES.map((industry) => industry.id);
    for (const id of ["restaurant", "ecommerce", "saas", "corporate", "portfolio", "healthcare", "education", "real-estate", "nonprofit", "events"]) {
      expect(ids).toContain(id);
    }
  });
});

describe("inferIndustry", () => {
  it.each([
    ["手沖咖啡", "restaurant"],
    ["液冷散熱模組", "manufacturing"],
    ["Semiconductor wafer", "manufacturing"],
    ["保濕精華液", "beauty"],
    ["海島度假飯店", "hospitality"],
    ["AI dashboard", "saas"],
    ["兒童線上課程", "education"],
  ])("%s → %s", (keyword, expected) => {
    expect(inferIndustry(keyword)).toBe(expected);
  });

  it("matches short Latin keywords as whole words only", () => {
    // "bar" is a restaurant keyword; "barista" must not trip it on its own,
    // and "chair" must not match "ai".
    expect(inferIndustry("chair")).toBeUndefined();
    expect(inferIndustry("rooftop bar")).toBe("restaurant");
  });

  it("returns undefined for nothing recognisable", () => {
    expect(inferIndustry("")).toBeUndefined();
    expect(inferIndustry("zzqx")).toBeUndefined();
  });
});

describe("buildImagePrompt", () => {
  it("assembles a natural-language English prompt in a stable order", () => {
    const built = buildImagePrompt(FULL);
    expect(built.prompt).toMatch(/^Pour-over coffee, for a restaurant/);
    expect(built.prompt).toContain("Editorial photograph");
    expect(built.prompt).toContain("85mm lens");
    expect(built.prompt).toContain("Colour palette: warm earthy tones");
    expect(built.prompt).toContain("Aspect ratio 16:9.");
    expect(built.prompt).toMatch(/Avoid text, watermark, logo, blurry\.$/);
    expect(built.parts.map((part) => part.group)).toEqual([
      "subject", "style", "shot", "lighting", "palette", "mood", "quality", "ratio", "quality",
    ]);
  });

  it("writes Traditional Chinese with full-width punctuation", () => {
    const built = buildImagePrompt(FULL, { language: "zh-TW" });
    expect(built.prompt).toContain("配色：陶土");
    expect(built.prompt).toContain("畫面比例 16:9。");
    expect(built.prompt).not.toContain(". ");
    expect(built.negative).toContain("浮水印");
  });

  it("drops lens names when the style is not a photograph", () => {
    const built = buildImagePrompt({ ...FULL, style: "flat-illustration" });
    expect(built.prompt).not.toContain("85mm");
    expect(built.negative).toContain("photorealistic");
  });

  it("adds Midjourney parameters", () => {
    const built = buildImagePrompt(FULL, { format: "midjourney" });
    expect(built.prompt).toMatch(/--ar 16:9 --no text, watermark, logo, blurry, low resolution --style raw$/);
    expect(built.prompt).not.toContain("Aspect ratio");
    const illustrated = buildImagePrompt({ ...FULL, style: "watercolor" }, { format: "midjourney" });
    expect(illustrated.prompt).not.toContain("--style raw");
  });

  it("writes Stable Diffusion tags with a separate negative prompt and a size", () => {
    const built = buildImagePrompt(FULL, { format: "sd" });
    expect(built.prompt.startsWith("pour-over coffee, for a restaurant")).toBe(true);
    expect(built.prompt).toContain("masterpiece, best quality");
    expect(built.prompt).not.toContain("Avoid");
    expect(built.negative).toContain("watermark");
    expect(built.notes).toEqual(["Size: 1344×768 (16:9)"]);
  });

  it("works with nothing selected at all", () => {
    expect(buildImagePrompt({ keyword: "" }).prompt).toMatch(/^A striking hero image\./);
  });

  it("falls back to the industry's stock subject when the keyword is empty", () => {
    expect(resolveSubject({ keyword: " ", industry: "manufacturing" }, "en")).toContain("metal component");
    expect(resolveSubject({ keyword: "", industry: "manufacturing" }, "zh-TW")).toContain("零組件");
    expect(resolveSubject({ keyword: "robot", scene: "on a desk" }, "en")).toBe("robot, on a desk");
  });
});

describe("suggestedSize", () => {
  it("keeps about one megapixel in multiples of 64", () => {
    for (const ratio of RATIOS) {
      const { width, height } = suggestedSize(ratio.value);
      expect(width % 64).toBe(0);
      expect(height % 64).toBe(0);
      expect(width * height).toBeGreaterThan(0.85 * 1024 * 1024);
      expect(width * height).toBeLessThan(1.15 * 1024 * 1024);
    }
    expect(suggestedSize(1)).toEqual({ width: 1024, height: 1024 });
  });
});

describe("autoMatch", () => {
  it("is deterministic for a seed", () => {
    expect(autoMatch({ keyword: "咖啡", seed: 7 })).toEqual(autoMatch({ keyword: "咖啡", seed: 7 }));
  });

  it("fills every group with a real option", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { selection } = autoMatch({ keyword: "", seed });
      for (const group of GROUP_ORDER) {
        expect(OPTION_GROUPS[group].map((option) => option.id), `${seed}/${group}`).toContain(selection[group]);
      }
    }
  });

  it("guesses the industry from the keyword and says so", () => {
    const result = autoMatch({ keyword: "半導體晶片", seed: 3 });
    expect(result.selection.industry).toBe("manufacturing");
    expect(result.reasons[0]).toContain("工業製造");
  });

  it("keeps locked groups", () => {
    const current = { industry: "beauty", palette: "neon-cyber", style: "watercolor" };
    for (let seed = 1; seed <= 20; seed++) {
      const { selection } = autoMatch({ keyword: "咖啡", current, locked: ["industry", "palette"], seed });
      expect(selection.industry).toBe("beauty");
      expect(selection.palette).toBe("neon-cyber");
    }
  });

  it("ignores a lock on an empty group", () => {
    const { selection } = autoMatch({ keyword: "咖啡", locked: ["palette"], seed: 1 });
    expect(selection.palette).toBeTruthy();
  });

  it("changes unlocked groups between clicks", () => {
    const first = autoMatch({ keyword: "咖啡", seed: 11 }).selection;
    const second = autoMatch({ keyword: "咖啡", current: first, seed: 12 }).selection;
    for (const group of ["style", "palette", "mood", "shot", "lighting", "ratio"] as const) {
      expect(second[group], group).not.toBe(first[group]);
    }
  });

  it("mostly follows the industry's recommendations", () => {
    const industry = INDUSTRIES.find((entry) => entry.id === "manufacturing")!;
    let hits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { selection } = autoMatch({ keyword: "散熱", seed });
      if (industry.recommends.style.includes(selection.style!)) hits++;
    }
    expect(hits).toBeGreaterThan(140);
  });

  it("never pairs an illustration style with photo-only lighting", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { selection } = autoMatch({ keyword: "", current: { style: "watercolor" }, locked: ["style"], seed });
      expect(["softbox", "window", "golden-hour", "blue-hour", "overcast"]).not.toContain(selection.lighting);
    }
  });

  it("uses a well-spread generator", () => {
    const random = createRandom(42);
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.floor(random() * 4)]++;
    for (const count of buckets) expect(count).toBeGreaterThan(850);
  });
});

describe("Claude match (bring your own key)", () => {
  it("lists the catalogue and locked choices in the request", () => {
    const request = buildMatchRequest("咖啡", { current: { palette: "pastel" }, locked: ["palette", "style"] });
    expect(request.system).toContain("palette: warm-earth (Warm earth)");
    expect(request.messages[0].content).toContain('palette must stay "pastel"');
    // A lock on an empty group is not sent.
    expect(request.messages[0].content).not.toContain("style must stay");
  });

  it("keeps valid ids and drops invented ones", () => {
    const match = parseMatch(
      'Sure! {"industry":"restaurant","palette":"rainbow","style":"editorial","mood":"warm","shot":"close-up","lighting":"window","ratio":"16:9","scene":"A barista pours","rationale":"溫暖"}',
      "咖啡",
    );
    expect(match.selection.industry).toBe("restaurant");
    expect(match.selection.palette).toBeUndefined();
    expect(match.selection.scene).toBe("A barista pours");
    expect(match.rationale).toBe("溫暖");
  });

  it("rejects a reply without JSON", () => {
    expect(() => parseMatch("no idea", "x")).toThrow(ClaudeError);
  });

  it("sends the key only to Anthropic and enforces locks", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const reply = { industry: "saas", palette: "tech-blue", style: "3d-render", mood: "futuristic", shot: "wide", lighting: "rim", ratio: "16:9", scene: "s", rationale: "r" };
      return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(reply) }], stop_reason: "end_turn" }), { status: 200 });
    };

    const match = await requestClaudeMatch({
      apiKey: "sk-ant-test",
      keyword: "dashboard",
      current: { palette: "pastel" },
      locked: ["palette"],
      fetchImpl,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    expect((calls[0].init!.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    expect(match.selection.palette).toBe("pastel");
    expect(match.selection.style).toBe("3d-render");
  });

  it("refuses something that is not an Anthropic key before sending", async () => {
    let called = false;
    await expect(
      requestClaudeMatch({ apiKey: "sk-openai", keyword: "x", fetchImpl: async () => { called = true; return new Response("{}"); } }),
    ).rejects.toThrow(/sk-ant-/);
    expect(called).toBe(false);
  });

  it("explains a rejected key", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ error: { message: "invalid x-api-key" } }), { status: 401 });
    await expect(requestClaudeMatch({ apiKey: "sk-ant-bad", keyword: "x", fetchImpl })).rejects.toThrow("Anthropic rejected the API key.");
  });
});
