import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CacCalculator, {
  CAPPED_LIFESPAN_MONTHS,
  calculateCac,
  ltvCacHealth,
} from "../../src/components/CacCalculator.jsx";
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

// Review D11.
describe("CacCalculator number inputs and constants (D11)", () => {
  const field = (name) => /** @type {HTMLInputElement} */ (screen.getByLabelText(name));

  it("keeps a cleared field empty instead of snapping it to 0, and shows dashes", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    const spend = field(/Total sales & marketing spend/);
    await user.clear(spend);
    expect(spend.value).toBe("");
    expect(await statValue("CAC")).toBe("—");
    expect(await statValue("LTV:CAC")).toBe("—");
    await user.type(spend, "100000");
    expect(await statValue("CAC")).toBe("$500.00");
  });

  it("shows dashes for LTV, not a capped value, while the churn field is empty", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    await user.clear(field(/churn/i));
    expect(await statValue("LTV")).toBe("—");
    expect(await statValue("CAC")).toBe("$250.00");
  });

  it("uses one CAPPED_LIFESPAN_MONTHS value in the calculation, the label and the warning", async () => {
    const user = userEvent.setup();
    render(<CacCalculator />);
    expect(field(/churn/i).labels[0].textContent).toContain(`${CAPPED_LIFESPAN_MONTHS}-month cap`);
    await user.clear(field(/churn/i));
    await user.type(field(/churn/i), "0");
    expect(screen.getByText(new RegExp(`capped at ${CAPPED_LIFESPAN_MONTHS} months`))).toBeTruthy();
    expect(calculateCac({ ...DEFAULTS, churnPct: 0 }).lifespanMonths).toBe(CAPPED_LIFESPAN_MONTHS);
  });
});

const DEFAULTS = { spend: 50000, newCustomers: 200, avgRevenue: 80, grossMarginPct: 70, churnPct: 3 };

describe("ltvCacHealth returns a tone, never a color (D11)", () => {
  it.each([
    [NaN, null],
    [0, null],
    [0.5, "bad"],
    [2, "warn"],
    [4, "good"],
    [5, "good"],
    [7, "warn"],
  ])("ratio %s has tone %s", (ratio, tone) => {
    const health = ltvCacHealth(ratio);
    expect(health.tone).toBe(tone);
    expect(JSON.stringify(health)).not.toMatch(/#[0-9a-f]{3,6}/i);
  });
});
