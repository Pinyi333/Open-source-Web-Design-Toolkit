import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";

import { ResponsiveTester } from "./responsive-tester";

const tool = getTool("responsive-tester")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function ResponsiveTesterPage() {
  return (
    <ToolShell tool={tool}>
      <ResponsiveTester />
    </ToolShell>
  );
}
