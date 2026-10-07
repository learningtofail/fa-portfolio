# Open decisions

Items from the refactor review that need input the repo cannot supply. Nothing here changes tool output until the decision is made.

## D8: GTM auditor false positives

Suspected: tags that only run as setup or teardown tags have no firing trigger by design, and triggers used only inside a Trigger Group count as unused. The auditor reports both.

Needs: a real Google Tag Manager container export (JSON) from a container that uses setup/teardown tags and a Trigger Group, with identifying values redacted. Until then `tests/unit/GtmAuditor.test.jsx` holds a clearly labelled synthetic characterization test that pins today's behavior. When the export arrives, confirm the schema fields, add the export as a fixture, and flip the two characterization assertions together with the auditor change.

## D9: Attribution revenue input contract (resolved)

Resolved in the attribution repair. Revenue is valued once per journey, by a mode the user can change: first non-zero value (default), largest, last non-zero, or sum. Zero and negative cells are ignored outside sum mode; sum nets refunds. When the sum mode meets a journey that repeats or accumulates one value, the tool warns and marks the totals unreliable.

Conversions are defined explicitly: a `converted` column when mapped, otherwise only journeys with revenue when a revenue column exists (a checkbox can count every journey instead, which mixes units and is flagged), otherwise every journey counts as one conversion and the page says so. Non-converting journeys get no credit and are counted.

Still open: a dedicated `conversion_revenue` column (option 2 of the original proposal) was not needed once the mode and the conversion rule were explicit.
