import { CAREER_START_YEAR, yearsOfExperience } from "../../src/data/years.js";

describe("yearsOfExperience", () => {
  it("counts calendar years since the career start", () => {
    expect(CAREER_START_YEAR).toBe(2004);
    expect(yearsOfExperience(new Date("2026-10-04"))).toBe(22);
    expect(yearsOfExperience(new Date("2027-01-01T12:00:00Z"))).toBe(23);
  });

  it("defaults to the current year", () => {
    expect(yearsOfExperience()).toBe(new Date().getFullYear() - 2004);
  });
});
