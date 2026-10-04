import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://portfolio.faysalahmed.ca",
  integrations: [react()],
  output: "static",
  build: {
    // Always emit external stylesheets. Inlined CSS would need a new CSP hash on every style edit;
    // only Astro's own one-line island style stays inline (see docs/caddy/Caddyfile.proposed.md).
    inlineStylesheets: "never",
  },
});
