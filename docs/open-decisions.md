# Open decisions

Items from the refactor review that need input the repo cannot supply. Nothing here changes tool output until the decision is made.

## D8: GTM auditor false positives

Suspected: tags that only run as setup or teardown tags have no firing trigger by design, and triggers used only inside a Trigger Group count as unused. The auditor reports both.

Needs: a real Google Tag Manager container export (JSON) from a container that uses setup/teardown tags and a Trigger Group, with identifying values redacted. Until then `tests/unit/GtmAuditor.test.jsx` holds a clearly labelled synthetic characterization test that pins today's behavior. When the export arrives, confirm the schema fields, add the export as a fixture, and flip the two characterization assertions together with the auditor change.

## D9: Attribution revenue input contract

Today revenue is summed across a journey's rows, so an export that repeats the conversion value on every touchpoint inflates credit n times, and journeys without revenue count as 1 beside dollar values from other journeys.

Shipped now (no math change): the tool warns when a journey repeats one identical revenue figure on several rows and when journeys with and without revenue are mixed.

Contract options to choose from:

1. One conversion revenue per journey. Use the last non-empty value, or the maximum, per journey instead of the sum. Simple; matches most exports.
2. A dedicated `conversion_revenue` column. Revenue is read only from that column, once per journey; the old `revenue` column is ignored or rejected with a message. Explicit; needs a migration note.
3. Keep summing, but require the user to choose in the UI ("revenue is per touchpoint" or "revenue repeats per journey"). Most flexible; most UI.

For mixed units, the likely rule is: if any journey has revenue, journeys without revenue contribute 0 and are reported, or the file is rejected until the user picks count-based mode.

Needs: pick an option. The change is then a small edit to `computeAttribution` plus test updates.
