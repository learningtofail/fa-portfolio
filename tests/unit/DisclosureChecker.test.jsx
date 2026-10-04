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

// Known defect (review D1). `\b` after `+` needs a word character next, so ordinary age text never matches.
describe("DisclosureChecker known defects (D1)", () => {
  it.fails("recognizes '19+' in ordinary text under the cannabis ruleset", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await user.selectOptions(screen.getByLabelText("Ruleset"), "cannabis");
    await paste(user, "Must be 19+ to enter");
    expect(resultRows()[0][1]).toMatch(/19\+/);
  });

  it.fails("recognizes '21+' at the end of a sentence", async () => {
    const user = userEvent.setup();
    render(<DisclosureChecker />);
    await user.selectOptions(screen.getByLabelText("Ruleset"), "cannabis");
    await paste(user, "You must be 21+ to enter.");
    expect(resultRows()[0][1]).toMatch(/21\+/);
  });
});
