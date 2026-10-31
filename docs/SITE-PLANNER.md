# Site Planner

The Site Planner turns a short brief into a website architecture you can look
at: a sitemap, the sections of every page, wireframes, and reference sites to
learn from. It is built in three layers, and only the first is required.

| Layer | What it does | Needs |
| --- | --- | --- |
| Planner | Industry template + goals + scale + features → sitemap, sections, navigation, KPIs, advice, wireframes | Nothing. Runs in the browser, deterministic, free |
| Case library | Ranks reference sites against the brief and says why | Built-in sample, or your own Notion database |
| Claude | Reviews the plan and proposes changes and copy | Your own Claude: MCP (no key) or your own API key |

Logic lives in `lib/planner/` as pure functions, tested in
`tests/planner.test.ts`. The page is `app/tools/site-planner/`, the MCP tools are
in `mcp/src/planner-tools.ts`.

## How a plan is built

1. **Start from the industry template** (`lib/planner/industries.ts`). Each
   template lists pages with a priority (`core`, `recommended`, `optional`)
   and the sections of each page, top to bottom.
2. **Keep pages by scale.** `small` keeps core pages, `medium` adds
   recommended, `large` adds optional. `landing` folds everything into one
   page and ends it on a call to action.
3. **Add what goals and features need.** An online shop adds shop, product and
   cart pages; a blog adds an index and an article page; "Generate enquiries"
   adds a contact page if no page has a form yet; "Raise donations" adds a
   donate page. Nothing is added twice: a restaurant template that already has
   a booking page does not get a second one for the booking feature.
4. **Derive navigation.** Up to six top-level, non-utility pages go in the
   header; the header button points at the page that serves the primary goal.

The templates are opinions. If one is wrong for your market, change it in a
pull request. That is cheaper than prompting around it every time.

## Wireframes

`renderWireframe` in `lib/planner/wireframe.ts` draws each section kind from a
small recipe of grey boxes at 1200px or 390px wide and returns a standalone
SVG. It renders inline in the app, downloads as a file, and opens in Figma or
Illustrator as editable shapes. All text in it is XML-escaped.

## Notion case library

1. Create an internal integration at
   [notion.so/profile/integrations](https://www.notion.so/profile/integrations)
   with read content access, and copy its token (it starts with `ntn_`).
2. Create a database with these columns. English or Traditional Chinese column
   names both work; the first match wins.

   | Column | Type | Accepted names |
   | --- | --- | --- |
   | Name | Title | Name, Title, 名稱, 網站名稱, 標題 |
   | URL | URL | URL, Link, Website, 網址, 連結 |
   | Industry | Select | Industry, Category, 產業, 類型, 產業類型 |
   | Style | Multi-select | Style, Styles, Style tags, Tags, 風格, 風格標籤 |
   | Features | Multi-select | Features, Feature, 功能 |
   | Screenshot | Files (optional) | Screenshot, Image, Cover, 截圖, 圖片 |
   | Notes | Text (optional) | Notes, Description, 備註, 說明 |

   **Industry** may be an id (`saas`), an English name (`Real estate`), a
   Chinese name (`餐飲`) or a common synonym (`clinic`, `NGO`). **Features**
   score when they use the planner's ids: `blog`, `booking`, `shop`,
   `membership`, `search`, `multilingual`, `newsletter`, `live-chat`. Rows
   without a name or a valid http(s) URL are skipped and counted.
3. Open the database, choose **··· → Connections**, and add the integration.
4. In the web app: **Cases → Notion**, paste the token and the database link.
   In the MCP server: set `NOTION_TOKEN` and `NOTION_CASES_DATABASE_ID`.

Up to 500 rows are read (five pages of 100).

### Where the token goes

- **Web app:** the browser sends the token to this app's own
  `POST /api/notion/cases`, because Notion's API sends no CORS headers. The
  route calls `https://api.notion.com/v1/databases/<id>/query` and nothing
  else; the id is reduced to 32 hex characters first, so user input cannot
  change the host or path. The token is used for that one request, never
  stored, never logged. It stays in the browser's `localStorage` only if the
  visitor ticks "Remember in this browser".
- **MCP server:** read from the server's environment, so it never appears in a
  conversation with the agent.

If you deploy a public copy, the Notion route can only ever reach Notion with
the visitor's own token, so it is not an open proxy. It has the same
best-effort in-memory rate limit as `/api/fetch-site`.

## Using your own Claude

**Option A: MCP (recommended, no API key).** Register the MCP server with
Claude Code or Claude Desktop (see [mcp/README.md](../mcp/README.md)) and ask in
plain language, for example "plan a bilingual website for a dental clinic in
Taipei and save the booking page wireframe to ~/Desktop/book.svg". Claude calls
`plan_site`, `generate_wireframe` and `match_cases`, and refines the result
itself, on your existing Claude plan.

**Option B: your API key in the browser.** On the Claude tab, paste an
Anthropic API key, choose a model and a reply language, and press "Review
plan". The browser calls `https://api.anthropic.com/v1/messages` directly with
the `anthropic-dangerous-direct-browser-access` header, so the key never
reaches this app's server; usage is billed to the key's account. Claude gets
the plan as Markdown and returns JSON with a summary, page changes, hero copy,
content ideas and risks. The call uses plain `fetch` rather than the Anthropic
SDK, to keep the app's runtime dependencies at Next and React only.

Nothing in this repository contains a key or token. Every credential is
supplied by whoever runs the tool.
