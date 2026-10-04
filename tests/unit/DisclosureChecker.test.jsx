import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DisclosureChecker from "../../src/components/DisclosureChecker.jsx";
import { uploadFile } from "./helpers.js";

/** Returns [result, matched phrases] for every result row. */
function resultRows() {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => {
      const cells = within(tr).getAllByRole("cell");
      return [cells[2].textContent, cells[3].textContent];
    });
}

async function paste(user, text) {
  await user.click(screen.getByPlaceholderText("One piece of copy per line..."));
  await user.paste(text);
}

describe("DisclosureChecker (current behavior)", () => {
  it("passes copy that carries an affiliate disclosure and flags copy that does not", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await paste(user, "Loving this blender #ad\nLoving this blender");
    const rows = resultRows();
    expect(rows[0]).toEqual(["Pass", "#ad"]);
    expect(rows[1]).toEqual(["Missing disclosure", "—"]);
  });

  it("switches rulesets", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await user.selectOptions(screen.getByLabelText("Ruleset"), "financial");
    await paste(user, "Past performance is no guarantee");
    expect(resultRows()[0][1]).toMatch(/past performance/i);
  });

  it("matches the cannabis phrases that do not depend on the age patterns", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await user.selectOptions(screen.getByLabelText("Ruleset"), "cannabis");
    await paste(user, "Keep out of reach of children");
    expect(resultRows()[0][1]).toMatch(/keep out of reach of children/);
  });

  it("checks a CSV with a copy column", async () => {
    const user = userEvent.setup();
    const { container } = render(<DisclosureChecker />);
    await user.click(screen.getByLabelText(/Upload CSV/));
    await uploadFile(container, "copy.csv", "copy\nGreat deal #ad\nGreat deal\n");
    await waitFor(() => expect(resultRows()).toHaveLength(2));
  });

  it("keeps the labeled radio group and select accessible", () => {
    render(<DisclosureChecker />);
    expect(screen.getByRole("radiogroup", { name: "Input mode" })).toBeTruthy();
    expect(screen.getByLabelText("Ruleset")).toBeTruthy();
  });
});

/** [text, expected matched label or null] per ruleset. A null label means "Missing disclosure". */
const RULESET_CASES = {
  affiliate: [
    ["Loving this blender #ad", "#ad"],
    ["#Ad because they sent it", "#ad"],
    ["Great pan #sponsored", "#sponsored"],
    ["This post has an affiliate link inside", '"affiliate link"'],
    ["A paid partnership with Acme", '"paid partnership"'],
    ["Sponsored by Acme Foods", '"sponsored by"'],
    ["Made in partnership with Acme", '"in partnership with"'],
    ["Loving this blender", null],
    ["Reading the ad copy again", null],
    ["#address is not a tag", null],
    ["Check out our newsletter", null],
    ["Sponsor of the year", null],
  ],
  regulatedHealth: [
    ["See full prescribing information", '"full prescribing information"'],
    ["See the full prescribing information.", '"full prescribing information"'],
    ["Important Safety Information follows", '"important safety information"'],
    ["Ask your doctor if this is right for you", '"ask your doctor"'],
    ["Talk to your healthcare provider first", '"talk to your doctor/healthcare provider"'],
    ["Talk to your doctor before use", '"talk to your doctor/healthcare provider"'],
    ["Read the full risk information", '"full risk information"'],
    ["Consult your physician", '"consult your physician/doctor"'],
    ["Consult your doctor", '"consult your physician/doctor"'],
    ["Feel better today", null],
    ["Doctors recommend water", null],
    ["Safety first", null],
  ],
  cannabis: [
    ["Must be 19+ to enter", "19+"],
    ["19+ only", "19+"],
    ["(19+)", "19+"],
    ["Ages 19+, please", "19+"],
    ["You must be 21+ to enter.", "21+"],
    ["21+", "21+"],
    ["Strictly 21+!", "21+"],
    ["Must be of legal age", '"legal age"'],
    ["Keep out of reach of children", '"keep out of reach of children"'],
    ["For use only by adults", '"for use only by adults"'],
    ["Now 119+ flavours", null],
    ["Over 219+ stores", null],
    ["Call 19 times", null],
    ["Fresh new strains", null],
  ],
  financial: [
    ["Past performance is no guarantee", '"past performance"'],
    ["This is not financial advice", '"not financial/investment advice"'],
    ["Not investment advice", '"not financial/investment advice"'],
    ["Results may vary", '"results may vary"'],
    ["There is a risk of loss", '"risk of loss"'],
    ["Your capital at risk", '"capital at risk"'],
    ["Consult a financial advisor", '"consult a financial advisor"'],
    ["Great returns every year", null],
    ["Invest today", null],
    ["Performance review notes", null],
    ["Advice for savers", null],
    ["Risk free trial", null],
  ],
};

describe.each(Object.entries(RULESET_CASES))("DisclosureChecker ruleset %s (D1)", (rulesetKey, cases) => {
  it("matches the expected disclosure label for every phrase", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await user.selectOptions(screen.getByLabelText("Ruleset"), rulesetKey);
    await paste(user, cases.map(([text]) => text).join("\n"));
    const rows = resultRows();
    expect(rows).toHaveLength(cases.length);
    cases.forEach(([, label], i) => {
      expect(rows[i]).toEqual(label ? ["Pass", label] : ["Missing disclosure", "—"]);
    });
  });
});
