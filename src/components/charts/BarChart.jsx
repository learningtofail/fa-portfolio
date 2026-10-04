import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useChartWidth } from "./useChartWidth.js";

const LABEL_GAP = 16; // space between the widest label and the bars
const MIN_LABEL_MARGIN = 80;
const MAX_LABEL_SHARE = 0.5; // labels never take more than half the chart width
const ESTIMATED_CHAR_WIDTH = 7; // used only where text cannot be measured (jsdom)

/** Widest rendered label in px, measured with a hidden probe text node so the left margin fits the data (D10). */
function measureWidestLabel(svg, labels) {
  const probe = svg.append("text").attr("class", "chart__label").attr("visibility", "hidden");
  let widest = 0;
  labels.forEach((label) => {
    probe.text(label);
    const node = /** @type {SVGTextContentElement} */ (probe.node());
    widest = Math.max(widest, node.getComputedTextLength?.() || label.length * ESTIMATED_CHAR_WIDTH);
  });
  probe.remove();
  return widest;
}

/**
 * Minimal horizontal bar chart. data: [{ label, value }]
 * Fill and type styles come from CSS classes (chart.css), which read the site tokens.
 */
export default function BarChart({ data }) {
  const svgRef = useRef(null);
  const [containerRef, width] = useChartWidth(600);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const barHeight = 32;
    const height = data.length * barHeight + 20;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const labelMargin = measureWidestLabel(
      svg,
      data.map((d) => d.label),
    );
    const left = Math.min(Math.max(labelMargin + LABEL_GAP, MIN_LABEL_MARGIN), width * MAX_LABEL_SHARE);
    const margin = { top: 10, right: 40, bottom: 10, left };

    const maxVal = d3.max(data, (d) => d.value) || 1;
    const x = d3
      .scaleLinear()
      .domain([0, maxVal])
      .range([0, width - margin.left - margin.right]);
    const y = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, height - margin.top - margin.bottom])
      .padding(0.25);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("y", (d) => y(d.label))
      .attr("x", 0)
      .attr("width", (d) => x(d.value))
      .attr("height", y.bandwidth())
      .attr("class", (d) => (d.value > 0 ? "chart__bar" : "chart__bar chart__bar--zero"))
      .attr("rx", 3);

    g.selectAll(".chart__label")
      .data(data)
      .join("text")
      .attr("class", "chart__label")
      .attr("x", -10)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text((d) => d.label);

    g.selectAll(".chart__value")
      .data(data)
      .join("text")
      .attr("class", "chart__value")
      .attr("x", (d) => x(d.value) + 6)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => d.value);
  }, [data, width, containerRef]);

  return (
    // Decorative — every value here is also in the accessible table/list below it.
    <div ref={containerRef} className="chart" aria-hidden="true">
      <svg ref={svgRef}></svg>
    </div>
  );
}
