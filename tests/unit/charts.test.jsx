import { act, render } from "@testing-library/react";
import BarChart from "../../src/components/BarChart.jsx";
import GroupedBarChart from "../../src/components/GroupedBarChart.jsx";
import PaybackChart from "../../src/components/PaybackChart.jsx";

/** @type {Array<(entries: any[]) => void>} */
let observerCallbacks = [];

beforeEach(() => {
  observerCallbacks = [];
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb) {
        observerCallbacks.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const resizeTo = (width) => act(() => observerCallbacks.forEach((cb) => cb([{ contentRect: { width } }])));
const svgOf = (container) => /** @type {SVGSVGElement} */ (container.querySelector("svg"));

describe("charts redraw on resize (D10)", () => {
  it("BarChart follows the container width", () => {
    const { container } = render(<BarChart data={[{ label: "A", value: 3 }]} />);
    expect(svgOf(container).getAttribute("width")).toBe("600"); // jsdom reports 0, so the fallback applies
    resizeTo(420);
    expect(svgOf(container).getAttribute("width")).toBe("420");
    resizeTo(900);
    expect(svgOf(container).getAttribute("width")).toBe("900");
  });

  it("GroupedBarChart follows the container width", () => {
    const data = [{ group: "email", series: [{ key: "Linear", value: 2 }] }];
    const { container } = render(<GroupedBarChart data={data} seriesKeys={["Linear"]} />);
    resizeTo(500);
    expect(svgOf(container).getAttribute("width")).toBe("500");
  });

  it("PaybackChart follows the container width", () => {
    const { container } = render(
      <PaybackChart monthlyGrossProfit={100} cac={500} paybackMonths={5} horizonMonths={12} />,
    );
    resizeTo(360);
    expect(svgOf(container).getAttribute("width")).toBe("360");
  });

  it("disconnects nothing and still renders when ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const { container } = render(<BarChart data={[{ label: "A", value: 3 }]} />);
    expect(svgOf(container).getAttribute("width")).toBe("600");
  });
});

describe("BarChart label margin is measured, not fixed (D10)", () => {
  const leftOffset = (container) => {
    const g = container.querySelector("svg > g");
    return Number(/translate\(([\d.]+),/.exec(g.getAttribute("transform"))[1]);
  };

  afterEach(() => {
    // @ts-expect-error test-only SVG method
    delete window.SVGElement.prototype.getComputedTextLength;
  });

  it("sizes the left margin to the widest label", () => {
    // @ts-expect-error jsdom has no SVG text measurement; 10px per character makes the maths exact
    window.SVGElement.prototype.getComputedTextLength = function () {
      return (this.textContent || "").length * 10;
    };
    const short = render(<BarChart data={[{ label: "Short", value: 1 }]} />);
    const shortLeft = leftOffset(short.container);
    short.unmount();
    const long = render(<BarChart data={[{ label: "A much longer category label", value: 1 }]} />);
    const longLeft = leftOffset(long.container);
    expect(shortLeft).toBe(80); // 5 chars * 10 + 16 gap is 66, raised to the 80px minimum
    expect(longLeft).toBe(296); // 28 chars * 10 + 16 gap, under the 300px cap (half of the 600px fallback width)
  });

  it("caps the margin at half the chart width", () => {
    // @ts-expect-error see above
    window.SVGElement.prototype.getComputedTextLength = () => 1000;
    const { container } = render(<BarChart data={[{ label: "Enormous", value: 1 }]} />);
    expect(leftOffset(container)).toBe(300);
  });
});
