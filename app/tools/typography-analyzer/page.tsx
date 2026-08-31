import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";

import { TypographyAnalyzer } from "./typography-analyzer";

const tool = getTool("typography-analyzer")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function TypographyAnalyzerPage() {
  return (
    <ToolShell tool={tool}>
      <TypographyAnalyzer />
    </ToolShell>
  );
}
