import { defineConfig } from "vitest/config";

// Unit tests only. E2E journeys live in tests/e2e and run under Playwright.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.{js,jsx}"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["tests/unit/setup.js"],
  },
});
