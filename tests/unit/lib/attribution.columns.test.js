import { detectColumns, FIELDS, missingRequired, squashHeader } from "../../../src/lib/attribution/columns.js";

describe("detectColumns", () => {
  it("matches headers by name regardless of case, spaces and punctuation", () => {
    expect(detectColumns(["journey id", "channel", "timestamp", "revenue"])).toMatchObject({
      journey: "journey id",
      channel: "channel",
    });
    expect(detectColumns(["Journey-ID", "Source/Medium"])).toMatchObject({
      journey: "Journey-ID",
      channel: "Source/Medium",
    });
    expect(detectColumns(["﻿journey_id"]).journey).toBe("﻿journey_id");
  });

  it.each([
    ["user_id", "journey"],
    ["client_id", "journey"],
    ["session_id", "journey"],
    ["source", "channel"],
    ["touchpoint", "channel"],
    ["event_time", "timestamp"],
    ["date", "timestamp"],
    ["value", "revenue"],
    ["amount", "revenue"],
    ["converted", "converted"],
    ["touch_type", "touchType"],
    ["interaction type", "touchType"],
  ])("maps %s to %s", (header, field) => {
    expect(detectColumns(["x", header])[field]).toBe(header);
  });

  it("prefers the first alias and never reuses a header", () => {
    const m = detectColumns(["source", "channel", "user_id", "journey_id", "date", "timestamp"]);
    expect(m).toMatchObject({ journey: "journey_id", channel: "channel", timestamp: "timestamp" });
    expect(Object.values(m).filter(Boolean)).toEqual(expect.not.arrayContaining(["source", "user_id", "date"]));
  });

  it("leaves unknown fields empty", () => {
    expect(detectColumns(["foo", "bar"])).toEqual({
      journey: "",
      channel: "",
      timestamp: "",
      revenue: "",
      converted: "",
      touchType: "",
    });
  });
});

describe("missingRequired and squashHeader", () => {
  it("lists the required fields without a column", () => {
    expect(missingRequired(detectColumns(["foo"]))).toEqual(["Journey ID", "Channel"]);
    expect(missingRequired(detectColumns(["journey_id", "channel"]))).toEqual([]);
    expect(FIELDS.filter((f) => f.required)).toHaveLength(2);
  });

  it("squashes headers", () => expect(squashHeader("﻿ Journey ID ")).toBe("journeyid"));
});
