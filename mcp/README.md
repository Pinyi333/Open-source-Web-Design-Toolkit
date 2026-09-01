# Web Design Toolkit — MCP server

An [MCP](https://modelcontextprotocol.io) server that gives AI coding agents
the same design-analysis tools the [web app](../README.md) offers designers.
It wraps the repo's pure `lib/` functions — no browser, no DOM, and it runs
entirely on your own machine over stdio.

## Tools

| Tool | What it does |
| --- | --- |
| `extract_palette` | Dominant palette from a PNG/JPEG file (median-cut, 3–12 colours), in HEX/RGB/HSL/OKLCH with coverage share; optional CSS / Tailwind v4 / JSON / W3C-tokens export |
| `convert_color` | Hex → RGB / HSL / OKLCH, plus the readable foreground (black or white) |
| `check_contrast` | WCAG 2.1 contrast ratio and AA / AAA / AA-Large verdicts for a colour pair |
| `export_palette` | A list of hex colours → paste-ready CSS variables, Tailwind `@theme`, JSON, or W3C design tokens |
| `analyze_typography` | Typography audit of a public URL, or of HTML/CSS passed directly: families and origins, size scale and consistency, weights, heading structure, breakpoints, findings |
| `list_device_presets` | The Responsive Tester's device viewports (CSS pixels) and common breakpoints |

## Setup

```bash
cd mcp
npm install
npm run build
```

Then register it with your agent. Claude Code:

```bash
claude mcp add web-design-toolkit -- node /path/to/Open-source-Web-Design-Toolkit/mcp/dist/mcp/src/index.js
```

Or in a project's `.mcp.json`:

```json
{
  "mcpServers": {
    "web-design-toolkit": {
      "command": "node",
      "args": ["/path/to/Open-source-Web-Design-Toolkit/mcp/dist/mcp/src/index.js"]
    }
  }
}
```

## Notes

- **`analyze_typography` with a `url` reuses the web app's SSRF guard
  unchanged**: private, loopback and link-local addresses are refused, on
  every redirect hop, after DNS resolution. For a localhost dev server, pass
  `html` / `css` directly — the agent usually has the files anyway.
- Palette extraction reads the image from disk and never sends it anywhere.
- This package is deliberately thin: analysis logic lives in `../lib` (pure,
  tested by the repo's test suite); this directory is decoding, registration
  and error shaping only.
