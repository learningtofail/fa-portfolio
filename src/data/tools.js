// Single source of truth for the tools list: read by /tools/, the resume page's tool cards and the
// [slug] tool page. Slugs are locked: they are public URLs (/tools/<slug>/) and the www repo links to them.
//
// Fields: `name` is the short label used in lists and cards; `title` is the page heading and <title> prefix
// (the CAC calculator's differ on purpose); `intro` and `metaDescription` fill the page; `wide` widens the layout.

/**
 * @typedef {{
 *   slug: string,
 *   name: string,
 *   title: string,
 *   description: string,
 *   intro: string,
 *   metaDescription: string,
 *   live: boolean,
 *   wide?: boolean,
 * }} Tool
 */

/** @type {Tool[]} */
export const tools = [
  {
    slug: "utm-auditor",
    name: "UTM Governance Auditor",
    title: "UTM Governance Auditor",
    description:
      "Upload a CSV of URLs or UTM parameters and audit them for governance drift — missing fields, casing inconsistency, invalid characters, duplicate campaign definitions.",
    intro:
      "Checks a CSV of campaign URLs or UTM parameters for the kind of drift that quietly breaks attribution: missing required fields, casing inconsistency, invalid characters, mismatched separators, and duplicate campaign definitions pointing at different destinations. Nothing you upload is sent anywhere — parsing and analysis happen entirely in this tab.",
    metaDescription:
      "Upload a CSV of URLs or UTM parameters and audit them for governance drift, entirely in your browser.",
    live: true,
  },
  {
    slug: "gtm-auditor",
    name: "GTM Container Auditor",
    title: "GTM Container Auditor",
    description: "Upload a GTM container export and audit tag/trigger/variable hygiene.",
    intro:
      "Checks a GTM container export for the hygiene problems that accumulate in long-running containers: paused tags, tags with no firing trigger, unused variables and triggers, duplicate names, and generic default names nobody got around to renaming. Nothing you upload is sent anywhere — parsing and analysis happen entirely in this tab.",
    metaDescription: "Upload a GTM container export and audit tag/trigger/variable hygiene, entirely in your browser.",
    live: true,
  },
  {
    slug: "cac-calculator",
    name: "CAC / Margin / Payback Calculator",
    title: "CAC / LTV / Payback Calculator",
    description: "Model customer acquisition cost, margin, and payback period.",
    intro:
      "Enter spend, new customers, revenue, margin, and churn — get CAC, LTV, LTV:CAC ratio, and payback period, updated live as you type. All calculations run in this browser tab.",
    metaDescription: "Model customer acquisition cost, lifetime value, and payback period, entirely in your browser.",
    live: true,
  },
  {
    slug: "attribution",
    name: "Multi-Touch Attribution",
    title: "Multi-Touch Attribution",
    description: "Upload a CSV of touchpoints and compare attribution models.",
    intro:
      "The channel that looks best depends entirely on which attribution model you ask. Upload a CSV of touchpoints and see the same data scored five different ways, side by side, with shares, rank changes and a CSV export. It maps common column names, counts one revenue value per journey, gives non-converting journeys no credit, reads dates as UTC and reports every data-quality issue it finds. Nothing you upload is sent anywhere. Parsing and analysis happen entirely in this tab.",
    metaDescription:
      "Upload a CSV of journey touchpoints and compare last-touch, first-touch, linear, position-based, and time-decay attribution with a lookback window, data-quality checks and CSV export, entirely in your browser.",
    live: true,
    wide: true,
  },
  {
    slug: "disclosure-check",
    name: "Disclosure Language Checker",
    title: "Disclosure Language Checker",
    description: "Check marketing copy for missing or non-compliant disclosure language.",
    intro:
      "Scans copy for common required disclosure phrasing across a few regulated categories — affiliate/sponsored content, health/pharma, age-restricted products, and financial services. A pattern-matching aid, not a compliance sign-off. Nothing you enter is sent anywhere.",
    metaDescription:
      "Check marketing copy for missing common disclosure language, entirely in your browser. Not legal advice.",
    live: true,
  },
];
