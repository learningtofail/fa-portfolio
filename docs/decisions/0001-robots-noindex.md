# 0001 Robots and noindex

**Decision.** The site is not indexed. `public/robots.txt` is `User-agent: *` / `Disallow: /`, every page carries `<meta name="robots" content="noindex, nofollow">` (`src/layouts/Base.astro`), and the proposed Caddy block sends `X-Robots-Tag: noindex, nofollow`.

**Why.** The portfolio is shared by direct link, not discovered by search. Cloudflare WAF bot blocking is the other half of the policy for personal sites.

**Disallow versus noindex.** These are different controls and they interact badly. `Disallow` stops compliant crawlers from fetching the page, so they never see the `noindex` tag; a disallowed URL that is linked from elsewhere can still appear in results as a bare URL. `noindex` only works if the crawler may fetch the page. We keep both on purpose: `Disallow` reduces crawl load and polite bot traffic, and the header and meta tag are the backstop for crawlers that fetch anyway. If the goal ever becomes removing an already listed URL, drop `Disallow` temporarily so the `noindex` can be read.

**Would change if** the site should rank for the tools. Remove all three controls together, add a sitemap and canonical URLs.
