import { render, screen, waitFor } from "@testing-library/react";
import GtmAuditor from "../../src/components/GtmAuditor.jsx";
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

// Known defect (review D2). Plain-object lookups collide with Object.prototype keys, so a tag named
// "constructor" breaks duplicate detection and the audit never renders.
describe("GtmAuditor known defects (D2)", () => {
  it.fails("audits a container that has a tag named 'constructor'", async () => {
    const { container: c } = render(<GtmAuditor />);
    await uploadFile(
      c,
      "gtm.json",
      container({ tag: [{ name: "constructor", firingTriggerId: ["1"] }] }),
      "application/json",
    );
    expect(await statValue("Tags")).toBe("1");
  });
});
