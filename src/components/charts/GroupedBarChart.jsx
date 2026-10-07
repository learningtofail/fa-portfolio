import { useRef, useEffect } from "react";
import * as d3 from "d3";
import { useChartWidth } from "./useChartWidth.js";

/** Series are styled by `.chart__series--N` (chart.css), which reads `--chart-N`. Series beyond five repeat the palette. */
const seriesClass = (/** @type {number} */ index) => `chart__series--${(index % 5) + 1}`;

/**
 * Grouped bar chart. data: [{ group: string, series: [{ key, value }] }]
 * seriesKeys: ordered list of series keys, used for consistent color + legend.
 * yAxisTitle: optional title for the value axis (the unit).
 */
export default function GroupedBarChart({ data, seriesKeys, yAxisTitle = "" }) {
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
    const classFor = (/** @type {string} */ key) => seriesClass(seriesKeys.indexOf(key));

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x0))
      .attr("class", "chart__axis")
      .selectAll("text")
      .attr("transform", "rotate(-20)")
      .attr("text-anchor", "end");

    g.append("g").call(d3.axisLeft(y).ticks(5)).attr("class", "chart__axis");

    if (yAxisTitle) {
      g.append("text")
        .attr("class", "chart__axis-title")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerH / 2)
        .attr("y", -margin.left + 14)
        .attr("text-anchor", "middle")
        .text(yAxisTitle);
    }

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
      .attr("class", (d) => classFor(d.key))
      .attr("rx", 2);

    // Legend
    const legend = d3.select(legendRef.current);
    legend.selectAll("*").remove();
    const legendItems = legend
      .selectAll(".chart__legend-item")
      .data(seriesKeys)
      .join("div")
      .attr("class", "chart__legend-item");

    legendItems.append("span").attr("class", (d) => `chart__swatch ${classFor(d)}`);

    legendItems.append("span").text((d) => d);
  }, [data, seriesKeys, yAxisTitle, width, containerRef]);

  return (
    // Decorative — every value here is also in the "Full matrix" table below it.
    <div ref={containerRef} className="chart" aria-hidden="true">
      <div ref={legendRef} className="chart__legend"></div>
      <svg ref={svgRef}></svg>
    </div>
  );
}
