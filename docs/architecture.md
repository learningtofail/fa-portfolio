# Architecture (current state)

## Pages

| Route            | Source                                                       |
| ---------------- | ------------------------------------------------------------ |
| `/`              | `src/pages/index.astro`, content from `src/data/resume.js`   |
| `/tools/`        | `src/pages/tools/index.astro`, list from `src/data/tools.js` |
| `/tools/<slug>/` | One `.astro` page per tool, each mounting one React island   |

`src/layouts/Base.astro` holds the skip link, global focus ring, meta tags and `noindex, nofollow`.

## Single sources of truth

- `src/data/resume.js` feeds both the page and `scripts/generate-pdf.mjs`, so they cannot drift.
- `src/data/tools.js` feeds the tools index and the resume page's tool cards. `fa-www` mirrors the slugs by hand. Neither repo imports the other.

## Tools

Each tool is one component in `src/components/` holding parsing, audit logic and UI together: `UtmAuditor`, `GtmAuditor`, `AttributionTool`, `DisclosureChecker`, `CacCalculator`. Charts are `BarChart`, `GroupedBarChart`, `PaybackChart` (D3). Phase 4 of the refactor plan extracts the logic into pure modules.

## Build

`npm run build` runs `generate-pdf` (writes `public/faysal-ahmed-resume.pdf`, which is git-ignored) and then `astro build`.

## Quality gates

ESLint 9 with pinned rules, Prettier, `tsc --noEmit` with `checkJs`, Vitest unit tests, Playwright e2e plus axe (all pages pass with no violations). Known defects are pinned by `it.fails` (unit) and `test.fail()` (e2e) and carry review IDs (D1, D2, D11).

## Delivery

`.github/workflows/ci.yml`: static checks, unit tests, build plus e2e and a blocking `npm audit --omit=dev --audit-level=high` job (the deploy job needs it) on every PR and push. On push to `main` the deploy job downloads the built `dist` artifact and rsyncs it over Tailscale to `/opt/static-web/sites/portfolio/`.
