// Token files are the only place raw colors may live; everything else reads var(--token).
// Every rule is on purpose: color-no-hex plus the color-function ban enforce the token rule,
// declaration-no-important and selector-max-id keep specificity flat, and the class pattern enforces BEM.
const BEM = /^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$/;

/** @type {import("stylelint").Config} */
export default {
  ignoreFiles: ["dist/**", "node_modules/**", "src/styles/orchis.tokens.css", "src/styles/site.tokens.css"],
  overrides: [{ files: ["**/*.astro"], customSyntax: "postcss-html" }],
  rules: {
    "color-no-hex": true,
    "function-disallowed-list": ["rgb", "rgba", "hsl", "hsla"],
    "declaration-no-important": true,
    "selector-max-id": 0,
    "selector-class-pattern": [BEM, { message: "Use BEM: block, block__element, block--modifier" }],
  },
};
