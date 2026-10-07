import { tools } from "../../src/data/tools.js";
import { contact, experience, skills, summary } from "../../src/data/resume.js";

describe("tools catalog", () => {
  it("holds the two remaining locked slugs in order", () => {
    expect(tools.map((t) => t.slug)).toEqual(["attribution", "disclosure-check"]);
  });

  it("marks every tool live with a name and description", () => {
    for (const tool of tools) {
      expect(tool.live).toBe(true);
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
    }
  });
});

describe("resume data", () => {
  it("has the sections the page and the PDF both render", () => {
    expect(summary.headline).toBeTruthy();
    expect(summary.body.length).toBeGreaterThan(0);
    expect(experience.length).toBeGreaterThan(0);
    expect(skills.length).toBeGreaterThan(0);
    expect(contact.email).toMatch(/@/);
  });

  it("never names the separate consultancy brand", () => {
    expect(JSON.stringify({ summary, experience, skills, contact })).not.toMatch(/gibran/i);
  });
});
