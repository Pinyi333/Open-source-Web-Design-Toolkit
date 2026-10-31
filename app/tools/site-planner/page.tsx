import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";

import { SitePlanner } from "./site-planner";

const tool = getTool("site-planner")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function SitePlannerPage() {
  return (
    <ToolShell tool={tool}>
      <SitePlanner />
    </ToolShell>
  );
}
