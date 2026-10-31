"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";

import { CLAUDE_MODELS, ClaudeError, DEFAULT_CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { buildImagePrompt } from "@/lib/prompt/build";
import { requestClaudeMatch } from "@/lib/prompt/claude";
import { autoMatch } from "@/lib/prompt/match";
import {
  GROUP_LABELS,
  GROUP_ORDER,
  INDUSTRIES,
  LIGHTING,
  MOODS,
  PALETTES,
  RATIOS,
  SHOTS,
  STYLES,
  findOption,
  getIndustry,
  getPalette,
  getRatio,
  getStyle,
  inferIndustry,
} from "@/lib/prompt/options";
import type { OptionGroup, PromptFormat, PromptLanguage, PromptSelection, StyleMedium } from "@/lib/prompt/types";
import { Button, CodeBlock, CopyButton, Notice, Spinner, Tabs, cx } from "@/components/ui";

import styles from "./image-prompt-builder.module.css";

// --- per-viewer storage ---------------------------------------------------------

/*
 * The API key lives in this browser only, and only when the visitor ticks
 * "remember". Read through useSyncExternalStore so the server render (which
 * has no storage) and the first client render agree.
 */
const KEY_STORAGE = "wdt.prompt.claudeKey";
const STORAGE_EVENT = "wdt-prompt-storage";

function readStorage(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(KEY_STORAGE);
    else window.localStorage.setItem(KEY_STORAGE, value);
  } catch {
    // Private mode or blocked storage: remembering is a convenience only.
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

// --- constants --------------------------------------------------------------------

const FORMATS: { id: PromptFormat; label: string }[] = [
  { id: "natural", label: "自然語言" },
  { id: "midjourney", label: "Midjourney" },
  { id: "sd", label: "Stable Diffusion" },
];

const LANGUAGES: { id: PromptLanguage; label: string }[] = [
  { id: "en", label: "English" },
  { id: "zh-TW", label: "繁中" },
];

const FORMAT_HINT: Record<PromptFormat, string> = {
  natural: "適用 Nano Banana、GPT Image、Flux、Imagen 等吃自然語句的模型。",
  midjourney: "已附上 --ar、--no 參數；攝影風格會加 --style raw。",
  sd: "逗號分隔的標籤，反向提示詞請貼到 Negative prompt 欄位。",
};

const MEDIUM_LABEL: Record<StyleMedium, string> = {
  photo: "攝影",
  render: "3D",
  illustration: "插畫",
};

const SAMPLE_KEYWORDS = ["手沖咖啡", "液冷散熱模組", "保濕精華液", "海島度假飯店", "AI 數據儀表板", "城市夜跑"];

const MCP_SNIPPET = `git clone https://github.com/Pinyi333/Open-source-Web-Design-Toolkit.git
cd Open-source-Web-Design-Toolkit/mcp && npm install && npm run build
claude mcp add web-design-toolkit -- node "$PWD/dist/mcp/src/index.js"`;

const EMPTY: PromptSelection = { keyword: "" };

// --- small pieces ---------------------------------------------------------------

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={locked ? "M8 11V7a4 4 0 0 1 8 0v4" : "M8 11V7a4 4 0 0 1 7.5-2"} />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
    </svg>
  );
}

function GroupHeader({
  group,
  index,
  selected,
  locked,
  onToggleLock,
  onClear,
}: {
  group: OptionGroup;
  index: number;
  selected?: string;
  locked: boolean;
  onToggleLock: () => void;
  onClear: () => void;
}) {
  const label = GROUP_LABELS[group];
  const current = findOption(group, selected);
  return (
    <div className={styles.groupHead}>
      <span className={styles.groupIndex}>{String(index + 1).padStart(2, "0")}</span>
      <h3 className={styles.groupTitle}>
        {label.zh}
        <span className={styles.groupEn}>{label.en}</span>
      </h3>
      <span className={styles.groupValue}>{current ? current.zh : "未選"}</span>
      {selected ? (
        <button type="button" className={styles.iconButton} onClick={onClear} aria-label={`清除${label.zh}`}>
          ×
        </button>
      ) : null}
      <button
        type="button"
        className={styles.iconButton}
        aria-pressed={locked}
        onClick={onToggleLock}
        title={locked ? "已鎖定：一鍵搭配不會更動" : "鎖定這一組，一鍵搭配時保留"}
        aria-label={`${locked ? "解除鎖定" : "鎖定"}${label.zh}`}
      >
        <LockIcon locked={locked} />
      </button>
    </div>
  );
}

// --- main ---------------------------------------------------------------------------

export function ImagePromptBuilder() {
  const [selection, setSelection] = useState<PromptSelection>(EMPTY);
  const [locked, setLocked] = useState<OptionGroup[]>([]);
  const [format, setFormat] = useState<PromptFormat>("natural");
  const [language, setLanguage] = useState<PromptLanguage>("en");
  const [reasons, setReasons] = useState<{ source: "match" | "claude"; lines: string[] } | null>(null);
  const [flash, setFlash] = useState(0);

  const built = useMemo(() => buildImagePrompt(selection, { format, language }), [selection, format, language]);
  const guessed = inferIndustry(selection.keyword);

  const pick = (group: OptionGroup, id: string) =>
    setSelection((current) => ({ ...current, [group]: current[group] === id ? undefined : id }));
  const clear = (group: OptionGroup) => setSelection((current) => ({ ...current, [group]: undefined }));
  const toggleLock = (group: OptionGroup) =>
    setLocked((current) => (current.includes(group) ? current.filter((item) => item !== group) : [...current, group]));

  const runMatch = () => {
    const result = autoMatch({ keyword: selection.keyword, current: selection, locked });
    setSelection(result.selection);
    setReasons({ source: "match", lines: result.reasons });
    setFlash((value) => value + 1);
  };

  const reset = () => {
    setSelection(EMPTY);
    setLocked([]);
    setReasons(null);
  };

  const header = (group: OptionGroup) => (
    <GroupHeader
      group={group}
      index={GROUP_ORDER.indexOf(group)}
      selected={selection[group]}
      locked={locked.includes(group)}
      onToggleLock={() => toggleLock(group)}
      onClear={() => clear(group)}
    />
  );

  const chipProps = (group: OptionGroup, id: string) => ({
    type: "button" as const,
    "aria-pressed": selection[group] === id,
    onClick: () => pick(group, id),
  });

  return (
    <div className={styles.root}>
      {/* --- composer ------------------------------------------------------ */}
      <section className={styles.composer} aria-label="關鍵字">
        <div className={styles.composerGlow} aria-hidden="true" />
        <label htmlFor="prompt-keyword" className={styles.eyebrow}>
          Step 1 · 輸入關鍵字
        </label>
        <input
          id="prompt-keyword"
          className={styles.keyword}
          value={selection.keyword}
          onChange={(event) => setSelection((current) => ({ ...current, keyword: event.target.value }))}
          placeholder="例如：手沖咖啡"
          autoComplete="off"
          maxLength={200}
        />
        <div className={styles.samples}>
          <span className={styles.samplesLabel}>試試看</span>
          {SAMPLE_KEYWORDS.map((word) => (
            <button key={word} type="button" className={styles.sample} onClick={() => setSelection((current) => ({ ...current, keyword: word }))}>
              {word}
            </button>
          ))}
        </div>
        <textarea
          className={styles.scene}
          value={selection.scene ?? ""}
          onChange={(event) => setSelection((current) => ({ ...current, scene: event.target.value || undefined }))}
          placeholder="（選填）補充畫面細節：場景、道具、動作…"
          rows={2}
          maxLength={600}
          aria-label="補充畫面細節"
        />
        <div className={styles.composerActions}>
          <Button variant="primary" onClick={runMatch} className={styles.matchButton}>
            <SparkIcon /> AI 一鍵搭配
          </Button>
          <a href="#claude" className={styles.textLink}>
            或請你自己的 Claude 搭配 ↓
          </a>
          <Button variant="ghost" size="sm" onClick={reset} className={styles.resetButton}>
            全部清除
          </Button>
        </div>
        {guessed && guessed !== selection.industry ? (
          <p className={styles.guess}>
            看起來是「{getIndustry(guessed)!.zh}」產業。
            <button type="button" onClick={() => setSelection((current) => ({ ...current, industry: guessed }))}>
              套用
            </button>
          </p>
        ) : null}
      </section>

      <div className={styles.layout}>
        {/* --- options ------------------------------------------------------ */}
        <div className={styles.options}>
          <p className={styles.eyebrow}>Step 2 · 挑選方向（再點一次可取消；鎖定的組別，一鍵搭配不會更動）</p>
          {/* Re-keyed on every match so the chips replay their entrance. */}
          <div className={styles.groups} key={flash} data-flash={flash > 0 || undefined}>

          <section className={styles.group}>
            {header("industry")}
            <div className={styles.industryGrid}>
              {INDUSTRIES.map((option) => (
                <button key={option.id} {...chipProps("industry", option.id)} className={styles.card}>
                  <span className={styles.cardZh}>{option.zh}</span>
                  <span className={styles.cardEn}>{option.en}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.group}>
            {header("palette")}
            <div className={styles.paletteGrid}>
              {PALETTES.map((option) => (
                <button key={option.id} {...chipProps("palette", option.id)} className={styles.paletteCard}>
                  <span className={styles.swatches} aria-hidden="true">
                    {option.swatches.map((hex) => (
                      <span key={hex} style={{ background: hex }} />
                    ))}
                  </span>
                  <span className={styles.paletteLabel}>{option.zh}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.group}>
            {header("style")}
            <div className={styles.styleGrid}>
              {STYLES.map((option) => (
                <button key={option.id} {...chipProps("style", option.id)} className={styles.card}>
                  <span className={styles.cardZh}>{option.zh}</span>
                  <span className={styles.cardEn}>
                    <span className={styles.medium} data-medium={option.medium}>
                      {MEDIUM_LABEL[option.medium]}
                    </span>
                    {option.en}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <div className={styles.twoUp}>
            <section className={styles.group}>
              {header("mood")}
              <div className={styles.chips}>
                {MOODS.map((option) => (
                  <button key={option.id} {...chipProps("mood", option.id)} className={styles.chip}>
                    {option.zh}
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.group}>
              {header("lighting")}
              <div className={styles.chips}>
                {LIGHTING.map((option) => (
                  <button key={option.id} {...chipProps("lighting", option.id)} className={styles.chip}>
                    {option.zh}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <section className={styles.group}>
            {header("shot")}
            <div className={styles.chips}>
              {SHOTS.map((option) => (
                <button key={option.id} {...chipProps("shot", option.id)} className={styles.chip} title={option.prompt}>
                  {option.zh}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.group}>
            {header("ratio")}
            <div className={styles.ratioRow}>
              {RATIOS.map((option) => (
                <button key={option.id} {...chipProps("ratio", option.id)} className={styles.ratio}>
                  <span className={styles.ratioBox} aria-hidden="true">
                    <span style={{ aspectRatio: String(option.value), [option.value >= 1 ? "width" : "height"]: "100%" }} />
                  </span>
                  <span className={styles.ratioId}>{option.id}</span>
                  <span className={styles.ratioUse}>{option.zh.replace(option.id, "").trim()}</span>
                </button>
              ))}
            </div>
          </section>
          </div>

          <ClaudePanel
            selection={selection}
            locked={locked}
            language={language}
            onResult={(next, rationale) => {
              setSelection(next);
              setReasons({ source: "claude", lines: rationale ? [rationale] : [] });
              setFlash((value) => value + 1);
            }}
          />
        </div>

        {/* --- output ------------------------------------------------------- */}
        <aside id="prompt-output" className={styles.output} aria-label="提示詞">
          <Moodboard selection={selection} flash={flash} />

          <div className={styles.outputControls}>
            <Tabs options={FORMATS} value={format} onChange={setFormat} label="輸出格式" className={styles.fullTabs} />
            <Tabs options={LANGUAGES} value={language} onChange={setLanguage} label="提示詞語言" />
          </div>
          <p className={styles.hint}>{FORMAT_HINT[format]}</p>

          <div className={styles.promptBox}>
            <div className={styles.promptHead}>
              <span className={styles.eyebrow}>Prompt</span>
              <CopyButton value={built.prompt} label="複製提示詞" variant="primary" />
            </div>
            <p className={styles.promptText} lang={language === "en" ? "en" : "zh-Hant"}>
              {built.parts.map((part, index) => (
                <span key={index}>
                  {index > 0 ? (format === "sd" ? ", " : format === "natural" && language === "zh-TW" ? "" : " ") : null}
                  <span className={styles.part} data-group={part.group}>
                    {part.text}
                  </span>
                </span>
              ))}
            </p>
            <ul className={styles.legend} aria-label="顏色對照">
              {(["subject", ...GROUP_ORDER.filter((group) => group !== "industry")] as const).map((group) => (
                <li key={group} data-group={group}>
                  {group === "subject" ? "主體" : GROUP_LABELS[group].zh}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.negative}>
            <div className={styles.promptHead}>
              <span className={styles.eyebrow}>Negative</span>
              <CopyButton value={built.negative} label="複製" />
            </div>
            <p className={styles.negativeText}>{built.negative}</p>
            {format !== "sd" ? <p className={styles.hint}>主要項目已寫進上方提示詞；有反向欄位的工具可另外貼上這段。</p> : null}
          </div>

          {built.notes.length > 0 ? (
            <ul className={styles.notes}>
              {built.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : null}

          {reasons && reasons.lines.length > 0 ? (
            <div className={styles.reasons}>
              <p className={styles.eyebrow}>{reasons.source === "claude" ? "Claude 的搭配理由" : "搭配邏輯"}</p>
              <ul>
                {reasons.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>

      {/* On narrow screens the output sits below every option group; keep the result one tap away. */}
      <div className={styles.mobileBar}>
        <a href="#prompt-output" className={styles.mobileJump}>
          看提示詞 ↓
        </a>
        <CopyButton value={built.prompt} label="複製提示詞" variant="primary" size="md" />
      </div>
    </div>
  );
}

// --- moodboard preview --------------------------------------------------------------

function Moodboard({ selection, flash }: { selection: PromptSelection; flash: number }) {
  const palette = getPalette(selection.palette);
  const ratio = getRatio(selection.ratio);
  const style = getStyle(selection.style);
  const tags = (["industry", "style", "mood", "shot", "lighting"] as const)
    .map((group) => findOption(group, selection[group])?.zh)
    .filter(Boolean);

  const colors = palette?.swatches ?? ["var(--color-raised)", "var(--color-surface)", "var(--color-line)", "var(--color-canvas)"];
  const background = `radial-gradient(120% 90% at 15% 10%, ${colors[2]} 0%, transparent 55%), radial-gradient(90% 80% at 90% 90%, ${colors[1]} 0%, transparent 60%), linear-gradient(135deg, ${colors[0]}, ${colors[3]})`;

  // Keep the preview a sensible height whatever the ratio.
  const value = ratio?.value ?? 16 / 9;
  const frameStyle = value >= 1.5 ? { aspectRatio: String(value), width: "100%" } : { aspectRatio: String(value), height: "min(260px, 64vw)" };

  return (
    <figure className={styles.moodboard}>
      <div key={flash} className={styles.moodFrame} style={{ ...frameStyle, background }} data-medium={style?.medium ?? "photo"}>
        <div className={styles.moodGrain} aria-hidden="true" />
        <div className={styles.moodContent}>
          <span className={styles.moodRatio}>{ratio?.id ?? "16:9"}</span>
          <p className={styles.moodTitle}>{selection.keyword.trim() || "你的畫面"}</p>
          {tags.length > 0 ? <p className={styles.moodTags}>{tags.join(" · ")}</p> : null}
        </div>
      </div>
      <figcaption className={styles.hint}>情境板只是方向示意，不是生成結果。</figcaption>
    </figure>
  );
}

// --- bring your own Claude ------------------------------------------------------------

function ClaudePanel({
  selection,
  locked,
  language,
  onResult,
}: {
  selection: PromptSelection;
  locked: OptionGroup[];
  language: PromptLanguage;
  onResult: (selection: PromptSelection, rationale: string) => void;
}) {
  const stored = useSyncExternalStore(subscribeStorage, readStorage, () => "");
  const [draft, setDraft] = useState<string | null>(null);
  const [rememberChoice, setRememberChoice] = useState<boolean | null>(null);
  const [model, setModel] = useState(DEFAULT_CLAUDE_MODEL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const apiKey = draft ?? stored;
  const remember = rememberChoice ?? Boolean(stored);

  const onKeyChange = (value: string) => {
    setDraft(value);
    if (remember) writeStorage(value.trim() ? value.trim() : null);
  };

  const onRememberChange = (value: boolean) => {
    setRememberChoice(value);
    writeStorage(value && apiKey.trim() ? apiKey.trim() : null);
  };

  const run = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    try {
      const match = await requestClaudeMatch({
        apiKey,
        keyword: selection.keyword,
        model,
        language,
        current: selection,
        locked,
        signal: controller.signal,
      });
      onResult({ ...selection, ...dropUndefined(match.selection) }, match.rationale);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      setError(caught instanceof ClaudeError ? caught.message : "Something went wrong talking to Claude.");
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  };

  return (
    <section id="claude" className={styles.claude}>
      <div className={styles.claudeHead}>
        <span className={styles.groupIndex}>AI</span>
        <h3 className={styles.groupTitle}>
          用你自己的 Claude 搭配
          <span className={styles.groupEn}>Bring your own Claude</span>
        </h3>
      </div>
      <p className={styles.hint}>
        上面的「AI 一鍵搭配」是規則式組合，不需要任何金鑰。想讓 Claude 依關鍵字構思場景，有兩種方式，本專案不內建任何憑證。
      </p>

      <div className={styles.claudeWays}>
        <div className={styles.claudeWay}>
          <p className={styles.wayTitle}>A · 瀏覽器自帶 API key</p>
          <p className={styles.hint}>金鑰只存在你的瀏覽器，請求直接送到 api.anthropic.com，不經過本站伺服器。費用由你的 Anthropic 帳號計算。</p>
          <input
            type="password"
            className={styles.keyInput}
            value={apiKey}
            onChange={(event) => onKeyChange(event.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Anthropic API key"
          />
          <div className={styles.keyRow}>
            <label className={styles.check}>
              <input type="checkbox" checked={remember} onChange={(event) => onRememberChange(event.target.checked)} />
              記住在這台裝置
            </label>
            <select className={styles.select} value={model} onChange={(event) => setModel(event.target.value)} aria-label="模型">
              {CLAUDE_MODELS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" onClick={run} disabled={busy || !apiKey.trim()} className={styles.claudeButton}>
            {busy ? <Spinner /> : <SparkIcon />} {busy ? "Claude 思考中…" : "請 Claude 搭配"}
          </Button>
          {error ? (
            <Notice tone="error" className={styles.claudeError}>
              {error}
            </Notice>
          ) : null}
        </div>

        <div className={cx(styles.claudeWay, styles.claudeWayMcp)}>
          <p className={styles.wayTitle}>B · MCP（用你的 Claude 訂閱）</p>
          <p className={styles.hint}>
            把本工具包的 MCP server 加進 Claude Code 或 Claude Desktop，直接跟 Claude 說「幫我做一組咖啡廳主視覺的提示詞」。它會呼叫 <code>list_image_prompt_options</code>、<code>build_image_prompt</code>、<code>match_image_prompt</code>，不需要 API key。
          </p>
          <CodeBlock code={MCP_SNIPPET} />
        </div>
      </div>
    </section>
  );
}

function dropUndefined(selection: PromptSelection): Partial<PromptSelection> {
  return Object.fromEntries(Object.entries(selection).filter(([, value]) => value !== undefined));
}
