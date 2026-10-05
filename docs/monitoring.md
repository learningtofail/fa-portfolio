# Monitoring and shared conventions

## Uptime Kuma keyword checks

Add one HTTP(s) Keyword monitor per URL, interval 5 minutes, alert when the keyword is missing. The keyword is the tool's `<h1>` text (from `src/data/tools.js`), so a blank page, a 404 page or a failed deploy all trip it.

| Monitor name               | URL                                                        | Keyword                                                                        |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| portfolio home             | `https://portfolio.faysalahmed.ca/`                        | `Faysal Ahmed`                                                                 |
| portfolio resume PDF       | `https://portfolio.faysalahmed.ca/faysal-ahmed-resume.pdf` | `%PDF` (HTTP status check is enough if the keyword monitor cannot read binary) |
| portfolio utm-auditor      | `https://portfolio.faysalahmed.ca/tools/utm-auditor/`      | `UTM Governance Auditor`                                                       |
| portfolio gtm-auditor      | `https://portfolio.faysalahmed.ca/tools/gtm-auditor/`      | `GTM Container Auditor`                                                        |
| portfolio cac-calculator   | `https://portfolio.faysalahmed.ca/tools/cac-calculator/`   | `CAC / LTV / Payback Calculator`                                               |
| portfolio attribution      | `https://portfolio.faysalahmed.ca/tools/attribution/`      | `Multi-Touch Attribution`                                                      |
| portfolio disclosure-check | `https://portfolio.faysalahmed.ca/tools/disclosure-check/` | `Disclosure Language Checker`                                                  |

When a tool is added, add its row here in the same PR.

## Embedding by www

The fa-www site shows these tools in an iframe. That works only while the response carries `frame-ancestors https://www.faysalahmed.ca` (enforced in `docs/caddy/Caddyfile.proposed.md`). Do not add `X-Frame-Options`. If www embeds break, check that header first:

```bash
curl -sI https://portfolio.faysalahmed.ca/tools/utm-auditor/ | grep -i content-security-policy
```

## Tokens in CI

`npm run tokens:check` runs in the `static` job of `.github/workflows/ci.yml` with `TOKENS_CHECK_REQUIRE_NETWORK=1`, so a drifted or unreachable vendored token file fails the build instead of passing silently. `npm run lint:css` runs beside it.

## Copy, do not share

Lint, Prettier, tsconfig, Stylelint and workflow files are copied between fa-portfolio and fa-www, never shared through a package or submodule. Each repo then deploys and breaks alone. When you change one, note it in the PR so the other repo can take the same change by hand. `src/data/tools.js` is likewise mirrored by hand; neither repo imports from the other.
