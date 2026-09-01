# Hand-off

Working state of this project, kept current so any session — or any person —
can pick it up without re-reading the whole history.

**Last updated:** 2026-09-01

> Keep this file up to date — see "Updating this file" at the bottom. A Stop
> hook in `.claude/settings.json` says so out loud when commits have landed
> since this file was last committed, so no version number is tracked here.

---

## Where things stand

**v0.1 is built, tested and pushed. The MCP server now exists and is
smoke-tested. Not yet deployed anywhere, and the MCP package is not yet
published to npm.**

All three v1 tools work end to end and were driven in a real browser, not just
unit tested. 189 tests pass; lint, typecheck and build are clean, verified from
a fresh clone. As of 2026-09-01 the URL fetcher has also been verified against
real websites from a real machine (see below).

The browser pass on 2026-09-01 (Playwright + Chromium, production build) found
and fixed **one real bug in the quantizer** that no test covered, and produced
the README screenshots. Details in History.

| | Status |
| --- | --- |
| Code | Complete for v0.1 |
| Tests | 189 passing, 4 files |
| CI | GitHub Actions, Node 20 + 22 — **has never run yet** (no push to a repo with Actions enabled observed) |
| Deployment | **None.** Not on Vercel or anywhere else |
| Public demo URL | **Does not exist** — README has a deploy button but no live link |
| Default branch | `main` exists, but **GitHub's default branch setting has not been changed** |

### Branches

Both point at the same commit. `main` was created so the `blob/main/...` links
in the README, home page and issue templates resolve.

```
main
claude/web-design-toolkit-oss-l8kifj   ← work has been pushed to both
```

---

## What exists

```
app/            9 files, ~1950 lines   routes + the one API endpoint
components/     4 files,  ~860 lines   design system and shared primitives
lib/           13 files, ~2530 lines   all logic, framework-free
tests/          4 files, ~1120 lines   189 tests
```

Runtime dependencies are **`next`, `react`, `react-dom` and nothing else**.
The CSS reader, colour maths, icons and UI primitives are all hand-written.
Node >= 20.9.

### The three tools

- **Color Extractor** (`app/tools/color-extractor/`) — median-cut quantization,
  3–12 colours, HEX/RGB/HSL/OKLCH, WCAG contrast plus a full pair matrix,
  exports to CSS / Tailwind v4 / JSON / W3C design tokens. Entirely
  client-side; the image never leaves the browser.
- **Typography Analyzer** (`app/tools/typography-analyzer/`) — URL mode or
  paste mode, both feeding the same analyzer. Font inventory, modular-scale
  detection with a consistency score, a suggested scale, and 8 kinds of
  readability/performance/structure finding.
- **Responsive Tester** (`app/tools/responsive-tester/`) — 12 device presets
  plus custom widths, reads the target site's own media queries to offer real
  breakpoints, and pre-checks `X-Frame-Options` / CSP so a blocked site says
  why instead of showing a blank frame.

### Session support files

- **`CLAUDE.md`** — loaded into every Claude Code session in this repo. Carries
  the architecture rule, the `lib/net/` cautions, the pinned-version reasons,
  and the instruction to keep this file current.
- **`.claude/settings.json`** — a Stop hook that compares `HEAD` against the
  last commit touching `hand-off.md` and prints a reminder when they differ.
  Silent when up to date, never blocks, always exits 0.

### Architecture rule that matters

**All logic lives in `lib/` as pure functions with no DOM and no React.** This
is why `tests/` can cover the real logic without rendering anything, and it is
what makes the MCP idea below cheap to build. Do not put analysis logic in a
`.tsx` file.

### The one server-side endpoint

`POST /api/fetch-site` fetches a user-supplied URL so the browser-side tools can
read sites that send no CORS headers. It is the only real attack surface:

- http/https only; private, loopback, link-local, CGNAT and multicast blocked
  **after DNS resolution**, IPv4 and IPv6 including IPv4-mapped
- redirects followed manually, 3 hops max, **re-checked on every hop**
- 8s per request / 12s total, 2 MB HTML, 1 MB per stylesheet, 10 sheets max
- `maxDuration = 20` so the platform does not cut us off before our own timeout
- `WDT_DISABLE_URL_FETCH=1` closes it entirely (see below)

Guard code is `lib/net/url-guard.ts`; tests are table-driven in
`tests/url-guard.test.ts`. **Add a row there for any change to this area.**

---

## Decisions already made — don't re-litigate

| Decision | Why |
| --- | --- |
| TypeScript 5.9, not 7.x | TS 7 is the native rewrite; `eslint-config-next`'s plugin ecosystem hasn't caught up |
| ESLint 9, not 10 | Every Next lint plugin peer-requires `<= 9`; eslint 10 produces an invalid dependency tree |
| No UI / icon / CSS-parser library | Each was a few dozen lines to write for what we needed |
| Dark theme default, `useSyncExternalStore` for the preference | Setting state in an effect is a cascading render and the lint rule is right |
| Two tool pages are `force-dynamic` | So `WDT_DISABLE_URL_FETCH` is read per request. Prerendering it would let someone set the variable, skip a rebuild, and believe the endpoint was closed while it was open |
| Tools do **not** call an LLM | Colour extraction, CSS parsing and iframes are deterministic. Adding an LLM would trade instant/free/reproducible for keyed/paid/variable |

---

## Known limitations — stated honestly, not bugs to "fix"

1. **The per-IP rate limit is best-effort only.** It lives in process memory,
   so it resets on redeploy and is per-instance. On serverless it is close to
   useless. Documented in `SECURITY.md`. A real deployment needs a WAF.
2. ~~A happy-path fetch of a real site was never verified.~~ **Verified
   2026-09-01 on a real machine**: `POST /api/fetch-site` handled
   `https://example.com` (HTML + 1 sheet), `http://github.com` (redirect to
   https followed, 573 KB HTML, 40 linked sheets correctly capped at 10 with a
   note) and MDN (27 sheets incl. inline). `169.254.169.254` still refused
   with 400. **The browser UI driving these fetches has now been exercised
   too** — see "Verified in a browser" below — though not against a *reachable*
   external site, because this sandbox's egress proxy answers 403 for every
   outbound host. What the UI showed for that 403 was correct.
3. **Cross-origin frames cannot scroll in sync.** Not a defect; the README and
   UI deliberately do not claim it.
4. **The MCP server was smoke-tested over raw JSON-RPC, not from a real MCP
   client.** All six tools returned correct results over stdio (including the
   red/blue regression image, a live URL fetch, and the guard refusing
   loopback), but nobody has yet registered it in Claude Code / another agent
   and called it from there.

5. **A palette swatch is the *average* of its box, so the hex it reports may
   not appear anywhere in the image.** Observed while shooting the README
   screenshot: a mockup whose hero panel is `#4361ee` with white text on it
   comes back as `#3b86cc`, because the box holding those blues is averaged
   with the text pixels. This is how textbook median cut behaves and every
   swatch is still a real region — but for a tool whose output people paste
   into a stylesheet, returning the brand colour itself (the box's modal or
   median colour) would arguably be more useful. **Not changed:** it is a
   behaviour decision with real trade-offs, not a bug, and it deserves a
   deliberate choice rather than a drive-by one.

6. **Error notices are not announced to assistive technology.** `Notice` in
   `components/ui/index.tsx` renders a plain `<div>`, so a screen reader user
   who submits a URL that the guard refuses gets no announcement. The message
   itself is correct and visible. Untouched for the same reason as above: it
   is a shared primitive and the fix should be verified against a real screen
   reader, which was not possible here.

7. **A failed load leaves the previous frames on screen.** In the Responsive
   Tester, typing an invalid URL shows the error but keeps the previously
   loaded iframes rendered beneath it. Arguably right (you keep your last
   preview) and the error text is unambiguous, so it was left alone.

---

## Verified in a browser — 2026-09-01

Driven with Playwright + Chromium against `npm run build && npm start`, not
`next dev`. What was actually exercised, so the next session knows what it does
*not* need to re-check:

| Checked | Result |
| --- | --- |
| Home page, nav, tool cards | Renders; 7 tool links |
| Theme toggle | System → light → persisted across reload → dark → back to system when `localStorage` is cleared. Correct in both directions |
| Colour Extractor, real file upload | Palette, swatch table, contrast pills, contrast matrix and all four export tabs all correct. **This is where the quantizer bug surfaced** |
| Colour Extractor, palette-size slider | Re-quantizes without re-reading the file |
| Colour Extractor, bad input | A `.txt` file → "not an image"; a fully transparent PNG → "Every pixel in that image is transparent" |
| Typography Analyzer, paste mode | 6 findings on a deliberately flawed stylesheet, incl. body under 16px, line-height 1.35, and an h1→h3 skip. Scale detection and the family inventory both correct |
| Typography Analyzer, URL mode failures | Guard refusals reach the UI verbatim: `localhost` → "reserved hostname"; `169.254.169.254` → "link-local / cloud metadata"; junk → "not a valid URL"; empty → button disabled |
| Responsive Tester, real load | Three live iframes at 393 / 820 / 1280 CSS px, each honouring the target's own media queries (the app's own header collapses to "WDT" in the phone frame). Scale labels 97% / 46% / 30% correct |
| Responsive Tester, failures | `ftp://` → "Only http and https URLs can be fetched"; a fetch failure → "…403. The preview below may still load.", frames still render |
| Console / page errors | None on any page. The only console noise is Next.js aborting its own prefetches on navigation |

**Not checkable here:** a fetch of a *reachable* external site. This sandbox's
egress proxy answers 403 for every outbound host, and its own container address
is in `192.0.2.0/24`, which the guard correctly refuses as the documentation
range. The happy path was verified from a real machine earlier the same day
(limitation 2 above).

### The README screenshots

`docs/screenshots/*.png` — three 1400px-wide PNGs, dark theme, taken from the
production build in the same browser pass. Regenerating them means driving the
app again: Playwright is deliberately **not** a devDependency (the four-package
dependency list is a selling point), so install it outside the repo and point
`chromium.launch({ executablePath })` at a browser you already have. The Colour
Extractor shot uses a generated flat-UI mockup rather than a real screenshot,
so nothing copyrighted is committed.

If the UI changes shape, retake them — a screenshot that no longer matches the
app is worse than none, same rule as this file.

## Open items

### Needs a person (cannot be done from a session)

- [ ] **Set the default branch to `main`.** `gh repo edit
      Pinyi333/Open-source-Web-Design-Toolkit --default-branch main` does it
      in one line (a session tried on 2026-09-01; the permission system
      blocked repo-settings changes, so it needs a human terminal).
- [ ] **Deploy to Vercel.** Deploy button is in the README; the app needs no
      configuration. **Set `WDT_DISABLE_URL_FETCH=1` in Vercel's environment
      variables** — a public deployment is otherwise an open proxy to the
      public internet (the SSRF guard only stops it reaching private networks).
- [ ] **Paste the deployed URL back**, so it can be added to both READMEs.
- [ ] **Publish `web-design-toolkit-mcp` to npm** (`cd mcp && npm publish`;
      `prepublishOnly` builds). Publishing needs an npm account and 2FA, so a
      person has to run it.

### MCP server — built 2026-09-01, decisions made

Lives in `mcp/` as **its own package**, so the web app's runtime dependency
list stays `next`/`react`/`react-dom` only. Six tools: `extract_palette`,
`convert_color`, `check_contrast`, `export_palette`, `analyze_typography`
(URL *or* raw html/css), `list_device_presets`. See `mcp/README.md`.

Decisions, with reasons:

- **Dependencies (mcp package only): `@modelcontextprotocol/sdk`, `zod`,
  `pngjs`, `jpeg-js`.** The SDK and zod are unavoidable for MCP; pngjs/jpeg-js
  are small pure-JS decoders — writing PNG inflate + JPEG DCT by hand fails
  the "few dozen lines" test that justified hand-writing everything else.
- **`tsc` compiles `../lib` into `mcp/dist` verbatim** (`rootDir: ".."`,
  `module: nodenext` emitting CJS, which is what lets lib's extensionless
  relative imports work unchanged). No bundler, no path rewriting.
- **The URL tool keeps the SSRF guard as-is**, so localhost cannot be fetched
  even locally. Deliberate: safe by default, one behaviour everywhere, and an
  agent analyzing a local site can pass `html`/`css` directly.
- Root `tsconfig`/`eslint` exclude `mcp/` (own tsconfig + deps); CI got an
  extra step that builds it on both Node versions.

### Not started

- [ ] The six planned tools in `ROADMAP.md` (Screenshot Analyzer, Design Token
      Generator, CSS Generator, SVG Animation Generator, Lottie Playground,
      AI Design Analyzer). Each is self-contained; `docs/ADDING-A-TOOL.md`
      walks through adding one.
- [ ] GIFs in the README. Static screenshots are in now (`docs/screenshots/`,
      three PNGs, ~140 KB each; how to retake them is noted above); a capture of
      the palette slider or the frame switcher would still add something.
- [ ] A full bug-hunt pass over the codebase was offered but never run. The
      browser pass on 2026-09-01 covered the three tool UIs and their error
      paths, not `lib/` line by line.
- [ ] Register the MCP server in a real agent (e.g. `claude mcp add`) and call
      the tools from there — the missing verification step named above.
- [x] ~~Drive the web UI in a browser.~~ Done 2026-09-01 — see "Verified in a
      browser" above. Still worth doing on a real machine one day for the one
      thing this sandbox cannot reach: a live external site in URL mode.

---

## Background: the Codex for OSS goal

This repo was started partly to apply to OpenAI's **Codex for Open Source**
programme (6 months of ChatGPT Pro for OSS maintainers).

**Assessed 2026-09-01: it would not pass in its current state.** The programme's
stated criteria are core maintainer of a public GitHub project with roughly
**1,000+ stars**, and demonstrated *repository usage*, *ecosystem importance*
and *active maintenance*. The application form asks for stars, monthly
downloads and importance. This project has zero of each and one day of history.

There is an explicit "apply anyway if you're ecosystem-important" clause, but
that still requires importance, which comes from users.

**Implication for planning:** what moves this forward is **distribution**, not
more features or more repo polish — the repo quality is already well past the
bar. Shipping the MCP server, publishing to a registry, and posting it where
the audience is are the things that count. Applying now costs nothing and is
worth doing to see the process, but expect a no.

The project stands on its own as a portfolio piece regardless, which was always
the second goal.

---

## Commands

```bash
npm install          # Node >= 20.9
npm run dev          # http://localhost:3000
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest, 189 tests
npm run build        # production build
```

CI runs all four on Node 20 and 22.

---

## History

| Commit | What |
| --- | --- |
| `c24a5e2` | Project scaffolding and the `lib/` analysis libraries |
| `53bc251` | Design system, shared UI, and the three tool pages |
| `ae1d6d4` | Fixed 3 real bugs found by driving the app in a browser |
| `b581b8d` | README (EN + zh-TW), licence, contributing, security, roadmap, CI |
| `0dbab2c` | Regenerated the lockfile from a clean install |
| `477c4c3` | `maxDuration` for deployment; Vercel deploy button |
| `b522d24` | `WDT_DISABLE_URL_FETCH` so a public deployment can close the endpoint |
| 2026-09-01 | MCP server in `mcp/`; real-site fetch verified from a real machine |
| 2026-09-01 | Browser pass: fixed the median-cut early-exit bug, added README screenshots |

Bugs the tests and browser runs caught, worth remembering because they were all
silent failures:

- **Signed 32-bit overflow in the CIDR match** — `&` returns a signed int, so
  every range with the high bit set (`192.168/16`, `172.16/12`, and the cloud
  metadata address `169.254.169.254`) failed open.
- **`localhost:3100` parsed as the scheme `localhost:`** — the single most
  common input to the Responsive Tester was rejected as an unsupported protocol.
- **Body font-size read from `:root` instead of `body`** — a page with
  `:root { font-size: 16px }` above `body { font-size: 13px }` reported 16px.
- **Median cut split at the median index** — tore a run of identical pixels in
  half, so 60% red + 40% blue reported purple.
- **Median cut stopped splitting at the first indivisible box** — when the
  *largest* box was one solid colour it could not be split, and the loop
  `break`ed, abandoning every other splittable box with it. A flat design image
  of five bands returned three swatches when six were asked for, silently
  merging two pairs of unrelated colours. Photographs almost never trigger it;
  screenshots, mockups and logos — the tool's actual input — trigger it
  immediately. Found by driving the real UI, not by any test. Fixed by
  retiring the unsplittable box and continuing (`splittable` flag), with three
  regression tests.

---

## Updating this file

Update it at the end of any session that changes the answer to "where are we?" —
in practice, whenever a commit lands, a decision is made, a limitation is found,
or an open item is finished.

Keep it accurate rather than complete: a stale hand-off is worse than none.
Specifically —

- Change **Last updated** and the commit hash at the top.
- Move finished work out of "Open items" and into "History".
- Record *decisions and their reasons*, so they don't get re-litigated.
- Record limitations honestly, including things that were never verified. The
  "never tested a real URL fetch" note above is the most valuable line in this
  file precisely because it is an admission.
- Delete anything no longer true. Do not let this become a changelog; `git log`
  already is one.
