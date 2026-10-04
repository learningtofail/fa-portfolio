import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useChartWidth } from "./useChartWidth.js";

// Brand-neutral placeholder palette — swap for the site's palette in Phase 7.
const PALETTE = ["#3a5a9b", "#5c9e6f", "#c9822a", "#a25c9b", "#4aa3a3"];

/**
 * Grouped bar chart. data: [{ group: string, series: [{ key, value }] }]
 * seriesKeys: ordered list of series keys, used for consistent color + legend.
 */
export default function GroupedBarChart({ data, seriesKeys }) {
  const svgRef = useRef(null);
  const legendRef = useRef(null);
  const [containerRef, width] = useChartWidth(700);

  useEffect(() => {
    if (!data || data.length === 0 || !seriesKeys || seriesKeys.length === 0) return;

    const height = 360;
    const margin = { top: 20, right: 20, bottom: 60, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const x0 = d3
      .scaleBand()
      .domain(data.map((d) => d.group))
      .range([0, innerW])
      .paddingInner(0.3);
    const x1 = d3.scaleBand().domain(seriesKeys).range([0, x0.bandwidth()]).padding(0.08);
    const maxVal = d3.max(data, (d) => d3.max(d.series, (s) => s.value)) || 1;
    const y = d3.scaleLinear().domain([0, maxVal]).nice().range([innerH, 0]);
    const color = d3.scaleOrdinal().domain(seriesKeys).range(PALETTE);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x0))
      .attr("font-size", "0.75rem")
      .selectAll("text")
      .attr("transform", "rotate(-20)")
      .style("text-anchor", "end");

    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("font-size", "0.75rem");

    const groupG = g
      .selectAll(".group")
      .data(data)
      .join("g")
      .attr("class", "group")
      .attr("transform", (d) => `translate(${x0(d.group)},0)`);

    groupG
      .selectAll("rect")
      .data((d) => d.series.map((s) => ({ ...s, group: d.group })))
      .join("rect")
      .attr("x", (d) => x1(d.key))
      .attr("y", (d) => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", (d) => innerH - y(d.value))
      .attr("fill", (d) => color(d.key))
      .attr("rx", 2);

    // Legend
    const legend = d3.select(legendRef.current);
    legend.selectAll("*").remove();
    const legendItems = legend
      .selectAll(".item")
      .data(seriesKeys)
      .join("div")
      .style("display", "inline-flex")
      .style("align-items", "center")
      .style("margin-right", "1rem")
      .style("font-size", "0.8rem")
      .style("font-family", "system-ui, sans-serif");

    legendItems
      .append("span")
      .style("display", "inline-block")
      .style("width", "10px")
      .style("height", "10px")
      .style("border-radius", "2px")
      .style("margin-right", "0.35rem")
      .style("background", (d) => color(d));

    legendItems.append("span").text((d) => d);
  }, [data, seriesKeys, width, containerRef]);

  return (
    // Decorative — every value here is also in the "Full matrix" table below it.
    <div ref={containerRef} style={{ width: "100%" }} aria-hidden="true">
      <div ref={legendRef} style={{ marginBottom: "0.5rem" }}></div>
      <svg ref={svgRef}></svg>
    </div>
  );
}
