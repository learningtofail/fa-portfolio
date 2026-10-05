# 0005 No inline styles

**Decision.** No `style` attributes in Astro or React, and no inline event handler attributes. Styling is BEM classes reading Orchis tokens; raw colors exist only in `orchis.tokens.css` and `site.tokens.css`. D3 sets class names, not colors.

**Why.** It keeps the CSP free of `style-src 'unsafe-inline'`, keeps every color traceable to a token, and makes theming and reduced motion one-place changes.

**Enforcement.** Stylelint (`npm run lint:css`), and an e2e test that asserts zero `[style]` elements on every page.

**Exception path.** A value that must be dynamic (for example a measured chart width) is set through the SVG or DOM attribute API or a CSS class variant, never a `style` attribute. If that is impossible, write a record here first.
