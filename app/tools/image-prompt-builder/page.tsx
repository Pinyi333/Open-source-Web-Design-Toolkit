import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { getTool } from "@/lib/tools";

import { ImagePromptBuilder } from "./image-prompt-builder";

const tool = getTool("image-prompt-builder")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

export default function ImagePromptBuilderPage() {
  return (
    <ToolShell tool={tool}>
      <ImagePromptBuilder />
    </ToolShell>
  );
}
