"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { SAMPLE_CASES, matchCases } from "@/lib/planner/cases";
import {
  CLAUDE_MODELS,
  ClaudeError,
  DEFAULT_CLAUDE_MODEL,
  requestPlanReview,
  type PlanReview,
  type ReviewLanguage,
} from "@/lib/planner/claude";
import { FEATURES, GOALS, INDUSTRIES, SCALES, SECTION_LABELS, STYLE_TAGS } from "@/lib/planner/industries";
import { NOTION_PROPERTY_ALIASES } from "@/lib/planner/notion";
import { NotionClientError, loadNotionCases } from "@/lib/planner/notion-client";
import { buildSitePlan, planToMarkdown } from "@/lib/planner/plan";
import type { FeatureId, GoalId, IndustryId, SiteBrief, SiteCase, SitePlan } from "@/lib/planner/types";
import { renderWireframe, type WireframeViewport } from "@/lib/planner/wireframe";
import {
  Badge,
  Button,
  CodeBlock,
  CopyButton,
  Field,
  Input,
  Notice,
  Spinner,
  Tabs,
  Textarea,
} from "@/components/ui";

import styles from "./site-planner.module.css";

type View = "sitemap" | "wireframes" | "cases" | "claude" | "export";

const VIEWS: { id: View; label: string }[] = [
  { id: "sitemap", label: "Sitemap" },
  { id: "wireframes", label: "Wireframes" },
  { id: "cases", label: "Cases" },
  { id: "claude", label: "Claude" },
  { id: "export", label: "Export" },
];

// --- per-viewer storage --------------------------------------------------------

/*
 * Keys and tokens live in this browser only, and only when the visitor ticks
 * "remember". Read through useSyncExternalStore so the server render (which
 * has no storage) and the first client render agree.
 */
const STORAGE_EVENT = "wdt-planner-storage";

function readStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
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

function useStored(key: string): string {
  return useSyncExternalStore(
    subscribeStorage,
    () => readStorage(key),
    () => "",
  );
}

const KEYS = {
  notionToken: "wdt.planner.notionToken",
  notionDb: "wdt.planner.notionDb",
  claudeKey: "wdt.planner.claudeKey",
};

// --- helpers ----------------------------------------------------------------------

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileSlug(plan: SitePlan): string {
  const base = plan.brief.name?.trim() || plan.industry.id;
  return base.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-|-$/g, "") || "site";
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={styles.chip}>
      {children}
    </button>
  );
}

// --- main ---------------------------------------------------------------------------

export function SitePlanner() {
  const [brief, setBrief] = useState<SiteBrief>({
    industry: "saas",
    name: "",
    goals: [],
    scale: "medium",
    features: [],
    styleTags: [],
  });
  const [view, setView] = useState<View>("sitemap");
  const [selectedPage, setSelectedPage] = useState("home");
  const [notionCases, setNotionCases] = useState<SiteCase[] | null>(null);

  const plan = useMemo(() => buildSitePlan(brief), [brief]);
  const update = (patch: Partial<SiteBrief>) => setBrief((current) => ({ ...current, ...patch }));

  // If the selected page vanished (scale shrank), fall back to home.
  const activePage = plan.pages.find((page) => page.slug === selectedPage) ?? plan.pages[0];

  const openWireframe = (slug: string) => {
    setSelectedPage(slug);
    setView("wireframes");
  };

  return (
    <div className={styles.layout}>
      <BriefForm brief={brief} plan={plan} update={update} />

      <section className={styles.output} aria-label="Plan">
        <div className={styles.outputHeader}>
          <div>
            <p className={styles.eyebrow}>{plan.industry.nameZh} · {plan.industry.name}</p>
            <h2 className={styles.outputTitle}>{brief.name?.trim() || `${plan.industry.name} website`}</h2>
            <p className={styles.outputSummary}>{plan.industry.summary}</p>
          </div>
          <div className={styles.metrics}>
            <Metric value={plan.pages.length} label={plan.pages.length === 1 ? "page" : "pages"} />
            <Metric value={plan.pages.reduce((sum, page) => sum + page.sections.length - 2, 0)} label="sections" />
            <Metric value={plan.navigation.primary.length} label="nav items" />
          </div>
        </div>

        <div className={styles.viewTabs}>
          <Tabs label="Plan view" value={view} onChange={setView} options={VIEWS} />
        </div>

        <div className={styles.panel} key={view}>
          {view === "sitemap" ? <SitemapView plan={plan} onOpen={openWireframe} /> : null}
          {view === "wireframes" ? (
            <WireframeView plan={plan} pageSlug={activePage.slug} onSelect={setSelectedPage} />
          ) : null}
          {view === "cases" ? (
            <CasesView brief={plan.brief} notionCases={notionCases} onNotionCases={setNotionCases} />
          ) : null}
          {view === "claude" ? <ClaudeView plan={plan} /> : null}
          {view === "export" ? <ExportView plan={plan} /> : null}
        </div>
      </section>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  );
}

// --- brief ------------------------------------------------------------------------

function BriefForm({ brief, plan, update }: { brief: SiteBrief; plan: SitePlan; update: (patch: Partial<SiteBrief>) => void }) {
  const [customStyle, setCustomStyle] = useState("");
  const industry = plan.industry;

  const addCustomStyle = () => {
    const tag = customStyle.trim().toLowerCase();
    if (tag && !brief.styleTags.includes(tag)) update({ styleTags: [...brief.styleTags, tag] });
    setCustomStyle("");
  };

  return (
    <aside className={styles.brief} aria-label="Brief">
      <div className={styles.briefInner}>
        <Field label="Project name" htmlFor="planner-name">
          <Input
            id="planner-name"
            placeholder="e.g. Harbour Coffee"
            value={brief.name ?? ""}
            maxLength={60}
            onChange={(event) => update({ name: event.target.value })}
          />
        </Field>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Industry</legend>
          <div className={styles.industryGrid} role="radiogroup" aria-label="Industry">
            {INDUSTRIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={entry.id === brief.industry}
                className={styles.industry}
                onClick={() => update({ industry: entry.id as IndustryId, goals: [] })}
              >
                <span className={styles.industryZh}>{entry.nameZh}</span>
                <span className={styles.industryEn}>{entry.name}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Scale</legend>
          <Tabs
            label="Site scale"
            value={brief.scale}
            onChange={(scale) => update({ scale })}
            options={SCALES.map((scale) => ({ id: scale.id, label: scale.label }))}
            className={styles.fullTabs}
          />
          <p className={styles.hint}>{SCALES.find((scale) => scale.id === brief.scale)?.hint}</p>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Goals</legend>
          <div className={styles.chips}>
            {[...GOALS]
              .sort((a, b) => rank(industry.goals, a.id) - rank(industry.goals, b.id))
              .map((goal) => (
                <Chip key={goal.id} pressed={brief.goals.includes(goal.id)} onClick={() => update({ goals: toggle(brief.goals, goal.id as GoalId) })}>
                  {goal.label}
                </Chip>
              ))}
          </div>
          {brief.goals.length === 0 ? (
            <p className={styles.hint}>
              None picked, so the plan uses this industry&apos;s usual goal: {GOALS.find((goal) => goal.id === plan.goals[0])?.label}.
            </p>
          ) : null}
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Features</legend>
          <div className={styles.chips}>
            {FEATURES.map((feature) => (
              <Chip key={feature.id} pressed={brief.features.includes(feature.id)} onClick={() => update({ features: toggle(brief.features, feature.id as FeatureId) })}>
                {feature.label}
                {industry.suggestedFeatures.includes(feature.id) ? <span className={styles.suggested} aria-label="suggested">•</span> : null}
              </Chip>
            ))}
          </div>
          <p className={styles.hint}>• suggested for {industry.name.toLowerCase()}</p>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Style</legend>
          <div className={styles.chips}>
            {Array.from(new Set([...STYLE_TAGS, ...brief.styleTags])).map((tag) => (
              <Chip key={tag} pressed={brief.styleTags.includes(tag)} onClick={() => update({ styleTags: toggle(brief.styleTags, tag) })}>
                {tag}
              </Chip>
            ))}
          </div>
          <form
            className={styles.inline}
            onSubmit={(event) => {
              event.preventDefault();
              addCustomStyle();
            }}
          >
            <Input aria-label="Add a style word" placeholder="Add your own…" value={customStyle} maxLength={24} onChange={(event) => setCustomStyle(event.target.value)} />
            <Button type="submit" size="md" disabled={!customStyle.trim()}>
              Add
            </Button>
          </form>
          <p className={styles.hint}>Used to rank reference cases. Leave empty to use what usually fits this industry.</p>
        </fieldset>
      </div>
    </aside>
  );
}

function rank(order: GoalId[], id: GoalId): number {
  const index = order.indexOf(id);
  return index === -1 ? order.length : index;
}

// --- sitemap ----------------------------------------------------------------------

function SitemapView({ plan, onOpen }: { plan: SitePlan; onOpen: (slug: string) => void }) {
  return (
    <div className={styles.stack}>
      <ol className={styles.tree}>
        {plan.pages.map((page, index) => (
          <li key={page.slug} className={styles.node} data-depth={page.depth} style={{ ["--i" as string]: index }}>
            <div className={styles.nodeHead}>
              <span className={styles.nodePath}>/{page.slug === "home" ? "" : page.slug}</span>
              <Badge tone={page.priority === "core" ? "accent" : page.priority === "recommended" ? "neutral" : "caution"}>{page.priority}</Badge>
              {page.addedBy ? <Badge tone="positive">+ {page.addedBy}</Badge> : null}
            </div>
            <h3 className={styles.nodeTitle}>{page.title}</h3>
            <p className={styles.nodePurpose}>{page.purpose}</p>
            <ol className={styles.sections} aria-label={`${page.title} sections`}>
              {page.sections.slice(1, -1).map((kind, i) => (
                <li key={`${kind}-${i}`}>{SECTION_LABELS[kind]}</li>
              ))}
            </ol>
            <button type="button" className={styles.linkButton} onClick={() => onOpen(page.slug)}>
              View wireframe →
            </button>
          </li>
        ))}
      </ol>

      <div className={styles.facts}>
        <div className={styles.fact}>
          <h3 className={styles.factTitle}>Navigation</h3>
          <p className={styles.factLine}>
            <span className={styles.factKey}>Header</span> {plan.navigation.primary.map((slug) => titleOf(plan, slug)).join(" · ") || "none"}
          </p>
          <p className={styles.factLine}>
            <span className={styles.factKey}>Button</span> “{plan.navigation.cta.label}” → /{plan.navigation.cta.target === "home" ? "" : plan.navigation.cta.target}
          </p>
          <p className={styles.factLine}>
            <span className={styles.factKey}>Footer</span> {plan.navigation.footer.map((slug) => titleOf(plan, slug)).join(" · ") || "none"}
          </p>
        </div>
        <div className={styles.fact}>
          <h3 className={styles.factTitle}>Audiences</h3>
          <ul className={styles.bullets}>{plan.industry.audiences.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div className={styles.fact}>
          <h3 className={styles.factTitle}>Measure</h3>
          <ul className={styles.bullets}>{plan.kpis.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      </div>

      <div className={styles.fact}>
        <h3 className={styles.factTitle}>Recommendations</h3>
        <ul className={styles.bullets}>{plan.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  );
}

function titleOf(plan: SitePlan, slug: string): string {
  return plan.pages.find((page) => page.slug === slug)?.title ?? slug;
}

// --- wireframes ---------------------------------------------------------------------

function WireframeView({ plan, pageSlug, onSelect }: { plan: SitePlan; pageSlug: string; onSelect: (slug: string) => void }) {
  const [viewport, setViewport] = useState<WireframeViewport>("desktop");
  const [labels, setLabels] = useState(true);
  const page = plan.pages.find((entry) => entry.slug === pageSlug) ?? plan.pages[0];
  const brand = plan.brief.name?.trim() || "Brand";

  // Our own generated markup; every user string in it is XML-escaped by renderWireframe.
  const wireframe = useMemo(() => renderWireframe(page, { viewport, labels, brand }), [page, viewport, labels, brand]);

  return (
    <div className={styles.wireLayout}>
      <nav className={styles.pageList} aria-label="Pages">
        {plan.pages.map((entry) => (
          <button
            key={entry.slug}
            type="button"
            aria-current={entry.slug === page.slug ? "page" : undefined}
            className={styles.pageButton}
            style={{ paddingLeft: 12 + entry.depth * 14 }}
            onClick={() => onSelect(entry.slug)}
          >
            {entry.title}
          </button>
        ))}
      </nav>

      <div className={styles.wireMain}>
        <div className={styles.toolbar}>
          <Tabs
            label="Viewport"
            value={viewport}
            onChange={setViewport}
            options={[
              { id: "desktop", label: "Desktop 1200" },
              { id: "mobile", label: "Mobile 390" },
            ]}
          />
          <label className={styles.check}>
            <input type="checkbox" checked={labels} onChange={(event) => setLabels(event.target.checked)} /> Labels
          </label>
          <Button size="sm" onClick={() => download(`${fileSlug(plan)}-${page.slug}-${viewport}.svg`, wireframe.svg, "image/svg+xml")}>
            Download SVG
          </Button>
        </div>
        <div className={styles.canvas} data-viewport={viewport}>
          <div className={styles.frame} dangerouslySetInnerHTML={{ __html: wireframe.svg }} />
        </div>
        <p className={styles.hint}>
          {page.title} · {page.sections.length} sections · {wireframe.width}×{wireframe.height}px. The SVG opens in Figma as editable shapes.
        </p>
      </div>
    </div>
  );
}

// --- cases --------------------------------------------------------------------------

function CasesView({
  brief,
  notionCases,
  onNotionCases,
}: {
  brief: SiteBrief;
  notionCases: SiteCase[] | null;
  onNotionCases: (cases: SiteCase[] | null) => void;
}) {
  const [source, setSource] = useState<"sample" | "notion">(notionCases ? "notion" : "sample");
  const library = source === "notion" && notionCases ? notionCases : SAMPLE_CASES;
  const matches = useMemo(() => matchCases(brief, library, { limit: 9 }), [brief, library]);

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <Tabs
          label="Case library"
          value={source}
          onChange={setSource}
          options={[
            { id: "sample", label: `Sample library (${SAMPLE_CASES.length})` },
            { id: "notion", label: notionCases ? `Notion (${notionCases.length})` : "Notion" },
          ]}
        />
      </div>

      {source === "notion" ? <NotionConnect connected={notionCases} onCases={onNotionCases} /> : (
        <Notice tone="info">
          A starter set of well-known public sites, tagged by this project. Connect your own Notion database for a library you curate.
        </Notice>
      )}

      {source === "notion" && !notionCases ? null : matches.length === 0 ? (
        <Notice tone="warning" title="No matching cases">
          Nothing in this library shares the industry, features or style. Add cases tagged with this industry, or loosen the style.
        </Notice>
      ) : (
        <ol className={styles.caseGrid}>
          {matches.map((match, index) => (
            <li key={match.case.id} className={styles.caseCard} style={{ ["--i" as string]: index }}>
              {match.case.image ? (
                // External screenshot from the user's own library; next/image would need its host allow-listed.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={match.case.image} alt="" loading="lazy" referrerPolicy="no-referrer" className={styles.caseImage} />
              ) : (
                <div className={styles.caseImagePlaceholder} aria-hidden="true">
                  {match.case.name.slice(0, 1)}
                </div>
              )}
              <div className={styles.caseBody}>
                <div className={styles.caseHead}>
                  <a href={match.case.url} target="_blank" rel="noreferrer noopener" className={styles.caseName}>
                    {match.case.name} ↗
                  </a>
                  <span className={styles.score} aria-label={`Match score ${match.score} of 100`}>{match.score}</span>
                </div>
                <div className={styles.scoreBar} aria-hidden="true">
                  <span style={{ width: `${match.score}%` }} />
                </div>
                <ul className={styles.reasons}>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                {match.case.notes ? <p className={styles.caseNotes}>{match.case.notes}</p> : null}
                <div className={styles.tags}>
                  {[...match.case.styleTags, ...match.case.features].slice(0, 6).map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NotionConnect({ connected, onCases }: { connected: SiteCase[] | null; onCases: (cases: SiteCase[] | null) => void }) {
  const savedToken = useStored(KEYS.notionToken);
  const savedDb = useStored(KEYS.notionDb);
  const [token, setToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const effectiveToken = token || savedToken;
  const effectiveDb = databaseId || savedDb;

  const connect = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await loadNotionCases(effectiveToken.trim(), effectiveDb.trim(), controller.signal);
      onCases(result.cases);
      if (remember) {
        writeStorage(KEYS.notionToken, effectiveToken.trim());
        writeStorage(KEYS.notionDb, effectiveDb.trim());
      }
      const parts = [`Loaded ${result.cases.length} case${result.cases.length === 1 ? "" : "s"}.`];
      if (result.skipped) parts.push(`${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped (no name or URL).`);
      if (result.truncated) parts.push("Stopped at 500 rows.");
      setNote(parts.join(" "));
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof NotionClientError ? cause.message : "Could not load the Notion database.");
    } finally {
      setBusy(false);
    }
  }, [effectiveDb, effectiveToken, onCases, remember]);

  const forget = () => {
    writeStorage(KEYS.notionToken, null);
    writeStorage(KEYS.notionDb, null);
    setToken("");
    setDatabaseId("");
    onCases(null);
    setNote(null);
  };

  return (
    <div className={styles.connect}>
      <form
        className={styles.connectForm}
        onSubmit={(event) => {
          event.preventDefault();
          void connect();
        }}
      >
        <Field label="Integration token" htmlFor="notion-token" hint={savedToken && !token ? "Using the token saved in this browser." : "Starts with ntn_. Sent to this app's server only to call Notion, never stored there."}>
          <Input id="notion-token" type="password" autoComplete="off" placeholder={savedToken ? "•••••••• (saved)" : "ntn_…"} value={token} onChange={(event) => setToken(event.target.value)} />
        </Field>
        <Field label="Database link or ID" htmlFor="notion-db">
          <Input id="notion-db" placeholder={savedDb || "https://www.notion.so/…"} value={databaseId} onChange={(event) => setDatabaseId(event.target.value)} />
        </Field>
        <div className={styles.inline}>
          <label className={styles.check}>
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember in this browser
          </label>
          <span className={styles.spacer} />
          {savedToken || connected ? (
            <Button type="button" variant="ghost" size="md" onClick={forget}>
              Forget
            </Button>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || !effectiveToken.trim() || !effectiveDb.trim()}>
            {busy ? <Spinner /> : null}
            {connected ? "Reload" : "Connect"}
          </Button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {note ? <Notice tone="success">{note}</Notice> : null}
      </form>

      <details className={styles.details}>
        <summary>How to set up the Notion database</summary>
        <ol className={styles.steps}>
          <li>
            In Notion, create an internal integration at{" "}
            <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer noopener">
              notion.so/profile/integrations
            </a>{" "}
            with read access, and copy its token.
          </li>
          <li>Create a database with the columns below. English or Chinese names both work.</li>
          <li>Open the database, choose ··· → Connections, and add your integration.</li>
          <li>Copy the database link from the browser and paste it above.</li>
        </ol>
        <table className={styles.schema}>
          <thead>
            <tr>
              <th>Column</th>
              <th>Type</th>
              <th>Accepted names</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Name</td><td>Title</td><td>{NOTION_PROPERTY_ALIASES.name.join(", ")}</td></tr>
            <tr><td>URL</td><td>URL</td><td>{NOTION_PROPERTY_ALIASES.url.join(", ")}</td></tr>
            <tr><td>Industry</td><td>Select</td><td>{NOTION_PROPERTY_ALIASES.industry.join(", ")}</td></tr>
            <tr><td>Style</td><td>Multi-select</td><td>{NOTION_PROPERTY_ALIASES.styleTags.join(", ")}</td></tr>
            <tr><td>Features</td><td>Multi-select</td><td>{NOTION_PROPERTY_ALIASES.features.join(", ")}</td></tr>
            <tr><td>Screenshot</td><td>Files (optional)</td><td>{NOTION_PROPERTY_ALIASES.image.join(", ")}</td></tr>
            <tr><td>Notes</td><td>Text (optional)</td><td>{NOTION_PROPERTY_ALIASES.notes.join(", ")}</td></tr>
          </tbody>
        </table>
        <p className={styles.hint}>
          Industry values can be an id (saas), an English name (Real estate) or a Chinese name (餐飲). Features match the planner&apos;s ids: {FEATURES.map((feature) => feature.id).join(", ")}.
        </p>
      </details>
    </div>
  );
}

// --- Claude ---------------------------------------------------------------------------

const MCP_SNIPPET = `git clone https://github.com/Pinyi333/Open-source-Web-Design-Toolkit.git
cd Open-source-Web-Design-Toolkit/mcp && npm install && npm run build
claude mcp add web-design-toolkit -- node "$PWD/dist/mcp/src/index.js"`;

function ClaudeView({ plan }: { plan: SitePlan }) {
  const savedKey = useStored(KEYS.claudeKey);
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_CLAUDE_MODEL);
  const [language, setLanguage] = useState<ReviewLanguage>("en");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<PlanReview | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const key = apiKey || savedKey;

  const run = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    try {
      const result = await requestPlanReview({ apiKey: key, plan, model, language, context, signal: controller.signal });
      setReview(result);
      if (remember) writeStorage(KEYS.claudeKey, key.trim());
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof ClaudeError ? cause.message : "The review failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.stack}>
      <div className={styles.twoUp}>
        <div className={styles.fact}>
          <p className={styles.eyebrow}>Option A · no key needed</p>
          <h3 className={styles.factTitle}>Use it from your own Claude (MCP)</h3>
          <p className={styles.factText}>
            Register this toolkit&apos;s MCP server with Claude Code or Claude Desktop and ask Claude to plan a site. It calls the same planner through the <code>plan_site</code>, <code>generate_wireframe</code> and <code>match_cases</code> tools, on your own subscription.
          </p>
          <CodeBlock code={MCP_SNIPPET} />
        </div>

        <form
          className={styles.fact}
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <p className={styles.eyebrow}>Option B · your API key, in this browser</p>
          <h3 className={styles.factTitle}>Ask Claude to review this plan</h3>
          <div className={styles.formStack}>
            <Field label="Anthropic API key" htmlFor="claude-key" hint={savedKey && !apiKey ? "Using the key saved in this browser." : "Sent straight from your browser to api.anthropic.com. This app's server never sees it. Usage is billed to your account."}>
              <Input id="claude-key" type="password" autoComplete="off" placeholder={savedKey ? "•••••••• (saved)" : "sk-ant-…"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            </Field>
            <div className={styles.selectRow}>
              <Field label="Model" htmlFor="claude-model">
                <select id="claude-model" className={styles.select} value={model} onChange={(event) => setModel(event.target.value)}>
                  {CLAUDE_MODELS.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Reply in" htmlFor="claude-lang">
                <select id="claude-lang" className={styles.select} value={language} onChange={(event) => setLanguage(event.target.value as ReviewLanguage)}>
                  <option value="en">English</option>
                  <option value="zh-TW">繁體中文</option>
                </select>
              </Field>
            </div>
            <Field label="Anything Claude should know (optional)" htmlFor="claude-context">
              <Textarea id="claude-context" rows={3} className={styles.plainText} placeholder="Audience, brand, constraints, competitors…" value={context} maxLength={4000} onChange={(event) => setContext(event.target.value)} />
            </Field>
            <div className={styles.inline}>
              <label className={styles.check}>
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember key in this browser
              </label>
              <span className={styles.spacer} />
              {savedKey ? (
                <Button type="button" variant="ghost" onClick={() => writeStorage(KEYS.claudeKey, null)}>
                  Forget
                </Button>
              ) : null}
              <Button type="submit" variant="primary" disabled={busy || !key.trim()}>
                {busy ? <Spinner /> : null}
                {busy ? "Reviewing…" : "Review plan"}
              </Button>
            </div>
            {error ? <Notice tone="error">{error}</Notice> : null}
          </div>
        </form>
      </div>

      {review ? <ReviewResult review={review} /> : null}
    </div>
  );
}

function ReviewResult({ review }: { review: PlanReview }) {
  return (
    <div className={styles.review}>
      {review.summary ? <p className={styles.reviewSummary}>{review.summary}</p> : null}
      {review.heroCopy.headline ? (
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Suggested hero</p>
          <p className={styles.heroHeadline}>{review.heroCopy.headline}</p>
          {review.heroCopy.subheadline ? <p className={styles.factText}>{review.heroCopy.subheadline}</p> : null}
          {review.heroCopy.cta ? <span className={styles.heroCta}>{review.heroCopy.cta}</span> : null}
        </div>
      ) : null}
      {review.pageChanges.length ? (
        <div className={styles.fact}>
          <h3 className={styles.factTitle}>Changes to the plan</h3>
          <ul className={styles.changeList}>
            {review.pageChanges.map((change, index) => (
              <li key={index}>
                <span className={styles.nodePath}>/{change.page}</span>
                <p className={styles.changeText}>{change.change}</p>
                {change.why ? <p className={styles.hint}>{change.why}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={styles.twoUp}>
        {review.contentIdeas.length ? (
          <div className={styles.fact}>
            <h3 className={styles.factTitle}>Content ideas</h3>
            <ul className={styles.bullets}>{review.contentIdeas.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        ) : null}
        {review.risks.length ? (
          <div className={styles.fact}>
            <h3 className={styles.factTitle}>Risks</h3>
            <ul className={styles.bullets}>{review.risks.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// --- export -----------------------------------------------------------------------------

function ExportView({ plan }: { plan: SitePlan }) {
  const markdown = useMemo(() => planToMarkdown(plan), [plan]);
  const json = useMemo(
    () => JSON.stringify({ brief: plan.brief, goals: plan.goals, pages: plan.pages, navigation: plan.navigation, kpis: plan.kpis, recommendations: plan.recommendations }, null, 2),
    [plan],
  );

  return (
    <div className={styles.stack}>
      <div className={styles.toolbar}>
        <CopyButton value={markdown} label="Copy Markdown" size="md" />
        <Button onClick={() => download(`${fileSlug(plan)}-plan.md`, markdown, "text/markdown")}>Download .md</Button>
        <Button onClick={() => download(`${fileSlug(plan)}-plan.json`, json, "application/json")}>Download .json</Button>
      </div>
      <p className={styles.hint}>Markdown pastes cleanly into Notion, a GitHub issue, or a conversation with Claude.</p>
      <CodeBlock code={markdown} />
    </div>
  );
}
