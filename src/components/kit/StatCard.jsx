/**
 * One labelled figure. `size` only sets the minimum width so rows wrap sensibly.
 * @param {{
 *   label: string,
 *   value: string | number,
 *   sub?: string,
 *   tone?: import("../../lib/cac/calc.js").Tone | null,
 *   size?: "narrow" | "default" | "wide",
 * }} props
 */
export default function StatCard({ label, value, sub, tone, size = "default" }) {
  const sizeClass = size === "default" ? "" : ` stat-card--${size}`;
  return (
    <div className={`stat-card${sizeClass}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub && <div className={tone ? `stat-card__sub stat-card__sub--${tone}` : "stat-card__sub"}>{sub}</div>}
    </div>
  );
}
