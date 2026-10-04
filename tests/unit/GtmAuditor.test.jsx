import { render, screen, waitFor } from "@testing-library/react";
import GtmAuditor from "../../src/components/tools/GtmAuditor.jsx";
import { statValue, uploadFile } from "./helpers.js";

const container = (overrides = {}) =>
  JSON.stringify({
    containerVersion: {
      tag: [
        { name: "GA4 Config", firingTriggerId: ["1"], parameter: [{ value: "{{Used Var}}" }] },
        { name: "Old Pixel", paused: true, firingTriggerId: ["1"] },
        { name: "Orphan", firingTriggerId: [] },
        { name: "Tag 1", firingTriggerId: ["1"] },
      ],
      trigger: [
        { name: "All Pages", triggerId: "1" },
        { name: "Never Used", triggerId: "2" },
      ],
      variable: [{ name: "Used Var" }, { name: "Dead Var" }],
      ...overrides,
    },
  });

/** Returns the heading text of each non-empty finding group, e.g. "Paused tags (1)". Empty groups are not rendered. */
const findingHeadings = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("GtmAuditor (current behavior)", () => {
  it("counts tags, triggers and variables", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "gtm.json", container(), "application/json");
    expect(await statValue("Tags")).toBe("4");
    expect(await statValue("Triggers")).toBe("2");
    expect(await statValue("Variables")).toBe("2");
  });

  it("reports each finding category with its count", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "gtm.json", container(), "application/json");
    await waitFor(() => expect(findingHeadings().length).toBeGreaterThan(0));
    expect(findingHeadings()).toEqual([
      "Paused tags (1)",
      "Tags with no firing trigger (1)",
      "Unused variables (1)",
      "Unused triggers (1)",
      "Generic/default names (1)",
    ]);
  });

  it("rejects JSON that is not a GTM export with a visible message", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "other.json", JSON.stringify({ hello: "world" }), "application/json");
    expect((await screen.findByRole("alert")).textContent).toMatch(/No "containerVersion" found/);
  });

  it("rejects malformed JSON with a visible message", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "broken.json", "{not json", "application/json");
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

// Review D2: names are user data, so duplicate detection must not collide with Object.prototype keys.
describe("GtmAuditor names that collide with Object.prototype (D2)", () => {
  it.each(["constructor", "__proto__", "toString"])("audits tags, triggers and variables named %s", async (name) => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(
      c,
      "gtm.json",
      container({
        tag: [
          { name, firingTriggerId: ["1"] },
          { name, firingTriggerId: ["1"] },
        ],
        trigger: [{ name, triggerId: "1" }],
        variable: [{ name }],
      }),
      "application/json",
    );
    expect(await statValue("Tags")).toBe("2");
    await waitFor(() => expect(findingHeadings()).toContain("Duplicate names (1)"));
  });
});

// Review D8, CHARACTERIZATION ONLY. The fixture below is SYNTHETIC: it is hand-written from memory of the
// GTM export schema (setupTag/teardownTag on tags, a TRIGGER_GROUP trigger listing trigger ids) and has NOT
// been checked against a real export. The assertions pin what the auditor does today, not what it should do.
// A tag that only runs as a setup or teardown tag has no firing trigger by design, and a trigger used only
// inside a Trigger Group is in use, so both findings below are probable false positives. Do not change the
// auditor's behavior until a real container export confirms the schema; then flip these assertions.
describe("GtmAuditor D8 characterization (synthetic fixture, unverified schema)", () => {
  const syntheticExport = () =>
    container({
      tag: [
        { name: "Main Tag", firingTriggerId: ["1"], setupTag: [{ tagName: "Setup Tag" }] },
        { name: "Setup Tag" },
        { name: "Grouped Tag", firingTriggerId: ["9"] },
      ],
      trigger: [
        { name: "All Pages", triggerId: "1" },
        { name: "Click A", triggerId: "7" },
        { name: "Click B", triggerId: "8" },
        {
          name: "Both Clicks",
          triggerId: "9",
          type: "TRIGGER_GROUP",
          parameter: [
            {
              type: "LIST",
              key: "triggerIds",
              list: [
                { type: "TRIGGER_REFERENCE", value: "7" },
                { type: "TRIGGER_REFERENCE", value: "8" },
              ],
            },
          ],
        },
      ],
      variable: [],
    });

  it("currently flags a setup-only tag as having no firing trigger", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "synthetic.json", syntheticExport(), "application/json");
    await waitFor(() => expect(findingHeadings()).toContain("Tags with no firing trigger (1)"));
  });

  it("currently flags triggers that are only members of a Trigger Group as unused", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(c, "synthetic.json", syntheticExport(), "application/json");
    await waitFor(() => expect(findingHeadings()).toContain("Unused triggers (2)"));
  });
});
