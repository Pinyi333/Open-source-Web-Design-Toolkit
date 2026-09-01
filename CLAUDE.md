# Working on this project

## Keep `hand-off.md` current

`hand-off.md` in the repo root is the working state of this project — what is
built, what is decided, what is broken, what is next. **Read it at the start of
a session and update it before finishing one**, whenever the session changes the
answer to "where are we?": a commit lands, a decision is made, a limitation is
found, or an open item is finished.

The file itself explains what belongs in it. Two things matter most:

- **Record decisions with their reasons**, so they are not re-litigated later.
- **Record what was *not* verified**, not just what works. The most valuable
  line in that file is an admission that a code path was never tested against a
  real site.

Keep it accurate rather than exhaustive. A stale hand-off is worse than none.

## Architecture rule

**All analysis logic goes in `lib/`, as pure functions with no DOM and no React
import.** That is what lets `tests/` cover the real logic without rendering
anything, and it is what would make an MCP wrapper cheap. If a colour
calculation or a parsing routine is being written inside a `.tsx` file, it
belongs in `lib/` with a test instead.

Reuse before writing: `lib/color/` (conversion, WCAG contrast, quantization,
export), `lib/typography/` (CSS reader, length parsing, scale detection),
`lib/responsive/` (device presets, viewport maths), `lib/net/` (URL guard,
fetcher), `lib/tools.ts` (the registry the whole UI reads from).

## `lib/net/` needs extra care

`/api/fetch-site` fetches user-supplied URLs on the server and is the only real
attack surface here. If a change touches the URL guard, the redirect handling or
the fetch limits:

- Add cases to `tests/url-guard.test.ts`. It is table-driven; a row is cheap.
- The address check must run **after DNS resolution** and again on **every**
  redirect hop. Both have already caught real bugs.
- Never make the guard's behaviour depend on build-time state. The
  `WDT_DISABLE_URL_FETCH` flag is read per request precisely so an operator
  cannot set it, skip a rebuild, and wrongly believe the endpoint is closed.

## Dependencies

Runtime dependencies are `next`, `react` and `react-dom`. That is the whole
list, and it is deliberate — the CSS reader, colour maths, icons and UI
primitives were all written by hand because each was a few dozen lines.
Adding a runtime dependency is a decision worth discussing, not a default.

Pinned on purpose: **TypeScript 5.9** (TS 7's ecosystem support is not there
yet) and **ESLint 9** (every Next lint plugin peer-requires `<= 9`; eslint 10
produces an invalid dependency tree).

## Before saying work is done

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

All four must pass — CI runs them on Node 20 and 22. For UI changes, also open
the page in a browser: the three real bugs found in this project so far were all
invisible to the test suite and obvious the moment the app was actually used.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
