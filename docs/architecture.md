# Architecture (current state)

## Pages

| Route            | Source                                                       |
| ---------------- | ------------------------------------------------------------ |
| `/`              | `src/pages/index.astro`, content from `src/data/resume.js`   |
| `/tools/`        | `src/pages/tools/index.astro`, list from `src/data/tools.js` |
| `/tools/<slug>/` | One `.astro` page per tool, each mounting one React island   |

`src/layouts/Base.astro` holds the skip link, global focus ring, meta tags and `noindex, nofollow`.

## Single sources of truth

- `src/data/resume.js` feeds both the page and `scripts/generate-pdf.mjs`, so they cannot drift. The years-of-experience figure comes from `src/data/years.js` (2004 to the build year), so it never goes stale in copy.
- `src/data/tools.js` feeds the tools index and the resume page's tool cards. `fa-www` mirrors the slugs by hand. Neither repo imports the other.

## Tools

Each tool is a pure module in `src/lib/` plus a thin React island:

| Tool                           | Logic                                | Island                                   |
| ------------------------------ | ------------------------------------ | ---------------------------------------- |
| UTM Governance Auditor         | `lib/utm/audit.js`                   | `components/tools/UtmAuditor.jsx`        |
| GTM Container Auditor          | `lib/gtm/audit.js`                   | `components/tools/GtmAuditor.jsx`        |
| Multi-Touch Attribution        | `lib/attribution/compute.js`         | `components/tools/AttributionTool.jsx`   |
| Disclosure Language Checker    | `lib/disclosure/{rulesets,check}.js` | `components/tools/DisclosureChecker.jsx` |
| CAC / LTV / Payback Calculator | `lib/cac/calc.js`                    | `components/tools/CacCalculator.jsx`     |

Shared CSV handling is `lib/csv.js` (`parseCsvFile`, `lowercaseKeys` with prototype-free rows). The kit in `components/kit/` supplies the dropzone (`FileDropzone` over `useFileInput`), `StatRow` (owns the `aria-live` region), `StatCard`, `DataTable`, `ToolShell`, `ErrorNotice` and `useFileAnalysis` (file name, result and error state around an async analysis). Charts are in `components/charts/` (D3; `useChartWidth` redraws on resize and series colors come from CSS classes).

Pages: `src/pages/tools/[slug].astro` calls `getStaticPaths` over `data/tools.js` and wraps the island in `layouts/ToolLayout.astro`. Astro cannot hydrate a component chosen at runtime, so the island per slug is named explicitly in that file.

The attribution tool's credit math is pinned by golden tests built from hand-computed values (`tests/fixtures/attribution-*-golden.csv`, `tests/unit/lib/attribution.compute.test.js`).

## Styles

Three layers, loaded once by `src/layouts/Base.astro` in this order:

1. `src/styles/orchis.tokens.css`: vendored Orchis primitives (palette and grey ladder, type scale, spacing, radii, elevation, motion). Read-only. `orchis.tokens.manifest.json` records the design-system commit and file hashes; `npm run tokens:check` fails on drift. The upstream Google Fonts import and the dark GNOME surface tokens are left out on purpose (decision 4: primitives only, the resume stays light and plain).
2. `src/styles/site.tokens.css`: semantic aliases (`--ink`, `--muted`, `--line`, status colors, chart series, layout widths). The accent and status colors are audited against white for AA and are not Orchis colors, because Orchis blue-light fails AA as text.
3. Component CSS in BEM: `base.css`, `layout.css` (`.page`, `.page__intro`), `resume.css`, and `components/` (`.stat-card`, `.data-table`, `.dropzone`, `.field`, `.chart`, `.tool-list`). `.topnav__link--cta` replaces the old `!important`.

Pages and components carry no inline styles. Stylelint blocks raw colors outside the two token files.

The site does not load web fonts: body text uses the system stack (`--font-body`). The Orchis font-family tokens are present but unused until a font is adopted (use the `@fontsource` packages, not a CDN).

## Build

`npm run build` runs `generate-pdf` (`scripts/pdf/ResumePdfBuilder.mjs` writes `public/faysal-ahmed-resume.pdf`, which is git-ignored) and then `astro build`.

## Quality gates

ESLint 9 with pinned rules, Prettier, `tsc --noEmit` with `checkJs`, Vitest unit tests with a 90 percent coverage threshold on `src/lib`, Playwright e2e plus axe (all pages pass with no violations). Known defects are pinned by `it.fails` (unit) and `test.fail()` (e2e) with their review ID; none are open. Open decisions (D8, D9) are in `docs/open-decisions.md`.

## Delivery

`.github/workflows/ci.yml` runs on every PR and push: static checks (ESLint, Stylelint, Prettier, tsc, `tokens:check`), unit tests with the coverage gate, one `build` (astro build plus the generated PDF, uploaded as the `dist` artifact), e2e and axe against that artifact (including every page under the proposed CSP), and a blocking `npm audit --omit=dev --audit-level=high`.

On push to `main` the `deploy` job needs all of them, runs in the `production` environment with `contents: read`, and queues behind any running deploy (`concurrency` with `cancel-in-progress: false`). It fails fast when the `SSH_KNOWN_HOSTS` secret is empty, connects over Tailscale (action pinned by commit SHA), and runs `scripts/deploy-release.sh`: rsync to `releases/<timestamp>-<sha>/`, atomic switch of the `current` symlink, keep the last five. Caddy serves `current`. Recovery is in `docs/rollback.md`; the proposed Caddy block with security headers and the host migration steps are in `docs/caddy/Caddyfile.proposed.md`.
