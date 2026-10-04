# CLAUDE.md

Astro 7 static site with React 19 islands. See `docs/architecture.md` for the current design.

## Commands

- `npm run check`: lint, format check, typecheck, unit tests. Run before every commit.
- `npm run build` then `npm run test:e2e`: Playwright serves `astro preview`. Set `PW_CHROMIUM_PATH` to an existing Chromium binary when Playwright's own download is unavailable.
- `npm run lint:fix`, `npm run format`.

## Repo map

- `src/pages/`: Astro pages. `tools/` has one page per tool.
- `src/components/`: one React component per tool, plus the D3 charts.
- `src/data/`: `resume.js` (page and PDF content), `tools.js` (tool catalog).
- `scripts/generate-pdf.mjs`: builds the resume PDF from `resume.js`. The PDF is generated, not tracked.
- `tests/unit/`: Vitest + Testing Library. `tests/e2e/`: Playwright + axe.

## Conventions

- Never push to `main`. Merging to `main` deploys production. Work on a branch and open a PR.
- ES modules, `const` by default, no `var`, no `console.log` (scripts excepted).
- Do not widen a lint ignore or inline disable without a comment giving the reason and the plan item that removes it.
- No new inline styles or inline event handlers. Existing ones are tracked for removal in refactor Phase 3 and Phase 4.
- Known defects are pinned with `it.fails` / `test.fail()`. When you fix one, delete its marker in the same commit.
- Never key a plain object by user data (`{}` collides with `constructor`). Use `Map` or `Object.create(null)`.
- `src/data/tools.js` is mirrored by hand in fa-www. Do not import from that repo.
- The consultancy brand name must not appear anywhere on this site; `tests/unit/data.test.js` guards the data files.
- Secrets and hostnames live in repository secrets, never in workflow files.
