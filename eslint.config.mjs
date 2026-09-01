import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat configs directly, so they are spread in
 * as-is — no FlatCompat shim needed.
 */
const eslintConfig = [
  {
    // mcp/ is its own package with its own tsconfig and dependencies; the
    // Next-flavoured rules here would only produce noise on it.
    ignores: [
      ".next/**",
      "**/node_modules/**",
      "next-env.d.ts",
      "coverage/**",
      "mcp/dist/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default eslintConfig;
