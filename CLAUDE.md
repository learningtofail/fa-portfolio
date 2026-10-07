# CLAUDE.md

Astro 7 static site with React 19 islands. See `docs/architecture.md` for the current design.

## Commands

- `npm run check`: lint, format check, typecheck, unit tests. Run before every commit.
- `npm run build` then `npm run test:e2e`: Playwright serves `astro preview`. Set `PW_CHROMIUM_PATH` to an existing Chromium binary when Playwright's own download is unavailable.
- `npm run lint:fix`, `npm run format`.
- `npm run tokens:check`: diffs the vendored Orchis tokens against the pinned design-system commit (needs network; offline it verifies the recorded hash only). `npm run tokens:sync -- <sha>` re-vendors at a new commit.

## Repo map

- `src/pages/`: `index.astro` (resume) and `tools/index.astro`; `tools/[slug].astro` builds one page per live tool from `src/data/tools.js` through `src/layouts/ToolLayout.astro`. URLs stay `/tools/<slug>/`.
- `src/lib/`: pure, unit-tested logic with JSDoc types: `csv.js`, `utm/audit.js`, `gtm/audit.js`, `attribution/compute.js`, `disclosure/{rulesets,check}.js`, `cac/calc.js`. No DOM, no React.
- `src/components/`: `tools/` (one thin component per tool, roughly 60 to 100 lines), `kit/` (FileDropzone, StatCard, StatRow, DataTable, ToolShell, ErrorNotice, useFileInput, useFileAnalysis), `charts/` (D3 charts and `useChartWidth`).
- `src/data/`: `resume.js` (page and PDF content), `tools.js` (tool catalog with title, intro and meta description), `years.js` (years of experience, computed from 2004 at build time).
- `src/styles/`: `orchis.tokens.css` (vendored, never hand-edit, pinned by `orchis.tokens.manifest.json`), `site.tokens.css` (semantic aliases and the only other place raw colors may live), `base.css`, `layout.css` (`.page`), `resume.css` (index page), `components/*.css` (BEM component styles, imported through `components.css`).
- `public/marketing/`: 21 vendored single-file marketing tools plus `examples/<slug>/` sample files they link to (built output from github.com/learningtofail/marketing-tools via `scripts/export-for-portfolio.sh`; never hand-edit, replace the files). Served under their own CSP (`docs/decisions/0007-vendored-marketing-tools.md`). They are not covered by the no-inline-styles rule or the token rules.
- `scripts/tokens/`: vendoring and drift check for the Orchis tokens.
- `scripts/deploy-release.sh`: atomic release deploy and rollback (has a `--dry-run`). `scripts/csp-hashes.mjs`: CSP hashes for Astro's inline code.
- `docs/decisions/`: decision records (robots, privacy, CSP, adding a tool, inline styles, brand guard).
- `docs/monitoring.md`: Uptime Kuma checks per URL, www embedding, copy-not-share policy.
- `docs/rollback.md`, `docs/caddy/Caddyfile.proposed.md`: recovery, and the proposed Caddy block with the one-time host migration.
- `scripts/generate-pdf.mjs` and `scripts/pdf/ResumePdfBuilder.mjs`: build the resume PDF from `resume.js`. The PDF is generated, not tracked.
- `tests/unit/`: Vitest + Testing Library (`tests/unit/lib/` for the lib modules). `tests/e2e/`: Playwright + axe. `tests/fixtures/`: shared fixtures, including the hand-verified attribution golden files.

## Adding a tool

1. Put the logic in a new pure module under `src/lib/<tool>/` with JSDoc types and a fixture-based test in `tests/unit/lib/`. Coverage on `src/lib` must stay at 90 percent or better (`npm run test:coverage`).
2. Add a thin component in `src/components/tools/` built from the kit (`ToolShell`, `FileDropzone`, `useFileAnalysis`, `StatRow`, `DataTable`). It should stay well under 150 lines.
3. Add an entry to `src/data/tools.js` (slug, name, title, description, intro, metaDescription) and one line in `src/pages/tools/[slug].astro`.
4. Add the tool's e2e and axe cases to `tests/e2e/site.spec.js`.

## Adding the A/B experiment analyzer

This is the planned sixth tool. Follow "Adding a tool" with these specifics:

- Lib module `src/lib/experiment/analyze.js`: pure functions taking per-variant visitors and conversions (from a CSV parsed by `src/lib/csv.js`) and returning rate, relative lift, a two-proportion z-test p-value and confidence interval, and a plain warning list (sample too small, unequal split). Use `Map` for variant names, since they are user data.
- Tests in `tests/unit/lib/experiment.test.js` with hand-checked values and edge cases (zero visitors, one variant, identical rates). Keep `src/lib` coverage at 90 percent.
- Component `src/components/tools/ExperimentAnalyzer.jsx` from the kit (`ToolShell`, `FileDropzone`, `useFileAnalysis`, `StatRow`, `DataTable`).
- Catalog entry in `src/data/tools.js` with `live: true`, one line in `src/pages/tools/[slug].astro`, e2e and axe cases, and a row in `docs/monitoring.md`. Mirror the catalog entry in fa-www by hand.
- Client-side only (`docs/decisions/0002-client-side-tools-privacy.md`).

## Conventions

- Never push to `main`. Merging to `main` deploys production. Work on a branch and open a PR.
- Logic goes in `src/lib`, never in a component. Never key a React list by array index; give the lib result a stable `id`.
- ES modules, `const` by default, no `var`, no `console.log` (scripts excepted).
- Do not widen a lint ignore or inline disable without a comment giving the reason and the plan item that removes it.
- No inline `style` attributes, in Astro or React (an e2e test asserts zero `[style]` nodes on every page). Style with BEM classes that read tokens. Inline event handlers on components are tracked for removal in refactor Phase 4.
- No hex or rgb() colors outside `orchis.tokens.css` and `site.tokens.css`; Stylelint enforces it (`npm run lint:css`). Class names are BEM, no `!important`, no ids in selectors.
- Chart colors are CSS classes (`chart__series--N`, `chart__bar`) that read `--chart-N`; D3 code sets class names, never colors.
- Known defects are pinned with `it.fails` / `test.fail()`. When you fix one, delete its marker in the same commit.
- Never key a plain object by user data (`{}` collides with `constructor`). Use `Map` or `Object.create(null)`.
- `src/data/tools.js` is mirrored by hand in fa-www. Do not import from that repo.
- The consultancy brand name must not appear anywhere on this site; `tests/unit/data.test.js` guards the data files.
- Secrets and hostnames live in repository secrets, never in workflow files. Pass them to steps through `env:` and read shell variables; never interpolate `${{ secrets.* }}` into a `run:` script. Pin third-party actions by full commit SHA.
- Deploys never run `ssh-keyscan`; the host key comes from the `SSH_KNOWN_HOSTS` secret.
- The CSP in `docs/caddy/Caddyfile.proposed.md` is enforced in e2e (`tests/e2e/csp.spec.js`). After an Astro upgrade run `npm run csp:hashes` and update the hashes there.
