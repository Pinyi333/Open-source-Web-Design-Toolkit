/**
 * Types for the Image Prompt Builder.
 *
 * Every option carries two labels (Traditional Chinese for the UI, English as
 * a secondary label) and two prompt fragments (English and Traditional
 * Chinese), so the same selection can be assembled in either language.
 */

/** The option groups a visitor picks from, in display order. */
export type OptionGroup = "industry" | "palette" | "style" | "mood" | "shot" | "lighting" | "ratio";

export interface PromptOption {
  id: string;
  /** UI label in Traditional Chinese. */
  zh: string;
  /** UI label in English. */
  en: string;
  /** Fragment inserted into an English prompt. */
  prompt: string;
  /** Fragment inserted into a Traditional Chinese prompt. */
  promptZh: string;
}

/** What a picture is made with. Decides which camera words make sense. */
export type StyleMedium = "photo" | "render" | "illustration";

export interface StyleOption extends PromptOption {
  medium: StyleMedium;
}

export interface PaletteOption extends PromptOption {
  /** Representative colours, for the swatch strip in the UI. */
  swatches: string[];
}

export interface ShotOption extends PromptOption {
  /** Lens or camera detail, added only when the style is photographic. */
  lens?: string;
  lensZh?: string;
}

export interface RatioOption extends PromptOption {
  /** Width / height, for drawing the frame preview. */
  value: number;
}

export interface IndustryOption extends PromptOption {
  /** Words that suggest this industry when typed as the keyword (any language). */
  keywords: string[];
  /** Ready-made subjects, used when the keyword is empty. */
  subjects: { en: string; zh: string }[];
  /** Options that suit this industry, used by the one-click match. */
  recommends: {
    palette: string[];
    style: string[];
    mood: string[];
    shot: string[];
    lighting: string[];
    ratio: string[];
  };
}

/** A visitor's choices. Every group is optional; the keyword can be empty. */
export interface PromptSelection {
  keyword: string;
  industry?: string;
  palette?: string;
  style?: string;
  mood?: string;
  shot?: string;
  lighting?: string;
  ratio?: string;
  /** Extra scene detail, typed by hand or written by Claude. */
  scene?: string;
}

/**
 * Output dialects.
 * - natural: plain sentences; works for Nano Banana, GPT Image, Flux, Imagen…
 * - midjourney: sentences plus --ar / --no / --style parameters
 * - sd: comma-separated tags with a separate negative prompt (Stable Diffusion family)
 */
export type PromptFormat = "natural" | "midjourney" | "sd";

export type PromptLanguage = "en" | "zh-TW";

export interface PromptPart {
  group: OptionGroup | "subject" | "quality";
  text: string;
}

export interface BuiltPrompt {
  prompt: string;
  /** Things to keep out of the picture. Already folded into `prompt` for midjourney/natural. */
  negative: string;
  format: PromptFormat;
  language: PromptLanguage;
  /** The fragments in order, so the UI can highlight where each came from. */
  parts: PromptPart[];
  /** Settings that are not part of the prompt text, such as an image size for SD. */
  notes: string[];
}
