# 0002 Client-side-only tools and privacy statement

**Decision.** Every tool parses and analyzes files in the visitor's browser. There is no upload endpoint, no server code, and no analytics call that carries file content. The CSP `connect-src 'self'` makes this enforceable, not just promised.

**Privacy statement shown on each tool page:** "Nothing you upload is sent anywhere. Parsing and analysis happen entirely in this tab." Keep every tool intro consistent with it.

**Why.** Visitors are marketers who will test with real campaign, container and revenue exports. Not receiving them removes the retention, breach and consent questions.

**Rules.** No `fetch`, `XMLHttpRequest`, `sendBeacon` or third-party script in `src/lib` or `src/components`. Test fixtures are synthetic. A feature that needs a server is a new decision record and a change to the privacy statement first.
