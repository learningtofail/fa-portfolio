# 0006 Brand separation guard

**Decision.** The separate consultancy brand name must not appear anywhere on this site. `tests/unit/data.test.js` scans the data files and fails if it does.

**Why.** This is a personal portfolio; the consultancy is a different business with its own site and audience, and the two must not be linkable from here.

**Rules.** Do not add the name to copy, metadata, alt text, comments in shipped files, or fixtures. If the guard needs to cover more files, extend the test rather than relying on review. The guard test holds the pattern, so do not repeat the name in docs either.
