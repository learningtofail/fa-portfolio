import { auditContainer, collectTemplateRefs, findDuplicates, isGenericName } from "../../../src/lib/gtm/audit.js";

const byKey = (audit, key) => audit.findings.find((f) => f.key === key);

describe("isGenericName", () => {
  it.each([
    [undefined, true],
    ["", true],
    ["Tag 1", true],
    ["trigger", true],
    ["Variable 12", true],
    ["Untitled", true],
    ["New Tag", true],
    ["GA4 Config", false],
    ["Tagline click", false],
  ])("%j is generic: %s", (name, expected) => expect(isGenericName(name)).toBe(expected));
});

describe("collectTemplateRefs", () => {
  it("finds references in nested objects, arrays and strings, and trims names", () => {
    const refs = new Set();
    collectTemplateRefs({ a: ["{{ One }} and {{Two}}", { b: "x {{Three}}" }], c: 5, d: null }, refs);
    expect([...refs].sort()).toEqual(["One", "Three", "Two"]);
  });
});

describe("findDuplicates", () => {
  it("groups by name and labels missing names", () => {
    const dups = findDuplicates([{ name: "a" }, { name: "a" }, {}, {}, { name: "b" }]);
    expect(dups.map(([name, items]) => [name, items.length])).toEqual([
      ["a", 2],
      ["(unnamed)", 2],
    ]);
  });
});

describe("auditContainer", () => {
  const sample = {
    containerVersion: {
      tag: [
        { name: "GA4 Config", firingTriggerId: ["1"], parameter: [{ value: "{{Used Var}}" }] },
        { name: "Old Pixel", paused: true, firingTriggerId: ["1"], blockingTriggerId: ["3"] },
        { name: "Orphan", firingTriggerId: [] },
        { name: "Orphan No Field" },
        { name: "Tag 1", firingTriggerId: ["1"] },
        { name: "Dup", firingTriggerId: ["1"] },
        { name: "Dup", firingTriggerId: ["1"] },
      ],
      trigger: [
        { name: "All Pages", triggerId: "1" },
        { name: "Never Used", triggerId: "2" },
        { name: "Blocker", triggerId: "3" },
      ],
      variable: [{ name: "Used Var" }, { name: "Dead Var" }],
    },
  };

  it("counts and reports every finding category", () => {
    const audit = auditContainer(sample);
    expect(audit.counts).toEqual({ tags: 7, triggers: 3, variables: 2 });
    expect(byKey(audit, "paused_tags").items).toEqual(["Old Pixel"]);
    expect(byKey(audit, "orphan_tags").items).toEqual(["Orphan", "Orphan No Field"]);
    expect(byKey(audit, "unused_variables").items).toEqual(["Dead Var"]);
    expect(byKey(audit, "unused_triggers").items).toEqual(["Never Used"]);
    expect(byKey(audit, "duplicate_names").items).toEqual(['Tag "Dup" (2x)']);
    expect(byKey(audit, "generic_names").items).toEqual(['Tag "Tag 1"']);
  });

  it("counts a blocking trigger as used", () => {
    expect(byKey(auditContainer(sample), "unused_triggers").items).not.toContain("Blocker");
  });

  it("gives every finding entry a unique id", () => {
    const ids = auditContainer(sample).findings.flatMap((f) => f.entries.map((e) => e.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("treats missing sections as empty", () => {
    const audit = auditContainer({ containerVersion: {} });
    expect(audit.counts).toEqual({ tags: 0, triggers: 0, variables: 0 });
    expect(audit.findings.every((f) => f.items.length === 0)).toBe(true);
  });

  it("rejects JSON that is not a container export", () => {
    expect(() => auditContainer({ hello: "world" })).toThrow(/No "containerVersion" found/);
    expect(() => auditContainer(null)).toThrow(/No "containerVersion" found/);
  });

  it.each(["constructor", "__proto__", "toString"])("handles items named %s (D2)", (name) => {
    const audit = auditContainer({
      containerVersion: {
        tag: [
          { name, firingTriggerId: ["1"] },
          { name, firingTriggerId: ["1"] },
        ],
      },
    });
    expect(byKey(audit, "duplicate_names").items).toEqual([`Tag "${name}" (2x)`]);
  });
});
