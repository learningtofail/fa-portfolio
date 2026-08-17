// Single source of truth for the tools list — imported by both /tools/index.astro
// and the portfolio page's tools card grid, so the two can't drift apart.
// Slugs are locked (see phase-4-tool-slugs.md in the project docs).
export const tools = [
  {
    slug: "utm-auditor",
    name: "UTM Governance Auditor",
    description: "Upload a CSV of URLs or UTM parameters and audit them for governance drift — missing fields, casing inconsistency, invalid characters, duplicate campaign definitions.",
    live: true,
  },
  {
    slug: "gtm-auditor",
    name: "GTM Container Auditor",
    description: "Upload a GTM container export and audit tag/trigger/variable hygiene.",
    live: true,
  },
  {
    slug: "cac-calculator",
    name: "CAC / Margin / Payback Calculator",
    description: "Model customer acquisition cost, margin, and payback period.",
    live: true,
  },
  {
    slug: "attribution",
    name: "Multi-Touch Attribution",
    description: "Upload a CSV of touchpoints and compare attribution models.",
    live: true,
  },
  {
    slug: "disclosure-check",
    name: "Disclosure Language Checker",
    description: "Check marketing copy for missing or non-compliant disclosure language.",
    live: true,
  },
];
