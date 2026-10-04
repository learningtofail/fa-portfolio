// Pinned rule set, same policy as Samaya's pyproject.toml: every rule that is
// switched off or downgraded carries a comment saying why, and the plan phase
// that removes the exception. Do not widen an ignore without writing the reason.
import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import astro from "eslint-plugin-astro";
import prettier from "eslint-config-prettier";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/", ".astro/", "node_modules/", "playwright-report/", "test-results/", "coverage/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    settings: { react: { version: "19.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      // JS files without PropTypes are the convention here; types come from
      // JSDoc and `npm run typecheck`, so PropTypes would duplicate them.
      "react/prop-types": "off",
      // The standards forbid stray console output. console.error and console.warn
      // stay allowed for genuine failure reporting until Phase 2 (D6) removes the
      // one in ContactContent.
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-var": "error",
      "prefer-const": "error",
      // Index keys fail the build; the two append-only sites carry inline disables until Phase 4.
      "react/no-array-index-key": "error",
    },
  },
  ...astro.configs["flat/recommended"],
  ...astro.configs["flat/jsx-a11y-recommended"],
  {
    // Astro frontmatter is TypeScript (Props interfaces), so the Astro parser delegates to the TS parser.
    files: ["**/*.astro"],
    languageOptions: { parserOptions: { parser: tsParser } },
  },
  {
    files: ["tests/e2e/**/*.js", "playwright.config.js"],
    rules: {
      // Playwright fixtures are named `use`, which react-hooks mistakes for the React `use` hook.
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    // vitest.config.js sets `globals: true`, so test files use describe/it/expect/vi without imports.
    files: ["tests/unit/**/*.{js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.vitest,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        vi: "readonly",
        afterEach: "readonly",
      },
    },
  },
  {
    // Build scripts are CLIs; stdout is their interface.
    files: ["scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  prettier,
];
