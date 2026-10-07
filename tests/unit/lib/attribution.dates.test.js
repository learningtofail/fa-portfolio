import { detectDateOrder, parseTimestamp } from "../../../src/lib/attribution/dates.js";

const utc = (iso) => Date.parse(iso);

describe("parseTimestamp", () => {
  it("reads date-only and datetime values as UTC, whatever the machine's zone", () => {
    expect(parseTimestamp("2026-05-01")).toBe(utc("2026-05-01T00:00:00Z"));
    expect(parseTimestamp("2026-05-01 01:00:00")).toBe(utc("2026-05-01T01:00:00Z"));
    expect(parseTimestamp("2026-05-01T01:00")).toBe(utc("2026-05-01T01:00:00Z"));
    expect(parseTimestamp("2026-05-01T01:00:00.250Z")).toBe(utc("2026-05-01T01:00:00Z"));
    expect(parseTimestamp("2026/05/01")).toBe(utc("2026-05-01T00:00:00Z"));
  });

  it("keeps an explicit offset", () => {
    expect(parseTimestamp("2026-05-01T10:00:00+02:00")).toBe(utc("2026-05-01T08:00:00Z"));
    expect(parseTimestamp("2026-05-01 10:00-0530")).toBe(utc("2026-05-01T15:30:00Z"));
    expect(parseTimestamp("2026-05-01 10:00+02")).toBe(utc("2026-05-01T08:00:00Z"));
  });

  it("reads numeric dates by the given order", () => {
    expect(parseTimestamp("03/04/2026", "mdy")).toBe(utc("2026-03-04T00:00:00Z"));
    expect(parseTimestamp("03/04/2026", "dmy")).toBe(utc("2026-04-03T00:00:00Z"));
    expect(parseTimestamp("13.03.2026 14:30", "dmy")).toBe(utc("2026-03-13T14:30:00Z"));
    expect(parseTimestamp("3-4-26")).toBe(utc("2026-03-04T00:00:00Z"));
    expect(parseTimestamp("13/03/2026", "mdy")).toBeNull();
  });

  it("reads month names in English and French", () => {
    expect(parseTimestamp("04-Feb-2026")).toBe(utc("2026-02-04T00:00:00Z"));
    expect(parseTimestamp("4 February 2026")).toBe(utc("2026-02-04T00:00:00Z"));
    expect(parseTimestamp("Feb 4, 2026")).toBe(utc("2026-02-04T00:00:00Z"));
    expect(parseTimestamp("March 3rd 2026 9:15 PM")).toBe(utc("2026-03-03T21:15:00Z"));
    expect(parseTimestamp("Mar 3 2026 12:05 AM")).toBe(utc("2026-03-03T00:05:00Z"));
    expect(parseTimestamp("14 février 2026")).toBe(utc("2026-02-14T00:00:00Z"));
    expect(parseTimestamp("3 août 2026")).toBe(utc("2026-08-03T00:00:00Z"));
    expect(parseTimestamp("5 juil. 2026 18h30")).toBe(utc("2026-07-05T18:30:00Z"));
    expect(parseTimestamp("7 déc 2026")).toBe(utc("2026-12-07T00:00:00Z"));
    expect(parseTimestamp("1 janv 2026")).toBe(utc("2026-01-01T00:00:00Z"));
  });

  it("reads epoch seconds and milliseconds", () => {
    expect(parseTimestamp("1777593600")).toBe(1777593600000);
    expect(parseTimestamp("1777593600000")).toBe(1777593600000);
  });

  it.each([
    "",
    "   ",
    "not a date",
    "2026-13-01",
    "2026-02-30",
    "2026-05-01 25:00",
    "2026-05-01 10:61",
    "4 Smarch 2026",
    "Smarch 4 2026",
    "Mar 3 2026 13:00 PM",
    "31/04/2026",
  ])("returns null for %j", (raw) => expect(parseTimestamp(raw, "dmy")).toBeNull());

  it("returns null for undefined", () => expect(parseTimestamp(undefined)).toBeNull());
});

describe("detectDateOrder", () => {
  it("is day first when a first part is above 12", () => {
    expect(detectDateOrder(["13/03/2026", "01/02/2026"])).toEqual({
      order: "dmy",
      evidence: "day-first",
      ambiguousCount: 0,
    });
  });

  it("is month first when a second part is above 12", () => {
    expect(detectDateOrder(["03/13/2026", "01/02/2026"])).toEqual({
      order: "mdy",
      evidence: "month-first",
      ambiguousCount: 0,
    });
  });

  it("defaults to month first and counts ambiguous dates when nothing settles it", () => {
    expect(detectDateOrder(["03/04/2026", "05/06/2026", "07/07/2026"])).toEqual({
      order: "mdy",
      evidence: "ambiguous",
      ambiguousCount: 2,
    });
  });

  it("flags a file that mixes both orders", () => {
    expect(detectDateOrder(["13/03/2026", "03/13/2026", "01/02/2026"])).toMatchObject({
      order: "mdy",
      evidence: "conflict",
      ambiguousCount: 1,
    });
  });

  it("has no evidence for ISO dates, names or blanks", () => {
    expect(detectDateOrder(["2026-05-01", "04-Feb-2026", "", "13/13/2026"])).toEqual({
      order: "mdy",
      evidence: "none",
      ambiguousCount: 0,
    });
  });
});
