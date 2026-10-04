import { render, screen, waitFor, within } from "@testing-library/react";
import AttributionTool from "../../src/components/AttributionTool.jsx";
import { statValue, uploadFile } from "./helpers.js";

/** Reads the "Full matrix" table into { channel: { model: value } }. */
function matrix() {
  const table = screen.getByRole("table");
  const headers = within(table)
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  const out = {};
  within(table)
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

// Two journeys, no revenue column, so every journey is worth 1.
// j1: email (Jan 1) then paid (Jan 8). j2: paid only.
const CSV = "journey_id,channel,timestamp\nj1,email,2026-01-01\nj1,paid,2026-01-08\nj2,paid,2026-01-02\n";

describe("AttributionTool (current behavior)", () => {
  it("counts journeys, touchpoints and channels", async () => {
    const { container } = render(<AttributionTool />);
    await uploadFile(container, "touches.csv", CSV);
    expect(await statValue("Journeys")).toBe("2");
    expect(await statValue("Touchpoints")).toBe("3");
    expect(await statValue("Channels")).toBe("2");
  });

  it("splits credit across the five models", async () => {
    const { container } = render(<AttributionTool />);
    await uploadFile(container, "touches.csv", CSV);
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    const m = matrix();
    expect(m.email["Last-touch"]).toMatch(/^0(\.00?)?$/);
    expect(m.paid["Last-touch"]).toMatch(/^2(\.00?)?$/);
    expect(m.email["First-touch"]).toMatch(/^1(\.00?)?$/);
    expect(m.email.Linear).toMatch(/^0\.5/);
    expect(m.paid.Linear).toMatch(/^1\.5/);
    expect(m.email["Position-based"]).toMatch(/^0\.5/);
    // 7 day gap with a 7 day half-life: email carries 1/3 of j1's credit.
    expect(m.email["Time-decay"]).toMatch(/^0\.33/);
  });

  it("explains a missing journey_id column", async () => {
    const { container } = render(<AttributionTool />);
    await uploadFile(container, "bad.csv", "channel,timestamp\nemail,2026-01-01\n");
    expect((await screen.findByRole("alert")).textContent).toMatch(/journey_id/);
  });

  it.each(["constructor", "__proto__", "toString"])("handles a channel and a journey named %s (D2)", async (name) => {
    const { container } = render(<AttributionTool />);
    await uploadFile(
      container,
      "proto.csv",
      `journey_id,channel,timestamp\n${name},${name},2026-01-01\n${name},email,2026-01-03\n`,
    );
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(await statValue("Journeys")).toBe("1");
    expect(matrix()[name]["First-touch"]).toMatch(/^1(\.00?)?$/);
    expect(matrix().email["Last-touch"]).toMatch(/^1(\.00?)?$/);
  });
});
