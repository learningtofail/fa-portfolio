/**
 * Outer frame of a tool island. Page chrome (heading, intro) lives in ToolLayout.astro.
 * @param {{ children: import("react").ReactNode, wide?: boolean }} props
 */
export default function ToolShell({ children, wide = false }) {
  return <div className={wide ? "tool tool--wide" : "tool"}>{children}</div>;
}
