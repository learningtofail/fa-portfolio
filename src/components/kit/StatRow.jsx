/**
 * A row of StatCards. It owns the polite live region, so a screen reader hears results change.
 * @param {{ children: import("react").ReactNode, tight?: boolean, padded?: boolean }} props
 */
export default function StatRow({ children, tight = false, padded = false }) {
  const modifiers = `${tight ? " stat-row--tight" : ""}${padded ? " stat-row--padded" : ""}`;
  return (
    <div aria-live="polite" aria-atomic="true" className={`stat-row${modifiers}`}>
      {children}
    </div>
  );
}
