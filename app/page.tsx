import Link from "next/link";

import { PLANNED_TOOLS, STABLE_TOOLS } from "@/lib/tools";
import { Badge, ToolIcon } from "@/components/ui";

const REPO_URL = "https://github.com/Pinyi333/Open-source-Web-Design-Toolkit";

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <Badge tone="accent" className="mb-5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              v0.1 · three tools, more on the way
            </Badge>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
              Design utilities that run{" "}
              <span className="text-accent">on your machine</span>.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted">
              Pull a palette out of an image, audit a page&apos;s typography, and check a
              layout at every breakpoint. No account, no upload quota, no telemetry — clone
              it and run it, or use the hosted copy.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/tools/color-extractor"
                className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink transition-[filter] hover:brightness-110"
              >
                Open the first tool
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center rounded-lg border border-line bg-raised px-5 text-sm font-medium text-ink transition-colors hover:border-line-strong"
              >
                Read the source
              </a>
            </div>
            <p className="mt-6 font-mono text-xs text-faint">
              git clone · npm install · npm run dev · localhost:3000
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <h2 className="text-xs font-medium uppercase tracking-wider text-faint">
          Available now
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STABLE_TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="group flex flex-col rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised"
            >
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent">
                <ToolIcon path={tool.icon} />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-ink">{tool.name}</h3>
              <p className="mt-1 text-sm text-muted">{tool.tagline}</p>
              <p className="mt-3 flex-1 text-xs leading-relaxed text-faint">
                {tool.description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent">
                Open
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wider text-faint">
            Planned
          </h2>
          <a
            href={`${REPO_URL}/blob/main/ROADMAP.md`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-xs text-muted transition-colors hover:text-ink"
          >
            Read the roadmap →
          </a>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED_TOOLS.map((tool) => (
            <div
              key={tool.slug}
              className="rounded-card border border-dashed border-line p-5"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-raised text-faint">
                  <ToolIcon path={tool.icon} size={16} />
                </span>
                <h3 className="text-sm font-medium text-muted">{tool.name}</h3>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-faint">{tool.description}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-faint">
          Each of these is a self-contained page with no dependency on the others, which
          makes them reasonable first contributions.{" "}
          <a
            href={`${REPO_URL}/blob/main/docs/ADDING-A-TOOL.md`}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent underline underline-offset-2"
          >
            Here is how to add one.
          </a>
        </p>
      </section>
    </>
  );
}
