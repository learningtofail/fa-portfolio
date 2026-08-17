import { useRef, useEffect } from "react";
import * as d3 from "d3";

/**
 * Cumulative gross-profit-recovered line chart with a CAC reference line
 * and a marker at the payback month. Brand-neutral placeholder colors —
 * swap for the site palette in Phase 7.
 */
export default function PaybackChart({ monthlyGrossProfit, cac, paybackMonths, horizonMonths }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!monthlyGrossProfit || monthlyGrossProfit <= 0) return;

    const width = containerRef.current?.clientWidth || 640;
    const height = 320;
    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const months = d3.range(0, horizonMonths + 1);
    const data = months.map((m) => ({ month: m, cumulative: monthlyGrossProfit * m }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const x = d3.scaleLinear().domain([0, horizonMonths]).range([0, innerW]);
    const yMax = Math.max(cac, d3.max(data, (d) => d.cumulative)) * 1.1;
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(Math.min(horizonMonths, 12)).tickFormat((d) => `${d}mo`))
      .attr("font-size", "0.75rem");

    g.append("g").call(d3.axisLeft(y).ticks(5).tickFormat((d) => `$${d3.format(",.0f")(d)}`)).attr("font-size", "0.75rem");

    // CAC reference line
    g.append("line")
      .attr("x1", 0)
      .attr("x2", innerW)
      .attr("y1", y(cac))
      .attr("y2", y(cac))
      .attr("stroke", "#b00020")
      .attr("stroke-dasharray", "4,4");

    g.append("text")
      .attr("x", innerW)
      .attr("y", y(cac) - 6)
      .attr("text-anchor", "end")
      .attr("font-size", "0.75rem")
      .attr("fill", "#b00020")
      .text(`CAC: $${d3.format(",.0f")(cac)}`);

    // Cumulative gross profit line + area
    const line = d3.line().x((d) => x(d.month)).y((d) => y(d.cumulative));
    const area = d3.area().x((d) => x(d.month)).y0(innerH).y1((d) => y(d.cumulative));

    g.append("path").datum(data).attr("fill", "#3a5a9b").attr("opacity", 0.15).attr("d", area);
    g.append("path").datum(data).attr("fill", "none").attr("stroke", "#3a5a9b").attr("stroke-width", 2).attr("d", line);

    // Payback marker
    if (paybackMonths != null && paybackMonths <= horizonMonths) {
      g.append("line")
        .attr("x1", x(paybackMonths))
        .attr("x2", x(paybackMonths))
        .attr("y1", 0)
        .attr("y2", innerH)
        .attr("stroke", "#216e3b")
        .attr("stroke-dasharray", "3,3");

      g.append("text")
        .attr("x", x(paybackMonths) + 6)
        .attr("y", 14)
        .attr("font-size", "0.75rem")
        .attr("fill", "#216e3b")
        .text(`Payback: ${paybackMonths.toFixed(1)}mo`);
    }
  }, [monthlyGrossProfit, cac, paybackMonths, horizonMonths]);

  return (
    // Decorative — CAC and payback period are both already in the StatCard row above.
    <div ref={containerRef} style={{ width: "100%" }} aria-hidden="true">
      <svg ref={svgRef}></svg>
    </div>
  );
}
