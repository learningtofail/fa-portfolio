import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AttributionTool from "../../src/components/tools/AttributionTool.jsx";
import { statValue, uploadFile } from "./helpers.js";

/** Reads one of the result tables (0 credit, 1 share, 2 rank) into { channel: { column: value } }. */
function table(index = 0) {
  const el = screen.getAllByRole("table")[index];
  const headers = within(el)
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  const out = {};
  within(el)
    .getAllByRole("row")
    .slice(1)
    .forEach((tr) => {
      const cells = within(tr)
        .getAllByRole("cell")
        .map((c) => c.textContent);
      out[cells[0]] = Object.fromEntries(headers.slice(1).map((h, i) => [h, cells[i + 1]]));
    });
  return out;
}

const ready = () => waitFor(() => expect(screen.getAllByRole("table").length).toBeGreaterThan(0));
const notes = () => screen.getByRole("region", { name: "Data quality" }).textContent;

// Two journeys, no revenue column, so every journey is one conversion.
// j1: email (Jan 1) then paid (Jan 8). j2: paid only.
const CSV = "journey_id,channel,timestamp\nj1,email,2026-01-01\nj1,paid,2026-01-08\nj2,paid,2026-01-02\n";
const REPEAT = "journey_id,channel,timestamp,revenue\nj1,email,2026-01-01,100\nj1,paid,2026-01-02,100\n";

async function open(text, name = "touches.csv") {
  const view = render(<AttributionTool />);
  await uploadFile(view.container, name, text);
  await ready();
  return view;
}

describe("AttributionTool results", () => {
  it("counts journeys, touchpoints and channels", async () => {
    await open(CSV);
    expect(await statValue("Journeys")).toBe("2");
    expect(await statValue("Converting journeys")).toBe("2");
    expect(await statValue("Touchpoints scored")).toBe("3");
    expect(await statValue("Channels")).toBe("2");
  });

  it("splits credit across the five models, with a total row", async () => {
    await open(CSV);
    const m = table();
    expect(m.email["Last-touch"]).toBe("0");
    expect(m.paid["Last-touch"]).toBe("2");
    expect(m.email["First-touch"]).toBe("1");
    expect(m.email.Linear).toBe("0.5");
    expect(m.paid.Linear).toBe("1.5");
    expect(m.email["Time-decay"]).toBe("0.33");
    expect(m.Total["Last-touch"]).toBe("2");
    expect(m.Total.Linear).toBe("2");
  });

  it("shows shares and a rank-by-model table", async () => {
    await open(CSV);
    expect(table(1).paid["Last-touch"]).toBe("100.0%");
    expect(table(1).Total.Linear).toBe("100.0%");
    expect(table(2).paid["Last-touch"]).toBe("1");
    expect(table(2).email.Spread).toBe("1");
  });

  it("states the conversion rule, UTC, position weights and half-life", async () => {
    await open(CSV);
    expect(notes()).toMatch(/every journey is counted as one conversion/);
    expect(notes()).toMatch(/UTC/);
    expect(screen.getByText(/40\/20\/40/).textContent).toMatch(/every 7 days/);
    expect(screen.getByText(/Credit is measured in conversions/)).toBeTruthy();
  });

  it.each(["constructor", "__proto__", "toString"])("handles a channel and a journey named %s (D2)", async (name) => {
    await open(`journey_id,channel,timestamp\n${name},${name},2026-01-01\n${name},email,2026-01-03\n`);
    expect(await statValue("Journeys")).toBe("1");
    expect(table()[name]["First-touch"]).toBe("1");
    expect(table().email["Last-touch"]).toBe("1");
  });
});

describe("AttributionTool columns", () => {
  it("lists the headers it saw and lets the user map the columns", async () => {
    const user = userEvent.setup();
    await (async () => {
      const { container } = render(<AttributionTool />);
      await uploadFile(container, "odd.csv", "who,where,when\nj1,email,2026-01-01\nj1,paid,2026-01-02\n");
    })();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Headers seen: who, where, when/);
    await user.selectOptions(screen.getByLabelText(/Journey ID column/), "who");
    await user.selectOptions(screen.getByLabelText(/Channel column/), "where");
    await user.selectOptions(screen.getByLabelText(/Timestamp column/), "when");
    await ready();
    expect(await statValue("Journeys")).toBe("1");
  });

  it("maps 'Journey ID' automatically", async () => {
    await open("Journey ID,Channel\nj1,email\n");
    expect(/** @type {HTMLSelectElement} */ (screen.getByLabelText(/Journey ID column/)).value).toBe("journey id");
  });
});

describe("AttributionTool revenue", () => {
  it("values a repeated revenue once by default and says so", async () => {
    await open(REPEAT);
    expect(table().paid["Last-touch"]).toBe("100.00");
    expect(notes()).toMatch(/carries revenue on several rows/);
    expect(screen.getByText(/the default, so a value copied onto every row is counted once/)).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Totals warning" })).toBeNull();
  });

  it("sums on request and marks the totals unreliable", async () => {
    const user = userEvent.setup();
    await open(REPEAT);
    await user.selectOptions(screen.getByLabelText("Revenue per journey"), "sum");
    expect(table().paid["Last-touch"]).toBe("200.00");
    expect(screen.getByRole("status", { name: "Totals warning" }).textContent).toMatch(/Totals are unreliable/);
  });

  it("counts only journeys with revenue by default, and counts all of them when unchecked", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,timestamp,revenue\nj1,email,2026-01-01,100\nj2,paid,2026-01-02,\n");
    expect(table().paid).toBeUndefined();
    expect(await statValue("Converting journeys")).toBe("1");
    expect(notes()).toMatch(/1 journey did not convert/);
    await user.click(screen.getByLabelText("Only journeys with revenue count as conversions"));
    expect(table().paid["Last-touch"]).toBe("1.00");
    expect(screen.getByRole("status", { name: "Totals warning" })).toBeTruthy();
  });

  it("reads currency formats, lists unreadable cells and labels the unit", async () => {
    await open('journey_id,channel,revenue\nj1,a,"$1,200.50"\nj2,a,TBD\nj3,b,40\n');
    expect(table().a["Last-touch"]).toBe("1,200.50");
    expect(notes()).toMatch(/1 revenue cell could not be read.*row 3 "TBD"/);
    expect(/** @type {HTMLInputElement} */ (screen.getByLabelText(/Currency symbol or code/)).value).toBe("$");
    expect(screen.getByText(/Credit is measured in revenue \(\$\)/)).toBeTruthy();
  });

  it("says no currency is set when there is none, and lets the user type one", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,revenue\nj1,a,10\n");
    expect(screen.getByText(/Credit is measured in revenue \(currency not set\)/)).toBeTruthy();
    await user.type(screen.getByLabelText(/Currency symbol or code/), "CAD");
    expect(screen.getByText(/Credit is measured in revenue \(CAD\)/)).toBeTruthy();
  });
});

describe("AttributionTool options", () => {
  it("applies the lookback window and the half-life", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,timestamp,revenue\nj,old,2026-01-01,\nj,new,2026-03-01,100\n");
    expect(table().old["First-touch"]).toBe("100.00");
    await user.type(screen.getByLabelText(/Lookback window/), "30");
    expect(table().old).toBeUndefined();
    expect(notes()).toMatch(/Lookback 30 days/);
    await user.type(screen.getByLabelText(/Time-decay half-life/), "{Backspace}30");
    expect(screen.getByText(/every 30 days/)).toBeTruthy();
  });

  it("removes duplicates by default and keeps them when unchecked", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,timestamp\nj,a,2026-01-01\nj,a,2026-01-01\nj,b,2026-01-02\n");
    expect(await statValue("Touchpoints scored")).toBe("2");
    await user.click(screen.getByLabelText("Remove exact duplicate rows"));
    expect(await statValue("Touchpoints scored")).toBe("3");
  });

  it("merges channel names unless unchecked, and lists the merge", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel\nj1,Email\nj2,email\n");
    expect(Object.keys(table())).toEqual(["Email", "Total"]);
    expect(notes()).toMatch(/Channel names merged/);
    await user.click(screen.getByLabelText(/Merge channel names/));
    expect(Object.keys(table())).toEqual(["Email", "email", "Total"]);
  });

  it("shows the view-through checkbox only with a touch type column, and excludes views when off", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,timestamp,touch_type\nj,Display,2026-01-01,view\nj,Search,2026-01-02,click\n");
    const box = /** @type {HTMLInputElement} */ (screen.getByLabelText(/Keep view-through touches/));
    expect(box.checked).toBe(true);
    await user.click(box);
    expect(table().Display).toBeUndefined();
    expect(notes()).toMatch(/1 view-through touch excluded/);
    expect(await statValue("Touchpoints scored")).toBe("1");
  });

  it("does not show the view-through checkbox without that column", async () => {
    await open(CSV);
    expect(screen.queryByLabelText(/Keep view-through touches/)).toBeNull();
  });

  it("changes date order", async () => {
    const user = userEvent.setup();
    await open("journey_id,channel,timestamp,revenue\nj,a,03/04/2026,\nj,b,05/04/2026,100\n");
    expect(notes()).toMatch(/could be read either way/);
    await user.selectOptions(screen.getByLabelText("Date order"), "dmy");
    expect(table().b["Last-touch"]).toBe("100.00");
  });

  it("says nothing converts when no journey qualifies", async () => {
    const { container } = render(<AttributionTool />);
    await uploadFile(container, "none.csv", "journey_id,channel,revenue\nj,a,\n");
    expect(await screen.findByText(/No journeys count as conversions/)).toBeTruthy();
  });
});

describe("AttributionTool export", () => {
  it("downloads the matrix and shares as CSV", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const created = [];
    URL.createObjectURL = (blob) => (created.push(blob), "blob:test");
    URL.revokeObjectURL = () => {};
    await open(CSV);
    await user.click(screen.getByRole("button", { name: /Download credit and shares as CSV/ }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(await created[0].text()).toMatch(/^Channel,Last-touch \(conversions\)/);
    click.mockRestore();
  });
});
