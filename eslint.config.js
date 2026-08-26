import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

// Flat config, consumed directly by the ESLint CLI. Next 16 removed `next lint`
// and the `eslint` key in next.config.js, so `pnpm lint` invokes `eslint`
// itself; `eslint-config-next/core-web-vitals` is that package's native flat
// entrypoint, which is why no `FlatCompat` shim is needed here. It also brings
// its own ignores (`.next/**`, `out/**`, `build/**`, `next-env.d.ts`), so this
// file does not repeat them.
export default tseslint.config(
  // Flat config does not read .gitignore (or .git/info/exclude) — it
  // default-ignores only node_modules. Everything else gitignored has to be
  // named here or it gets linted. The worktree entries matter most: agent
  // sessions check out whole nested copies of this repo there, so without them
  // `eslint .` reports another branch's files as this one's and
  // `--max-warnings 0` passes or fails depending on who has a worktree open.
  // `.next`, `out`, `build`, and `next-env.d.ts` come from nextVitals already.
  {
    ignores: [
      ".claude/worktrees/**",
      ".worktrees/**",
      ".superpowers/**",
      "coverage/**",
      ".vercel/**",
      ".playwright-mcp/**",
    ],
  },
  ...nextVitals,
  {
    files: ["**/*.ts", "**/*.tsx"],
    extends: [
      ...tseslint.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    rules: {
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
);
