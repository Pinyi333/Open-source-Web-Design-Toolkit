import type { Metadata } from "next";

import { ToolShell } from "@/components/tool-shell";
import { isUrlFetchEnabled } from "@/lib/net/config";
import { getTool } from "@/lib/tools";

import { ResponsiveTester } from "./responsive-tester";

const tool = getTool("responsive-tester")!;

export const metadata: Metadata = {
  title: tool.name,
  description: tool.description,
};

/*
 * Rendered per request rather than prerendered, so WDT_DISABLE_URL_FETCH is
 * read from the running environment. Baked in at build time it would be a
 * trap: setting the variable without redeploying would leave the endpoint
 * open while the operator believed it was closed.
 */
export const dynamic = "force-dynamic";

export default function ResponsiveTesterPage() {
  return (
    <ToolShell tool={tool}>
      <ResponsiveTester urlFetchEnabled={isUrlFetchEnabled()} />
    </ToolShell>
  );
}
