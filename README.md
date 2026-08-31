# Web Design Toolkit

[![CI](https://github.com/Pinyi333/Open-source-Web-Design-Toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Pinyi333/Open-source-Web-Design-Toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)

A small set of web design utilities that run in your browser. No account, no
upload quota, no telemetry — clone it and run it.

繁體中文說明請見 **[README.zh-TW.md](README.zh-TW.md)**.

---

## The tools

### Color Extractor

Drop in a screenshot, mockup or photo and get a palette back.

- Median-cut quantization, so each swatch is a real region of the image rather
  than one sampled pixel. Adjustable from 3 to 12 colors.
- HEX, RGB, HSL and OKLCH for every swatch, each one click-to-copy.
- WCAG contrast against white and black, plus a full matrix of every pair in
  the palette — the question you actually have when picking two colors.
- Exports to CSS custom properties, a Tailwind v4 `@theme` block, JSON, and
  [W3C design tokens](https://tr.designtokens.org/format/).

**The image never leaves your browser.** It is decoded into a canvas and read
back locally; nothing is uploaded.

### Typography Analyzer

Point it at a URL, or paste in HTML and CSS.

- Inventories font families, sizes, weights, line heights and letter spacing.
- Identifies each family as a Google Font, self-hosted `@font-face`, or a
  system stack — and optionally previews it, loading the font only when you
  ask.
- Works out whether the sizes follow a modular scale, names the ratio when
  they do, and scores the consistency when they do not.
- Suggests a scale you can paste straight into a stylesheet.
- Flags the problems worth fixing: body copy under 16px, cramped line heights,
  a sprawling set of one-off sizes, too many web fonts, a missing `<h1>`,
  skipped heading levels, a missing viewport meta tag.

The paste mode runs entirely in your browser and works on any site, including
ones that refuse to be fetched.

### Responsive Tester

Load a page across phone, tablet and desktop frames at once.

- Twelve device presets plus custom widths, portrait or landscape.
- Reads the site's **own CSS media queries** and offers a frame at each real
  breakpoint, rather than guessing at round numbers.
- Checks `X-Frame-Options` and CSP `frame-ancestors` before loading, so when a
  site cannot be embedded you get told why instead of staring at a blank box.
- Warns when the page has no viewport meta tag, since the frames will not match
  a real phone in that case.

Each frame is a real iframe at that CSS width, so the site's own media queries
decide what it renders.

---

## Quick start

```bash
git clone https://github.com/Pinyi333/Open-source-Web-Design-Toolkit.git
cd Open-source-Web-Design-Toolkit
npm install
npm run dev
```

Then open <http://localhost:3000>. Node 20 or newer is required.

| Command             | What it does                       |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Development server                 |
| `npm run build`     | Production build                   |
| `npm start`         | Serve the production build         |
| `npm run lint`      | ESLint                             |
| `npm run typecheck` | `tsc --noEmit`                     |
| `npm test`          | Vitest                             |

---

## How it is built

- **[Next.js 16](https://nextjs.org)** (App Router), **React 19**,
  **TypeScript**, **[Tailwind CSS 4](https://tailwindcss.com)**.
- No UI library, no icon package, no CSS parser dependency. The runtime
  dependencies are Next, React and React DOM — that is the whole list.
- All the analysis logic lives in `lib/` as pure functions with no DOM
  dependency, which is why it can be tested directly.

```
app/            routes: the home page, one page per tool, one API route
components/     the design system and shared UI primitives
lib/
  color/        conversion, WCAG contrast, median cut, palette export
  typography/   a small CSS reader, length parsing, scale detection
  responsive/   device presets and viewport maths
  net/          the SSRF guard and the site fetcher
  tools.ts      the tool registry every page reads from
tests/          Vitest, covering the pure logic
```

### One server-side endpoint

Everything runs in the browser except fetching a URL you type in, which
browsers will not let a page do across origins. `POST /api/fetch-site` does
that on the server, and it is the one piece of this app with a real attack
surface, so it is written defensively:

- http and https only.
- Private, loopback, link-local, CGNAT and multicast address space is blocked
  **after DNS resolution**, for IPv4 and IPv6 alike, including IPv4-mapped
  IPv6. A hostname resolving to `169.254.169.254` gets refused.
- Redirects are followed by hand, three hops maximum, with the address checked
  again on **every hop** — a public URL cannot 302 its way into your network.
- Bounded time (8s per request, 12s total), bounded bytes (2 MB of HTML, 1 MB
  per stylesheet, 10 stylesheets), and a content-type check.
- A per-IP rate limit that is best-effort only: it lives in process memory, so
  it does not hold across a scaled deployment. Put a real rate limiter in front
  if you deploy this publicly.

If you self-host and find a way past any of that,
[SECURITY.md](SECURITY.md) says how to report it.

---

## Roadmap

Six more tools are planned; see [ROADMAP.md](ROADMAP.md).

Screenshot Analyzer · Design Token Generator · CSS Generator · SVG Animation
Generator · Lottie Playground · AI Design Analyzer

Each is a self-contained page that depends on nothing but the shared design
system, which makes them reasonable first contributions.
[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md) walks through adding one.

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Issues
labelled `good first issue` are a good place to start, and adding a tool from
the roadmap is the most useful thing you can do.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## License

[MIT](LICENSE) © CHIANG, PIN-YI
