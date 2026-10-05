# fa-portfolio

Source for `portfolio.faysalahmed.ca`: an Astro static resume page plus two client-side React-island tools (attribution, disclosure check; PapaParse, D3) and 21 vendored single-file marketing tools under `/marketing/`. Nothing a visitor enters leaves the browser.

```bash
npm ci
npm run dev        # http://localhost:4321
npm run check      # lint + format:check + typecheck + unit tests
npm run build      # generates the resume PDF, then builds to dist/
npm run test:e2e   # Playwright against the built site (needs a Chromium; see CLAUDE.md)
```

Requires Node >= 22.12 (`.nvmrc`). Merging to `main` deploys to production through GitHub Actions.

- Contributor and agent guide: [CLAUDE.md](CLAUDE.md)
- Current architecture: [docs/architecture.md](docs/architecture.md)
- Why things are the way they are: [docs/decisions/](docs/decisions/README.md)
- Making the repo private (runbook): [docs/make-private.md](docs/make-private.md)
- How the site was built, phase by phase: [docs/history.md](docs/history.md)
