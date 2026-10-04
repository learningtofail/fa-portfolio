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

Each tool is one component in `src/components/` holding parsing, audit logic and UI together: `UtmAuditor`, `GtmAuditor`, `AttributionTool`, `DisclosureChecker`, `CacCalculator`. Charts are `BarChart`, `GroupedBarChart`, `PaybackChart` (D3); they redraw through the `useChartWidth` ResizeObserver hook. Phase 4 of the refactor plan extracts the logic into pure modules.

## Styles

Three layers, loaded once by `src/layouts/Base.astro` in this order:

1. `src/styles/orchis.tokens.css`: vendored Orchis primitives (palette and grey ladder, type scale, spacing, radii, elevation, motion). Read-only. `orchis.tokens.manifest.json` records the design-system commit and file hashes; `npm run tokens:check` fails on drift. The upstream Google Fonts import and the dark GNOME surface tokens are left out on purpose (decision 4: primitives only, the resume stays light and plain).
2. `src/styles/site.tokens.css`: semantic aliases (`--ink`, `--muted`, `--line`, status colors, chart series, layout widths). The accent and status colors are audited against white for AA and are not Orchis colors, because Orchis blue-light fails AA as text.
3. Component CSS in BEM: `base.css`, `layout.css` (`.page`, `.page__intro`), `resume.css`, and `components/` (`.stat-card`, `.data-table`, `.dropzone`, `.field`, `.chart`, `.tool-list`). `.topnav__link--cta` replaces the old `!important`.

Pages and components carry no inline styles. Stylelint blocks raw colors outside the two token files.

The site does not load web fonts: body text uses the system stack (`--font-body`). The Orchis font-family tokens are present but unused until a font is adopted (use the `@fontsource` packages, not a CDN).

## Build

`npm run build` runs `generate-pdf` (writes `public/faysal-ahmed-resume.pdf`, which is git-ignored) and then `astro build`.

## Quality gates

ESLint 9 with pinned rules, Prettier, `tsc --noEmit` with `checkJs`, Vitest unit tests, Playwright e2e plus axe (all pages pass with no violations). Known defects are pinned by `it.fails` (unit) and `test.fail()` (e2e) with their review ID; none are open. Open decisions (D8, D9) are in `docs/open-decisions.md`.

## Delivery

`.github/workflows/ci.yml`: static checks (ESLint, Stylelint, Prettier, tsc, `tokens:check`), unit tests, build plus e2e and a blocking `npm audit --omit=dev --audit-level=high` job (the deploy job needs it) on every PR and push. On push to `main` the deploy job downloads the built `dist` artifact and rsyncs it over Tailscale to `/opt/static-web/sites/portfolio/`.
