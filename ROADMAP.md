# Roadmap

Shipped in v0.1: **Color Extractor**, **Typography Analyzer**,
**Responsive Tester**.

Everything below is planned but not built. Each one is a self-contained page
that depends on nothing but the shared design system, so they can be built in
any order, by anyone. If you want to take one on, open an issue saying so and
read [docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md).

The registry in `lib/tools.ts` already lists these with `status: "planned"`,
which is what makes them appear on the home page as coming-soon cards.

---

## Screenshot Analyzer

Measure spacing and alignment in a mockup.

Overlay a grid on a screenshot, measure the gaps between elements, and check
whether the spacing follows a consistent scale — the same question the
Typography Analyzer asks about font sizes, asked about whitespace.

*Builds on:* the same canvas handling as the Color Extractor, and a spacing
version of `analyzeScale` from `lib/typography/scale.ts`.

## Design Token Generator

Turn a few decisions into a complete token set.

Pick a base colour, a type scale and a spacing ratio; get back a full
[W3C design token](https://tr.designtokens.org/format/) file, with CSS,
Tailwind and Style Dictionary output.

*Builds on:* `lib/color/` for generating tints and shades in OKLCH (which keeps
perceived lightness even across hues), `buildScale` from
`lib/typography/scale.ts`, and the exporters in `lib/color/export.ts` — the
design-token export already emits the right format.

## CSS Generator

Visual editors for the fiddly parts of CSS: gradients, shadows, glassmorphism,
clip paths, easing curves. Edit visually, watch the CSS update, copy it out.

*Builds on:* nothing much. The most self-contained tool on this list, and
probably the best first contribution.

## SVG Animation Generator

Animate SVG paths without hand-writing keyframes: draw-on line animations,
morphing between shapes, motion along a path. Exports plain CSS or SMIL.

*Needs:* path length measurement via `getTotalLength()`, and interpolation
between two paths with matching command counts.

## Lottie Playground

Load a Lottie JSON file, scrub the timeline, retint layers, and export a
smaller file containing only the frames you need.

*Note:* this is the one tool that would justify a runtime dependency
(`lottie-web`). Worth discussing in an issue before starting.

## AI Design Analyzer

Send a screenshot to a model and get structured feedback on hierarchy,
contrast and spacing.

*Constraints, non-negotiable:* bring-your-own-key, the key stays in the
browser's storage and is never sent to this app's server, the feature is
entirely opt-in, and the app must work exactly as well with it switched off.
This project does not have a backend that holds secrets and is not going to
grow one.

---

## Not planned

Kept here so the answer is written down:

- **User accounts, saved projects, cloud sync.** This app has no database and
  no server-side storage, which is most of why it is safe to self-host and
  costs nothing to run.
- **Analytics.** Not even the privacy-friendly kind.
- **A hosted API.** `/api/fetch-site` exists only to serve this app's own
  frontend.
