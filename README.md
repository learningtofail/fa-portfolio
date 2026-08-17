# fa-portfolio

Astro project for `portfolio.faysalahmed.ca`. Static output, React islands for interactive tools, D3 for visualizations.

## What's here (Phase 5 delivery)

The real single-page resume site, replacing the one-line placeholder from Phase 4:

- **`src/data/resume.js`** — single source of truth for all page content (summary, all 7 experience entries, skills, contact), sourced from the approved Phase 2 portfolio copy. `src/pages/index.astro` and `scripts/generate-pdf.mjs` both read from this file, so the page and the PDF can't drift apart.
- **`src/pages/index.astro`** — sticky anchored nav (Summary / Experience / Skills / Tools / Contact / Download PDF), full experience section with all 7 entries (nothing collapsed — the Phase 0 PRD's goal was zero-click access for a recruiter, so collapsing older roles behind interaction would work against that), skills grid, tools card grid (pulls from `src/data/tools.js`, same file `/tools/index.astro` uses), contact block.
- **`scripts/generate-pdf.mjs`** — generates `public/faysal-ahmed-resume.pdf` from `resume.js` via `pdfkit`, wired into `npm run build` (runs before `astro build` so the PDF lands in `public/` and gets copied into `dist/`). 3 pages, verified by rendering to images and reading them back — content matches the page exactly, formatting is clean.
- Brand-separation check (Phase 5 item 5): grepped the built HTML, all JS bundles, the generated PDF, and the source — zero matches for "Gibran" anywhere. Confirmed clean.
- Full functional verification with Playwright: all 5 tool card links resolve 200, the PDF link resolves 200 with the correct content-type, anchor nav scrolling works, no page errors.

Two calls worth knowing about, both flagged in the Phase 2 copy doc and carried through here rather than re-litigated: Early Career (2004–2013) is one consolidated block, not five separate role entries, and "Gibran Digital Inc." is never named — the consulting work and results are included under "Self-Employed — Independent Digital Marketing Consultant" instead.

## Phase 9 — Assets

- **Favicon** (`public/favicon.svg`, plus rasterized `favicon-32.png`/`apple-touch-icon.png`/`favicon-512.png`) — an "FA" monogram on the site's existing accent blue, built directly as SVG rather than AI-generated, since exact letterforms are something code does more reliably than an image model.
- **OG/Twitter card** — `public/og-image.png` (1200×630), a clean branded typographic card (name, headline, subhead, two stat pills) built as an HTML page and screenshotted, for the same reason: crisp, exact text beats an AI model's attempt at rendering a name and title legibly. Meta tags wired into `Base.astro` (`og:title`, `og:description`, `og:image`, `og:url`, Twitter card equivalents) using `Astro.site` for absolute URLs. This matters in practice, not just as a checkbox — Phase 8's Cloudflare rule explicitly exempts link-preview bots from the block, so this card is what actually renders when the URL is shared in Slack/iMessage/LinkedIn.
- **Headshot, added but off by default** — `summary.headshot` in `src/data/resume.js` (`{ enabled: false, src: "/headshot.jpg", alt: "Faysal Ahmed" }`) and a `.summary-header`/`.headshot` layout in `index.astro` that only renders when `enabled` is `true`. Gated rather than wired-and-hoping, so the build never references a photo file that doesn't exist yet. To turn it on: drop a real photo at `public/headshot.jpg` (square-ish crop, ≥480×480, shoulders-up reads best at the 128px circular display size) and flip `enabled` to `true`. Not AI-generated — a real photo of a real person isn't something to fabricate, this is just the placement/plumbing.

No app-icon-style artwork needed here — the icon set is a `www`-only concept (desktop/mobile app icons), not part of this site.

## What's here (Phase 4 delivery)

Base project scaffold — this is the foundation the Phase 5 portfolio build sits on top of, not just a home for these tools. `/tools/` index page lists all five locked slugs (see `phase-4-tool-slugs.md` in the project docs); all five are now live.

- **`/tools/utm-auditor`** — upload a CSV (`url` column, or `utm_source`/`utm_medium`/`utm_campaign`/optional `utm_term`/`utm_content` columns). Flags missing required fields, whitespace, invalid characters, casing drift, mixed campaign separators (`-`/`_`/`.`), and duplicate source/medium/campaign combinations pointing at different URLs.
- **`/tools/gtm-auditor`** — upload a GTM container export (.json). Flags paused tags, tags with no firing trigger, unused variables (not referenced via `{{...}}` anywhere in the container), unused triggers, duplicate names, and generic/default names (e.g. "Tag 1").
- **`/tools/cac-calculator`** — live-updating CAC, LTV, LTV:CAC ratio, and payback period from spend/customers/revenue/margin/churn inputs, with a cumulative-gross-profit-vs-CAC chart marking the payback month.
- **`/tools/attribution`** — upload a touchpoint CSV (`journey_id`, `channel`, `timestamp`, optional `revenue`). Computes last-touch, first-touch, linear, position-based (40/20/40), and time-decay (7-day half-life) credit per channel, shown as a grouped bar chart plus a full matrix table.
- **`/tools/disclosure-check`** — paste copy or upload a CSV, pick a ruleset (affiliate/FTC, regulated health, cannabis/age-restricted, financial), flags lines missing all patterns in that ruleset. Explicitly labeled as a pattern-matching aid, not legal advice.

All five are client-side only — no fetch calls, nothing uploaded or pasted leaves the browser. Every tool was verified with Playwright against sample data; for the attribution tool I hand-checked the last-touch/first-touch/linear/position-based/time-decay math against the sample CSV and every value matched.

`robots.txt` (`Disallow: /`) and a `noindex, nofollow` meta tag in the base layout — Phase 8's bot-blocking decision, applied from day one rather than retrofitted later.

## Phase 8 — Bot blocking, remaining layers

The advisory layer above was already live; verified unchanged. Two more layers need your `ganesha`/Cloudflare dashboard access to apply — an `X-Robots-Tag` HTTP header at the Caddy level, and the actual enforcement (Super Bot Fight Mode + a WAF rule exempting link-preview bots so Slack/iMessage/LinkedIn unfurls keep working) — both copy-paste ready in `phase8-infra-config.md`, delivered alongside this zip.

## Phase 8 — Accessibility (WCAG 2.1 AA baseline)

This is the recruiter-facing, accessibility-sensitive site, so it got the full AA baseline rather than the documented-best-effort tier applied to `www`. Real, verified fixes, not just markup gestures:

- **File-upload dropzones were keyboard-unreachable.** The pretty drag-and-drop `<div>`s in all four upload-based tools (UTM auditor, GTM auditor, attribution, disclosure checker) had no `tabIndex`, no `role`, and no key handler — a keyboard-only user had no way to trigger the file picker at all, since the real `<input type="file">` was `display:none` and never in the tab order. Fixed with the standard ARIA custom-button pattern: `role="button"`, `tabIndex={0}`, a descriptive `aria-label` (including the currently-loaded filename once one's chosen), and an `onKeyDown` handler for Enter/Space. Verified by tabbing to each dropzone with no mouse.
- **Form labels weren't programmatically associated with their inputs.** The CAC calculator's five `<label>`s were visual siblings of their `<input>`s with no `htmlFor`/`id` pairing — a screen reader focusing the input would announce nothing. Same issue on the disclosure checker's ruleset `<select>`. Fixed with `id`/`htmlFor` pairs everywhere; verified via each input's `.labels` collection.
- **The disclosure checker's two radio buttons weren't actually grouped** — no shared `name` attribute, so arrow-key navigation between them didn't work as a native radio group would. Added `name="input-mode"` plus a `role="radiogroup"` wrapper with an `aria-label`.
- **Skip link.** Added to `Base.astro`, first tab stop on every page, target is `id="main-content"` with `tabindex="-1"` on each page's `<main>` — without the `tabindex`, `<main>` isn't natively focusable and activating the skip link would scroll but not actually move keyboard focus, which defeats the point. Verified `document.activeElement` lands on `#main-content` after activating it.
- **Async result updates weren't announced.** Each tool's stat-card summary row now has `aria-live="polite" aria-atomic="true"`, so a screen reader user gets told the numbers changed after uploading a file or editing a calculator input, without needing to re-navigate to find out. Chart SVGs (`BarChart`, `GroupedBarChart`, `PaybackChart`) are marked `aria-hidden="true"` since every value they show is already in an adjacent accessible table or stat card — they're decorative duplicates, not a second source of information.
- **Color contrast.** Computed contrast ratios (WCAG formula, not eyeballed) for every text color against its background found two failures at normal-text size: the "Healthy"/pass-state green (`#2a8a4a`, 4.35:1) and the "Marginal"-state amber (`#b8860b`, 3.25:1), both below the 4.5:1 AA minimum. Darkened to `#216e3b` (6.25:1) and `#8a6408` (5.37:1) respectively — same hue, passes now. Also nudged the `#777` disclaimer-text gray to `#6b6b6b` (was 4.48:1, just under the line).
- Global `:focus-visible` styling (2px accent-colored ring) added in `Base.astro` so focus indicators are consistent across every interactive element, not just relying on each browser's default.

Not changed: page structure was already sound going in — correct heading hierarchy (no skipped levels), `<nav>`/`<main>` landmarks, semantic `<section>`/`<article>` use, and no images requiring alt text. Verified with Playwright: keyboard-only navigation through the skip link, tab order onto and activation of a dropzone, and label-to-input association checks, plus a full re-run of every tool's original functional test (UTM/GTM/attribution/disclosure results, resume page nav, PDF export) to confirm zero regressions from the accessibility pass.

## Local development

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # outputs to dist/
npm run preview   # serve the built output locally
```

## Deploying to ganesha

This replaces the current placeholder at `/opt/static-web/sites/portfolio` (per `stage-0-access-reference.md`, that path is already a git-initialized clone of `git@github.com:learningtofail/fa-portfolio.git`, pushed to `main`).

Suggested path — build locally (or on `ganesha` via code-server) and push, then let the existing static-hosting setup pick it up. Two ways to get there:

**Option A — replace the repo contents and let the existing deploy path handle it:**
```bash
# on ganesha, inside /opt/static-web/sites/portfolio
git checkout -b phase-4-tools
# copy this project's files in (everything except node_modules/dist/.astro), replacing what's there
npm install
npm run build
git add .
git commit -m "Phase 4: Astro scaffold + all five marketing tools"
git push origin phase-4-tools
# open a PR or merge to main per however you want to review it
```

**Option B — build here, ship the dist:** if the current Caddy setup serves a plain static directory rather than running a build step itself, run `npm run build` and rsync/copy `dist/` into wherever Caddy's `sites/portfolio` root actually points. Confirm which pattern `/opt/static-web/Caddyfile` currently expects (raw static files vs. a build step) before choosing — I don't have visibility into that file's current contents from this session.

## Known gaps, by design

- All five named tools from the plan are built. `[STATIC]` tools beyond these five aren't identified yet (Phase 4 item 6) — nothing to build until they're scoped.
- Umami's tracking snippet isn't wired in yet — depends on Phase 3's Umami instance being live and a site being registered in it first.
- No visual design system applied — clean but plain styling (system-ui, minimal color), Phase 7 owns the actual look. The page is fully functional and legible as-is.
- The CAC calculator's LTV:CAC benchmark labels (3:1+ "healthy", etc.) are stated in the UI as common SaaS rules of thumb, not universal targets — worth a look if this is being positioned for a non-SaaS audience.
- The disclosure checker's rulesets are a small, generic starting set of common phrases per category, explicitly labeled as a pattern-matching aid rather than a compliance tool — real campaigns still need actual legal/compliance review.
- The generated PDF runs 3 pages; page 3 is mostly whitespace (just Languages/Certifications/Tools note spilled over). Cosmetic, not broken — tightening pagination is a reasonable Phase 7 cleanup, not urgent.
- `npm run build` now requires `pdfkit` (added as a dependency) — no new system dependency, pure JS, nothing else changes about the build environment.

## Note on the collapse/full-detail decision (Phase 5 item 1)

Resolved via the Phase 2 copy pass, carried through unchanged: the 4 most recent/senior roles (AutoTrader, Merkle Cardinal Path, Klick Health, Cardinal Path) are in full detail, Orkin is condensed, and everything before 2013 is one consolidated "Early Career" block rather than 5 separate entries. Nothing is collapsed behind a click — see the note above on why.
