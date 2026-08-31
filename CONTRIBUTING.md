# Contributing

Thanks for taking a look. This project is small on purpose, and the bar for
contributing is correspondingly low: if something is broken, or a tool you want
is on the roadmap and not built yet, a pull request is welcome.

## Getting set up

```bash
git clone https://github.com/Pinyi333/Open-source-Web-Design-Toolkit.git
cd Open-source-Web-Design-Toolkit
npm install
npm run dev
```

Node 20 or newer. There is nothing else to configure — no environment
variables, no database, no API keys.

## Before you open a pull request

Run what CI runs:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four must pass. CI runs them on Node 20 and 22.

## How the code is organised

The important rule: **analysis logic goes in `lib/`, not in a component.**

Everything under `lib/` is pure functions with no DOM and no React dependency.
That is what makes it testable, and it is why `tests/` can cover the real logic
without rendering anything. If you find yourself writing a colour calculation
or a parsing routine inside a `.tsx` file, it belongs in `lib/` with a test.

```
app/            routes — one page per tool, plus /api/fetch-site
components/     the design system and shared primitives
lib/            all the logic, framework-free
tests/          Vitest
```

## Adding a tool

This is the most useful contribution, and there is a walkthrough:
**[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md)**.

The short version: add an entry to `lib/tools.ts`, create
`app/tools/<slug>/page.tsx`, put the logic in `lib/<area>/`, and write tests
for it. The home page, the navigation and the roadmap all read from the
registry, so they update themselves.

## Style

There is no separate style guide — match the code already there:

- **Comments explain why, not what.** `// Cut at the value boundary nearest the
  median rather than at the median index itself` earns its place; `// loop over
  the pixels` does not.
- **Prefer no dependency.** This project has three runtime dependencies and
  would like to keep it that way. A CSS parser, an icon library and a colour
  library were all considered and all written by hand instead, because each was
  a few dozen lines for what we needed.
- **Handle the failure case.** Parsing functions return `null` rather than
  throwing, because most of what they parse is untrusted input from someone
  else's website.
- TypeScript strict mode is on and there are no `any`s in the codebase. Please
  keep it that way.

## Touching `lib/net/`

`/api/fetch-site` fetches URLs on the server, which makes it the one part of
this app where a mistake has real consequences. If your change touches the URL
guard, the redirect handling or the fetch limits:

- Add cases to `tests/url-guard.test.ts`. It is table-driven; adding a row is
  cheap.
- Remember that the address check must run **after** DNS resolution and again
  on **every** redirect hop. Both of those have caught real bugs already.
- If you are unsure whether something is safe, say so in the pull request. A
  question is better than a quiet assumption.

## Reporting bugs

Open an issue with what you did, what you expected and what happened. For the
Typography Analyzer and Responsive Tester, the URL you were analyzing is
usually the single most useful detail.

Security issues go to [SECURITY.md](SECURITY.md) instead — please do not open a
public issue for those.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
