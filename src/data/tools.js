// Single source of truth for the tools list: read by /tools/, the resume page's tool cards and the
// [slug] tool page. Slugs are locked: they are public URLs (/tools/<slug>/) and the www repo links to them. Retired slugs
// (utm-auditor, gtm-auditor, cac-calculator) redirect to the marketing tools; see astro.config.mjs.
//
// Fields: `name` is the short label used in lists and cards; `title` is the page heading and <title> prefix
// ; `intro` and `metaDescription` fill the page; `wide` widens the layout.

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
