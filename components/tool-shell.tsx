import type { ReactNode } from "react";

import type { Tool } from "@/lib/tools";
import { ToolIcon } from "@/components/ui";

/** The page frame every tool shares: heading, description, then content. */
export function ToolShell({
  tool,
  children,
}: {
  tool: Tool;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <ToolIcon path={tool.icon} size={22} />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{tool.name}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
            {tool.description}
          </p>
        </div>
      </header>
      <div className="mt-8">{children}</div>
    </div>
  );
}
