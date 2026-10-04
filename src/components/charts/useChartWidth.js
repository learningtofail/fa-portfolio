import { useLayoutEffect, useRef, useState } from "react";

/**
 * Tracks the rendered width of a chart container so charts redraw when the viewport or layout changes (D10).
 * Falls back to a single measurement where ResizeObserver is missing (older engines, jsdom).
 * @param {number} fallbackWidth Width to use before the first measurement or when the container reports 0.
 * @returns {[import("react").RefObject<HTMLDivElement | null>, number]} Ref for the container and its current width.
 */
export function useChartWidth(fallbackWidth) {
  const ref = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(Math.round(el.clientWidth));
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0].contentRect.width);
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, width || fallbackWidth];
}
