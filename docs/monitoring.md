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

The 21 vendored marketing tools (served from `/marketing/`, shown in www's Marketing folder) get one monitor each. Use the same settings:

| Monitor name                               | URL                                                                                | Keyword                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| marketing ad-claims-flagger                | `https://portfolio.faysalahmed.ca/marketing/ad-claims-flagger.html`                | `Ad Claims Flagger`                                      |
| marketing affiliate-concentration-analyzer | `https://portfolio.faysalahmed.ca/marketing/affiliate-concentration-analyzer.html` | `Affiliate Revenue Concentration Risk Analyzer`          |
| marketing affiliate-margin-calculator      | `https://portfolio.faysalahmed.ca/marketing/affiliate-margin-calculator.html`      | `Affiliate Commission & Margin Viability Calculator`     |
| marketing attribution-window-normalizer    | `https://portfolio.faysalahmed.ca/marketing/attribution-window-normalizer.html`    | `Attribution Window Normalizer`                          |
| marketing bot-traffic-screener             | `https://portfolio.faysalahmed.ca/marketing/bot-traffic-screener.html`             | `Web Traffic Quality & Bot Anomaly Screener`             |
| marketing brand-incrementality             | `https://portfolio.faysalahmed.ca/marketing/brand-incrementality.html`             | `Paid Search Brand Incrementality Estimator`             |
| marketing cac-payback-modeler              | `https://portfolio.faysalahmed.ca/marketing/cac-payback-modeler.html`              | `CAC, Margin & Payback Modeler`                          |
| marketing creative-decay-monitor           | `https://portfolio.faysalahmed.ca/marketing/creative-decay-monitor.html`           | `Paid Social Creative & Frequency Decay Monitor`         |
| marketing demand-capacity-guardrail        | `https://portfolio.faysalahmed.ca/marketing/demand-capacity-guardrail.html`        | `Demand Forecasting & Inventory Capacity Guardrail`      |
| marketing experiment-analyzer              | `https://portfolio.faysalahmed.ca/marketing/experiment-analyzer.html`              | `A/B, Multivariate & Campaign Experiment Analyzer`       |
| marketing feature-messaging-gap            | `https://portfolio.faysalahmed.ca/marketing/feature-messaging-gap.html`            | `Feature-to-Messaging Gap Analyzer`                      |
| marketing gtm-container-auditor            | `https://portfolio.faysalahmed.ca/marketing/gtm-container-auditor.html`            | `GTM Container Auditor`                                  |
| marketing promo-capacity-checker           | `https://portfolio.faysalahmed.ca/marketing/promo-capacity-checker.html`           | `Promotional Capacity Sanity-Checker`                    |
| marketing quality-score-scorer             | `https://portfolio.faysalahmed.ca/marketing/quality-score-scorer.html`             | `Ad Copy & Landing Page Readiness Checklist`             |
| marketing redirect-mapper                  | `https://portfolio.faysalahmed.ca/marketing/redirect-mapper.html`                  | `Bulk Redirect Mapper & Loop Validator`                  |
| marketing scv-gap-calculator               | `https://portfolio.faysalahmed.ca/marketing/scv-gap-calculator.html`               | `Single Customer View Gap Calculator`                    |
| marketing seasonality-visualizer           | `https://portfolio.faysalahmed.ca/marketing/seasonality-visualizer.html`           | `Paid Search Seasonality Demand Curve Visualizer`        |
| marketing seo-equivalent-value             | `https://portfolio.faysalahmed.ca/marketing/seo-equivalent-value.html`             | `SEO Equivalent Value Translator`                        |
| marketing sqr-negative-keywords            | `https://portfolio.faysalahmed.ca/marketing/sqr-negative-keywords.html`            | `Search Query Report Bleed & Negative Keyword Extractor` |
| marketing traffic-reconciler               | `https://portfolio.faysalahmed.ca/marketing/traffic-reconciler.html`               | `Reported-to-Verified Traffic Reconciler`                |
| marketing utm-governance-auditor           | `https://portfolio.faysalahmed.ca/marketing/utm-governance-auditor.html`           | `UTM Governance Auditor`                                 |

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
