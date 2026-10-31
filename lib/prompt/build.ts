/**
 * Assemble an image prompt from a selection.
 *
 * Deterministic and offline: the same selection always gives the same text.
 * Each fragment comes from the catalogue in ./options, so changing how a
 * style or a shot is worded happens in one place.
 */

import {
  LIGHTING,
  MOODS,
  getIndustry,
  getPalette,
  getRatio,
  getShot,
  getStyle,
} from "./options";
import type {
  BuiltPrompt,
  PromptFormat,
  PromptLanguage,
  PromptPart,
  PromptSelection,
  StyleMedium,
} from "./types";

const NEGATIVE: Record<PromptLanguage, { base: string[]; medium: Record<StyleMedium, string[]> }> = {
  en: {
    base: ["text", "watermark", "logo", "blurry", "low resolution", "jpeg artifacts", "distorted anatomy"],
    medium: {
      photo: ["oversaturated", "plastic-looking skin", "cartoon"],
      render: ["noisy render", "flat lighting"],
      illustration: ["photorealistic", "messy lines"],
    },
  },
  "zh-TW": {
    base: ["文字", "浮水印", "標誌", "模糊", "低解析度", "壓縮瑕疵", "肢體變形"],
    medium: {
      photo: ["過度飽和", "塑膠感皮膚", "卡通感"],
      render: ["渲染雜訊", "平光"],
      illustration: ["寫實照片感", "線條雜亂"],
    },
  },
};

const QUALITY: Record<PromptLanguage, Record<StyleMedium, string>> = {
  en: {
    photo: "photorealistic, high detail, professional colour grading, suitable for web design",
    render: "crisp detail, clean materials, high resolution, suitable for web design",
    illustration: "clean consistent shapes, balanced composition, high resolution, suitable for web design",
  },
  "zh-TW": {
    photo: "寫實、細節豐富、專業調色，適合網頁設計使用",
    render: "細節銳利、材質乾淨、高解析度，適合網頁設計使用",
    illustration: "造型一致、構圖平衡、高解析度，適合網頁設計使用",
  },
};

const SD_QUALITY_TAGS = "masterpiece, best quality, highly detailed";

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function sentence(text: string, language: PromptLanguage): string {
  const trimmed = text.trim().replace(/[.。]+$/, "");
  return language === "en" ? `${capitalise(trimmed)}.` : `${trimmed}。`;
}

/**
 * A ~1 megapixel size for the ratio, rounded to multiples of 64 as SDXL-class
 * models expect. 16:9 gives 1344×768.
 */
export function suggestedSize(ratio: number): { width: number; height: number } {
  const area = 1024 * 1024;
  const round = (value: number) => Math.max(64, Math.round(value / 64) * 64);
  return { width: round(Math.sqrt(area * ratio)), height: round(Math.sqrt(area / ratio)) };
}

/** The subject line: keyword and scene, or the industry's stock subject, or a fallback. */
export function resolveSubject(selection: PromptSelection, language: PromptLanguage): string {
  const keyword = selection.keyword.trim();
  const scene = selection.scene?.trim();
  if (keyword && scene) return `${keyword}${language === "en" ? ", " : "，"}${scene}`;
  if (keyword || scene) return (keyword || scene)!;

  const stock = getIndustry(selection.industry)?.subjects[0];
  if (stock) return language === "en" ? stock.en : stock.zh;
  return language === "en" ? "a striking hero image" : "一張吸睛的主視覺";
}

export function buildImagePrompt(
  selection: PromptSelection,
  options: { format?: PromptFormat; language?: PromptLanguage } = {},
): BuiltPrompt {
  const format = options.format ?? "natural";
  const language = options.language ?? "en";
  const en = language === "en";
  const pick = <T extends { prompt: string; promptZh: string }>(option: T | undefined) =>
    option ? (en ? option.prompt : option.promptZh) : undefined;

  const industry = getIndustry(selection.industry);
  const style = getStyle(selection.style);
  const palette = getPalette(selection.palette);
  const shot = getShot(selection.shot);
  const ratio = getRatio(selection.ratio);
  const mood = MOODS.find((option) => option.id === selection.mood);
  const lighting = LIGHTING.find((option) => option.id === selection.lighting);

  const medium: StyleMedium = style?.medium ?? "photo";
  // Lens names only make sense for a photograph.
  const lens = medium === "photo" && shot ? (en ? shot.lens : shot.lensZh) : undefined;

  const negativeTerms = [...NEGATIVE[language].base, ...NEGATIVE[language].medium[medium]];
  const listSep = en ? ", " : "、";
  const negative = negativeTerms.join(listSep);
  const subject = resolveSubject(selection, language);
  const notes: string[] = [];

  if (format === "sd") {
    const tags: PromptPart[] = [
      { group: "subject", text: subject },
      ...(industry ? [{ group: "industry" as const, text: pick(industry)! }] : []),
      ...(style ? [{ group: "style" as const, text: pick(style)! }] : []),
      ...(shot ? [{ group: "shot" as const, text: [pick(shot), lens].filter(Boolean).join(", ") }] : []),
      ...(lighting ? [{ group: "lighting" as const, text: pick(lighting)! }] : []),
      ...(palette ? [{ group: "palette" as const, text: pick(palette)! }] : []),
      ...(mood ? [{ group: "mood" as const, text: pick(mood)! }] : []),
      { group: "quality", text: en ? SD_QUALITY_TAGS : `${SD_QUALITY_TAGS}, ${QUALITY[language][medium]}` },
    ];
    if (ratio) {
      const size = suggestedSize(ratio.value);
      notes.push(en ? `Size: ${size.width}×${size.height} (${ratio.id})` : `尺寸：${size.width}×${size.height}（${ratio.id}）`);
    }
    return {
      prompt: tags.map((part) => part.text).join(", "),
      negative,
      format,
      language,
      parts: tags,
      notes,
    };
  }

  const parts: PromptPart[] = [];
  const label = (enLabel: string, zhLabel: string, text: string) => (en ? `${enLabel}: ${text}` : `${zhLabel}：${text}`);

  parts.push({
    group: "subject",
    text: sentence(industry ? `${subject}${en ? ", " : "，"}${pick(industry)}` : subject, language),
  });
  if (style) parts.push({ group: "style", text: sentence(pick(style)!, language) });
  if (shot) parts.push({ group: "shot", text: sentence([pick(shot), lens].filter(Boolean).join(en ? ", " : "，"), language) });
  if (lighting) parts.push({ group: "lighting", text: sentence(pick(lighting)!, language) });
  if (palette) parts.push({ group: "palette", text: sentence(label("Colour palette", "配色", pick(palette)!), language) });
  if (mood) parts.push({ group: "mood", text: sentence(label("Mood", "整體調性", pick(mood)!), language) });
  parts.push({ group: "quality", text: sentence(QUALITY[language][medium], language) });

  if (format === "midjourney") {
    const params = [
      ratio ? `--ar ${ratio.id}` : "",
      `--no ${negativeTerms.slice(0, 5).join(", ")}`,
      medium === "photo" ? "--style raw" : "",
    ].filter(Boolean);
    if (!en) notes.push("Midjourney 對英文提示詞的理解最好，建議切換成英文輸出。");
    return {
      prompt: `${parts.map((part) => part.text).join(" ")} ${params.join(" ")}`,
      negative,
      format,
      language,
      parts: [...parts, { group: "ratio", text: params.join(" ") }],
      notes,
    };
  }

  if (ratio) parts.push({ group: "ratio", text: sentence(en ? `Aspect ratio ${ratio.id}` : `畫面比例 ${ratio.id}`, language) });
  // Most natural-language models have no negative field, so say it in words.
  parts.push({ group: "quality", text: sentence(en ? `Avoid ${negativeTerms.slice(0, 4).join(", ")}` : `避免${negativeTerms.slice(0, 4).join("、")}`, language) });

  return {
    prompt: parts.map((part) => part.text).join(en ? " " : ""),
    negative,
    format,
    language,
    parts,
    notes,
  };
}
