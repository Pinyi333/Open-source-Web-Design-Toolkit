/**
 * The tool registry — the single source of truth for what this toolkit ships.
 *
 * The home page grid, the header navigation and the roadmap all read from
 * here. Adding a tool means adding an entry to this list and creating the
 * matching page under `app/tools/<slug>`. See docs/ADDING-A-TOOL.md.
 */

export type ToolStatus = "stable" | "planned";

export interface Tool {
  slug: string;
  name: string;
  /** One line, shown on cards and in the header. */
  tagline: string;
  /** A sentence or two, shown on the tool page itself. */
  description: string;
  status: ToolStatus;
  /** Inline SVG path data drawn on a 24x24 viewBox. */
  icon: string;
}

export const TOOLS: Tool[] = [
  {
    slug: "color-extractor",
    name: "Color Extractor",
    tagline: "Pull a palette out of any image",
    description:
      "Drop in a screenshot, mockup or photo and get a palette back with HEX, RGB, HSL and OKLCH values, WCAG contrast checks, and copy-ready CSS, Tailwind and design-token exports. Images are processed entirely in your browser.",
    status: "stable",
    icon: "M12 3a9 9 0 1 0 0 18 2.5 2.5 0 0 0 2-4 2.5 2.5 0 0 1 2-4h1.5A3.5 3.5 0 0 0 21 9.5C21 5.9 16.97 3 12 3Z M7.5 11.5h.01 M10.5 7.5h.01 M15.5 8.5h.01",
  },
  {
    slug: "typography-analyzer",
    name: "Typography Analyzer",
    tagline: "Audit the type system of any page",
    description:
      "Point it at a URL or paste in HTML and CSS. It inventories the font families, sizes, weights and line heights in use, works out whether they follow a modular scale, and flags the readability and performance problems it finds.",
    status: "stable",
    icon: "M4 20h4 M6 20 12 4l6 16 M8.5 14h7 M16 20h4",
  },
  {
    slug: "responsive-tester",
    name: "Responsive Tester",
    tagline: "See a page at every breakpoint at once",
    description:
      "Load a page across phone, tablet and desktop frames side by side. It reads the site's own CSS media queries so you can test the breakpoints that actually exist, and tells you up front when a site refuses to be embedded.",
    status: "stable",
    icon: "M3 5h11v10H3z M3 18h11 M17 8h4v11h-4z M8.5 15v3",
  },
  {
    slug: "screenshot-analyzer",
    name: "Screenshot Analyzer",
    tagline: "Measure spacing and alignment in a mockup",
    description:
      "Overlay a grid on a screenshot, measure gaps between elements, and check whether spacing follows a consistent scale.",
    status: "planned",
    icon: "M4 6h16v12H4z M9 6v12 M4 11h16",
  },
  {
    slug: "design-token-generator",
    name: "Design Token Generator",
    tagline: "Build a full token set from a few decisions",
    description:
      "Turn a base color, a type scale and a spacing ratio into a complete W3C design-token file, with CSS, Tailwind and Style Dictionary output.",
    status: "planned",
    icon: "M12 3 3 8v8l9 5 9-5V8Z M3 8l9 5 9-5 M12 13v8",
  },
  {
    slug: "css-generator",
    name: "CSS Generator",
    tagline: "Visual editors for the fiddly CSS",
    description:
      "Gradients, shadows, glassmorphism, clip paths and easing curves, edited visually with the CSS updating as you go.",
    status: "planned",
    icon: "M5 3h14l-1.5 16L12 21l-5.5-2Z M15.5 8H9l.4 4h5.6l-.4 4-2.6.9",
  },
  {
    slug: "svg-animation-generator",
    name: "SVG Animation Generator",
    tagline: "Animate paths without writing keyframes",
    description:
      "Draw-on line animations, morphing between shapes and motion along a path, exported as plain CSS or SMIL.",
    status: "planned",
    icon: "M4 17c4 0 4-10 8-10s4 10 8 10 M4 17h.01 M20 17h.01",
  },
  {
    slug: "lottie-playground",
    name: "Lottie Playground",
    tagline: "Preview and tune Lottie files",
    description:
      "Load a Lottie JSON file, scrub the timeline, retint layers, and export a smaller file with the frames you actually need.",
    status: "planned",
    icon: "M12 3a9 9 0 1 0 9 9 M12 3v9l6.5 3.5 M12 3a9 9 0 0 1 9 9",
  },
  {
    slug: "ai-design-analyzer",
    name: "AI Design Analyzer",
    tagline: "Bring-your-own-key design critique",
    description:
      "Optional, opt-in and key-in-your-browser: send a screenshot to a model of your choosing and get structured feedback on hierarchy, contrast and spacing.",
    status: "planned",
    icon: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  },
];

export const STABLE_TOOLS = TOOLS.filter((tool) => tool.status === "stable");
export const PLANNED_TOOLS = TOOLS.filter((tool) => tool.status === "planned");

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}
