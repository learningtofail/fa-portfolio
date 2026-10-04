# CLAUDE.md

Astro 7 static site with React 19 islands. See `docs/architecture.md` for the current design.

## Commands

- `npm run check`: lint, format check, typecheck, unit tests. Run before every commit.
- `npm run build` then `npm run test:e2e`: Playwright serves `astro preview`. Set `PW_CHROMIUM_PATH` to an existing Chromium binary when Playwright's own download is unavailable.
- `npm run lint:fix`, `npm run format`.
- `npm run tokens:check`: diffs the vendored Orchis tokens against the pinned design-system commit (needs network; offline it verifies the recorded hash only). `npm run tokens:sync -- <sha>` re-vendors at a new commit.

## Repo map

- `src/pages/`: Astro pages. `tools/` has one page per tool.
- `src/components/`: one React component per tool, plus the D3 charts.
- `src/data/`: `resume.js` (page and PDF content), `tools.js` (tool catalog).
- `src/styles/`: `orchis.tokens.css` (vendored, never hand-edit, pinned by `orchis.tokens.manifest.json`), `site.tokens.css` (semantic aliases and the only other place raw colors may live), `base.css`, `layout.css` (`.page`), `resume.css` (index page), `components/*.css` (BEM component styles, imported through `components.css`).
- `scripts/tokens/`: vendoring and drift check for the Orchis tokens.
- `scripts/generate-pdf.mjs`: builds the resume PDF from `resume.js`. The PDF is generated, not tracked.
- `tests/unit/`: Vitest + Testing Library. `tests/e2e/`: Playwright + axe.

## Conventions

- Never push to `main`. Merging to `main` deploys production. Work on a branch and open a PR.
- ES modules, `const` by default, no `var`, no `console.log` (scripts excepted).
- Do not widen a lint ignore or inline disable without a comment giving the reason and the plan item that removes it.
- No inline `style` attributes, in Astro or React (an e2e test asserts zero `[style]` nodes on every page). Style with BEM classes that read tokens. Inline event handlers on components are tracked for removal in refactor Phase 4.
- No hex or rgb() colors outside `orchis.tokens.css` and `site.tokens.css`; Stylelint enforces it (`npm run lint:css`). Class names are BEM, no `!important`, no ids in selectors.
- Chart colors are CSS classes (`chart__series--N`, `chart__bar`) that read `--chart-N`; D3 code sets class names, never colors.
- Known defects are pinned with `it.fails` / `test.fail()`. When you fix one, delete its marker in the same commit.
- Never key a plain object by user data (`{}` collides with `constructor`). Use `Map` or `Object.create(null)`.
- `src/data/tools.js` is mirrored by hand in fa-www. Do not import from that repo.
- The consultancy brand name must not appear anywhere on this site; `tests/unit/data.test.js` guards the data files.
- Secrets and hostnames live in repository secrets, never in workflow files.
