/**
 * Disclosure phrase rulesets. Data only: add a ruleset here and the checker UI picks it up.
 * Age patterns use a negative lookbehind rather than \b, because \b after "+" needs a word character next (D1).
 * @typedef {{ label: string, re: RegExp }} DisclosurePattern
 * @typedef {{ label: string, patterns: DisclosurePattern[] }} Ruleset
 */

/** @type {Record<string, Ruleset>} */
export const RULESETS = {
  affiliate: {
    label: "Affiliate / Sponsored Content (FTC-style)",
    patterns: [
      { label: "#ad", re: /#ad\b/i },
      { label: "#sponsored", re: /#sponsored/i },
      { label: '"affiliate link"', re: /affiliate link/i },
      { label: '"paid partnership"', re: /paid partnership/i },
      { label: '"sponsored by"', re: /sponsored by/i },
      { label: '"in partnership with"', re: /in partnership with/i },
    ],
  },
  regulatedHealth: {
    label: "Regulated Health / Pharma (generic)",
    patterns: [
      { label: '"full prescribing information"', re: /see (the )?full prescribing information/i },
      { label: '"important safety information"', re: /important safety information/i },
      { label: '"ask your doctor"', re: /ask your doctor/i },
      { label: '"talk to your doctor/healthcare provider"', re: /talk to your (doctor|healthcare provider)/i },
      { label: '"full risk information"', re: /full risk information/i },
      { label: '"consult your physician/doctor"', re: /consult your (physician|doctor)/i },
    ],
  },
  cannabis: {
    label: "Cannabis / Age-Restricted (generic)",
    patterns: [
      { label: "19+", re: /(?<!\w)19\+/ },
      { label: "21+", re: /(?<!\w)21\+/ },
      { label: '"legal age"', re: /legal age/i },
      { label: '"keep out of reach of children"', re: /keep out of reach of children/i },
      { label: '"for use only by adults"', re: /for use only by adults/i },
    ],
  },
  financial: {
    label: "Financial / Investment (generic)",
    patterns: [
      { label: '"past performance"', re: /past performance/i },
      { label: '"not financial/investment advice"', re: /not (financial|investment) advice/i },
      { label: '"results may vary"', re: /results may vary/i },
      { label: '"risk of loss"', re: /risk of loss/i },
      { label: '"capital at risk"', re: /capital at risk/i },
      { label: '"consult a financial advisor"', re: /consult a financial advisor/i },
    ],
  },
};
