import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataTable from "../../src/components/kit/DataTable.jsx";
import ErrorNotice from "../../src/components/kit/ErrorNotice.jsx";
import FileDropzone from "../../src/components/kit/FileDropzone.jsx";
import StatCard from "../../src/components/kit/StatCard.jsx";
import StatRow from "../../src/components/kit/StatRow.jsx";
import ToolShell from "../../src/components/kit/ToolShell.jsx";
import { useFileAnalysis } from "../../src/components/kit/useFileAnalysis.js";

describe("StatRow and StatCard", () => {
  it("StatRow owns the polite, atomic live region", () => {
    render(
      <StatRow tight padded>
        <StatCard label="Rows" value={3} size="wide" />
      </StatRow>,
    );
    const live = screen.getByText("Rows").closest("[aria-live]");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(live.className).toContain("stat-row--tight");
    expect(live.className).toContain("stat-row--padded");
  });

  it("StatCard shows a toned sub-label", () => {
    render(<StatCard label="LTV:CAC" value="3:1" sub="Healthy" tone="good" />);
    expect(screen.getByText("Healthy").className).toContain("stat-card__sub--good");
  });
});

describe("DataTable", () => {
  const columns = [
    { key: "name", header: "Name", render: (r) => r.name },
    { key: "n", header: "#", render: (_r, i) => i + 1, cellClassName: (r) => (r.hot ? "hot" : undefined) },
  ];
  const rows = [
    { id: "a", name: "Alpha", hot: true },
    { id: "b", name: "Beta" },
  ];

  it("renders headers, cells and per-cell classes", () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Name", "#"]);
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.getAllByRole("cell")[1].className).toBe("hot");
  });

  it("wraps in a scroll container on request", () => {
    const { container } = render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} scroll />);
    expect(container.querySelector(".data-table__scroll table")).toBeTruthy();
  });
});

describe("ErrorNotice and ToolShell", () => {
  it("renders an alert only when there is a message", () => {
    const { rerender } = render(<ErrorNotice message="" />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<ErrorNotice message="Broken" />);
    expect(screen.getByRole("alert").textContent).toBe("Broken");
  });

  it("ToolShell can be wide", () => {
    const { container } = render(<ToolShell wide>hi</ToolShell>);
    expect(container.firstElementChild.className).toBe("tool tool--wide");
  });
});

describe("FileDropzone", () => {
  const setup = (props = {}) => {
    const onFile = vi.fn();
    const utils = render(<FileDropzone title="Drop" hint="Hint" accept=".csv" onFile={onFile} {...props} />);
    return { onFile, zone: screen.getByRole("button"), ...utils };
  };

  it("opens the picker with Enter and Space and not with other keys", async () => {
    const { zone, container } = setup();
    const click = vi.spyOn(container.querySelector("input"), "click");
    zone.focus();
    await userEvent.keyboard("a");
    expect(click).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    const afterEnter = click.mock.calls.length;
    expect(afterEnter).toBeGreaterThan(0);
    await userEvent.keyboard(" ");
    expect(click.mock.calls.length).toBeGreaterThan(afterEnter);
  });

  it("passes a dropped file through and ignores an empty drop", () => {
    const { zone, onFile } = setup({ flush: true });
    expect(zone.className).toContain("dropzone--flush");
    const file = new File(["x"], "x.csv");
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    fireEvent.drop(zone, { dataTransfer: { files: [] } });
    fireEvent.dragOver(zone);
    expect(onFile).toHaveBeenCalledTimes(1);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("passes a chosen file through", async () => {
    const { onFile, container } = setup();
    const file = new File(["x"], "y.csv", { type: "text/csv" });
    await userEvent.setup({ applyAccept: false }).upload(container.querySelector("input"), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });
});

describe("useFileAnalysis", () => {
  function Probe({ analyze }) {
    const { fileName, result, error, analyzeFile } = useFileAnalysis(analyze);
    return (
      <div>
        <button onClick={() => analyzeFile(new File(["x"], "f.csv"))}>run</button>
        <output>{`${fileName}|${JSON.stringify(result)}|${error}`}</output>
      </div>
    );
  }
  const output = () => screen.getByRole("status").textContent;

  it("keeps the result and shows a warning next to it", async () => {
    render(<Probe analyze={async () => ({ result: { ok: 1 }, warning: "careful" })} />);
    await userEvent.click(screen.getByText("run"));
    await waitFor(() => expect(output()).toBe('f.csv|{"ok":1}|careful'));
  });

  it("clears the result and shows the error message when analysis throws", async () => {
    render(
      <Probe
        analyze={async () => {
          throw new Error("bad file");
        }}
      />,
    );
    await userEvent.click(screen.getByText("run"));
    await waitFor(() => expect(output()).toBe("f.csv|null|bad file"));
  });

  it("falls back to a generic message for a non-Error throw", async () => {
    render(
      <Probe
        analyze={async () => {
          throw "nope";
        }}
      />,
    );
    await userEvent.click(screen.getByText("run"));
    await waitFor(() => expect(output()).toMatch(/Could not read this file/));
  });
});
