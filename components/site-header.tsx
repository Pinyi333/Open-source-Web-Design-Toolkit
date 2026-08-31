"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { STABLE_TOOLS } from "@/lib/tools";
import { useTheme } from "@/components/theme";
import { Button, GitHubIcon, cx } from "@/components/ui";

const REPO_URL = "https://github.com/Pinyi333/Open-source-Web-Design-Toolkit";

function ThemeToggle() {
  const { resolved, setTheme } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="h-8 w-8 px-0"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {resolved === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="mr-2 flex shrink-0 items-center gap-2 text-sm font-semibold tracking-tight text-ink"
        >
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h10M4 17h6" />
            </svg>
          </span>
          <span className="hidden sm:inline">Web Design Toolkit</span>
          <span className="sm:hidden">WDT</span>
        </Link>

        <nav aria-label="Tools" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {STABLE_TOOLS.map((tool) => {
            const href = `/tools/${tool.slug}`;
            const active = pathname === href;
            return (
              <Link
                key={tool.slug}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-raised text-ink" : "text-muted hover:bg-raised hover:text-ink",
                )}
              >
                {tool.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View this project on GitHub"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <GitHubIcon size={15} />
          </a>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Free and open source under the MIT license. Self-host it, fork it, take it apart.
        </p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
        >
          <GitHubIcon size={13} /> Source on GitHub
        </a>
      </div>
    </footer>
  );
}
