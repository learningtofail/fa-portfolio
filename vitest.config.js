import { defineConfig } from "vitest/config";

// Unit tests only. E2E journeys live in tests/e2e and run under Playwright.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{js,jsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/unit/setup.js"],
    coverage: {
      provider: "v8",
      // Pure logic is the contract: every module under src/lib must stay at 90 percent or better.
      include: ["src/lib/**/*.js"],
      reporter: ["text", "lcov"],
      thresholds: { lines: 90, functions: 90, statements: 90, branches: 90 },
    },
  },
});
