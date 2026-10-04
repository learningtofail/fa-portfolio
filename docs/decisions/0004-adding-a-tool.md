# 0004 A new tool is one lib module and one thin component

**Decision.** Logic lives in a pure module under `src/lib/<tool>/` (no DOM, no React, JSDoc types, fixture tests, 90 percent coverage gate). The UI is one thin component in `src/components/tools/` built from `src/components/kit/`, normally 60 to 100 lines. Catalog data lives in `src/data/tools.js`.

**Why.** The first version had components of 110 to 330 lines that mixed parsing, scoring and markup, which made defects such as the prototype-keyed objects hard to find and test. Pure modules are cheap to test and reusable.

**Steps** are in `CLAUDE.md`, "Adding a tool". Astro cannot hydrate a runtime-chosen component, so `src/pages/tools/[slug].astro` has one explicit line per tool.
