# 0007: Vendored marketing tools under /marketing/

Status: accepted. Files live in `public/marketing/`, served by the `handle /marketing/*` block in `docs/caddy/Caddyfile.proposed.md`.

## Decision

- The 21 marketing tools are single-file HTML pages built by a separate project (`build.py`, `standalone: true`, `home_url: ""`). They are copied here as built output, never edited by hand. To change one, rebuild from that project and replace the file.
- They are not Astro pages. They do not use the Orchis tokens, the kit or the BEM styles, and they carry inline `<script>`, `<style>` and `style` attributes. This is a documented exception to decision 0005 (no inline styles), limited to `public/marketing/`.
- Because of that, `/marketing/*` gets its own enforced CSP: inline script and style allowed, `connect-src 'none'`, `form-action 'none'`, `default-src 'none'`, `img-src data: blob:`, and `frame-ancestors https://www.faysalahmed.ca`. A page that cannot make a request cannot send what a visitor types anywhere (decision 0002 still holds).
- www shows each tool in its own app window through the same iframe path as the five Astro tools (decision 0003). The frame there adds `allow-modals` so Print or save PDF works.
- The tools keep their inputs in `localStorage` under keys that start with `mt:`, on the portfolio origin.

## Checks

`tests/e2e/marketing.spec.js` loads every page under the policy from the Caddy doc, enforced, and fails on any violation, page error or request to another origin. `tests/unit/marketingFiles.test.js` checks that each page has no outside links, no network calls, no directory-page link and no consultancy brand name.

## What would change it

Converting a tool into an Astro page (then it follows 0004 and 0005 and leaves this folder), or a tool that needs a network call.
