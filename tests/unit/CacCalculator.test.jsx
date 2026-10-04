import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CacCalculator from "../../src/components/CacCalculator.jsx";
import { statValue } from "./helpers.js";

describe("CacCalculator (current behavior)", () => {
  it("computes the default scenario", async () => {
    render(<CacCalculator />);
    // spend 50,000 / 200 customers; 80 * 70% margin = 56/month; churn 3% gives a 33.3 month lifespan.
    expect(await statValue("CAC")).toBe("$250.00");
    expect(await statValue("LTV")).toBe("$1866.67");
    expect(await statValue("LTV:CAC")).toBe("7.47:1");
    expect(await statValue("Payback period")).toBe("4.5 months");
  });

  it("recalculates live when an input changes", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    const spend = screen.getByLabelText(/Total sales & marketing spend/);
    await user.clear(spend);
    await user.type(spend, "100000");
    expect(await statValue("CAC")).toBe("$500.00");
  });

  it("shows dashes instead of Infinity or NaN when there are no new customers", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    const customers = screen.getByLabelText("New customers acquired");
    await user.clear(customers);
    await user.type(customers, "0");
    expect(await statValue("CAC")).toBe("—");
    expect(await statValue("LTV:CAC")).toBe("—");
  });

  it("caps lifespan at 60 months when churn is zero", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    const churn = screen.getByLabelText(/churn/i);
    await user.clear(churn);
    await user.type(churn, "0");
    expect(await statValue("LTV")).toBe("$3360.00");
  });
});

// Known defect (review D11). Clearing a number field snaps it to 0 because Number("") is 0.
describe("CacCalculator known defects (D11)", () => {
  it.fails("keeps a cleared field empty instead of snapping it to 0", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    const spend = /** @type {HTMLInputElement} */ (screen.getByLabelText(/Total sales & marketing spend/));
    await user.clear(spend);
    expect(spend.value).toBe("");
  });
});
