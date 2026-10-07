import { defineConfig } from "astro/config";
import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://portfolio.faysalahmed.ca",
  integrations: [react()],
  output: "static",
  // The UTM, GTM and CAC tools were replaced by the marketing tools (docs/decisions/0008-retire-duplicate-tools.md).
  // Their old URLs stay alive as redirect pages, so bookmarks and links keep working.
  redirects: {
    "/tools/utm-auditor": "/marketing/utm-governance-auditor.html",
    "/tools/gtm-auditor": "/marketing/gtm-container-auditor.html",
    "/tools/cac-calculator": "/marketing/cac-payback-modeler.html",
  },
  build: {
    // Always emit external stylesheets. Inlined CSS would need a new CSP hash on every style edit;
    // only Astro's own one-line island style stays inline (see docs/caddy/Caddyfile.proposed.md).
    inlineStylesheets: "never",
  },
});
