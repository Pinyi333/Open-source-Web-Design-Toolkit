# Adding a tool

This walks through adding a fourth tool to the toolkit. It should take under an
hour for something simple, because the registry wires up the navigation, the
home page and the roadmap for you.

We will use the **CSS Generator** from the roadmap as the running example.

## 1. Register it

`lib/tools.ts` is the single source of truth. Six of the nine tools listed
there are marked `status: "planned"`, which is what renders them as coming-soon
cards on the home page. Flip yours to `"stable"` when the page exists:

```ts
{
  slug: "css-generator",
  name: "CSS Generator",
  tagline: "Visual editors for the fiddly CSS",
  description:
    "Gradients, shadows, glassmorphism, clip paths and easing curves, edited visually with the CSS updating as you go.",
  status: "stable",          // was "planned"
  icon: "M5 3h14l-1.5 16L12 21l-5.5-2Z M15.5 8H9l.4 4h5.6l-.4 4-2.6.9",
}
```

`icon` is inline SVG path data on a 24×24 viewBox. Multiple subpaths are
separated by a space before each `M`; `ToolIcon` splits on that. Any 24×24
stroke icon set works as a source — keep the stroke width visually consistent
with the others.

Adding the entry is enough to make the tool appear in the header navigation and
the home page grid. Nothing else needs editing.

## 2. Write the logic in `lib/`, not in the page

This is the one rule worth insisting on. Put the actual work in
`lib/<area>/`, as pure functions that do not touch the DOM or React:

```ts
// lib/css/gradient.ts

export interface GradientStop {
  color: Rgb;
  /** Position along the gradient, 0-1. */
  position: number;
}

export function formatLinearGradient(
  angle: number,
  stops: GradientStop[],
): string {
  // ...
}
```

Why: it can be tested without rendering anything, it can be reused by another
tool later, and it keeps the component about presentation. Every existing tool
follows this — `lib/color/quantize.ts` has no idea a canvas exists, and
`lib/typography/analyze.ts` has no idea a browser exists.

Reuse what is already there before writing your own:

| You need | Use |
| --- | --- |
| Colour conversion, any direction | `lib/color/convert.ts` |
| WCAG contrast, readable foreground | `lib/color/contrast.ts` |
| Palette export formats | `lib/color/export.ts` |
| Reading declarations out of CSS | `lib/typography/parse-css.ts` |
| Parsing a CSS length to px | `parseLength` in `lib/typography/scale.ts` |
| Building a modular scale | `buildScale` in the same file |
| Device sizes, fit-to-frame maths | `lib/responsive/devices.ts` |
| Fetching a URL safely | `lib/net/client.ts` → `/api/fetch-site` |

## 3. Test it

`tests/` mirrors `lib/`. Add `tests/css.test.ts` and cover the logic directly:

```ts
import { describe, expect, it } from "vitest";
import { formatLinearGradient } from "@/lib/css/gradient";

describe("formatLinearGradient", () => {
  it("emits stops in ascending order", () => {
    // ...
  });
});
```

Test the awkward cases, not the happy path — that is where the existing tests
found real bugs. Empty input, a single item, values at a boundary, input that
does not parse.

## 4. Build the page

Two files, following the pattern the other tools use:

**`app/tools/css-generator/page.tsx`** — a server component that supplies
metadata and the shell:

```tsx
import type { Metadata } from "next";
import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";
import { CssGenerator } from "./css-generator";

const tool = getTool("css-generator")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function CssGeneratorPage() {
  return (
    <ToolShell tool={tool}>
      <CssGenerator />
    </ToolShell>
  );
}
```

**`app/tools/css-generator/css-generator.tsx`** — the `"use client"` component
with the interactive part.

Build the UI from `components/ui`, which has `Card`, `CardHeader`, `Button`,
`Field`, `Input`, `Textarea`, `Tabs`, `Badge`, `Notice`, `EmptyState`,
`Dropzone`, `CodeBlock`, `CopyButton` and `Spinner`. Use the theme tokens
(`bg-surface`, `text-muted`, `border-line`, `text-accent`) rather than raw
colours, so the tool works in both light and dark without extra effort.

## 5. Check it

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Then open the tool in a browser and check three things the automated checks
will not:

1. It works at 390px wide with no horizontal scrolling.
2. It works in both themes — hit the toggle in the header.
3. It is usable from the keyboard: tab through it, and check the focus ring is
   visible everywhere.

## 6. Update the docs

- Move your tool out of the planned list in `ROADMAP.md`.
- Add a section for it to `README.md` and `README.zh-TW.md`, matching the
  shape of the existing three.

That is the whole process. If something in it was unclear or wrong, a pull
request fixing this document is also a real contribution.
