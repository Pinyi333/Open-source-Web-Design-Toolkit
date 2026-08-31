import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";

import { ColorExtractor } from "./color-extractor";

const tool = getTool("color-extractor")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function ColorExtractorPage() {
  return (
    <ToolShell tool={tool}>
      <ColorExtractor />
    </ToolShell>
  );
}
