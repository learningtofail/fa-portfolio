# 0003 CSP and iframe embedding

**Decision.** Pages may be framed only by `https://www.faysalahmed.ca`, because fa-www embeds the tools in an iframe. This is `frame-ancestors https://www.faysalahmed.ca`, enforced from day one. Do not send `X-Frame-Options`: `ALLOW-FROM` is obsolete and `SAMEORIGIN` would block www.

**Full CSP.** Script and style sources are `'self'` plus SHA-256 hashes of Astro's few inline blocks (`npm run csp:hashes`). Stylesheets are external (`build.inlineStylesheets: "never"`). It ships report-only first and is promoted after a clean observation period. `tests/e2e/csp.spec.js` loads every page under the enforced policy, so a hash going stale fails CI.

**After an Astro upgrade** run `npm run csp:hashes` and update `docs/caddy/Caddyfile.proposed.md`.

**Would change if** www moves host (update `frame-ancestors`) or a tool needs a third-party origin (needs ADR 0002 first). Monitoring: `docs/monitoring.md`.
