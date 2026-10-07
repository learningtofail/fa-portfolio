/**
 * Puts one journey's touches in time order without letting a missing timestamp jump to the start.
 * @typedef {{ channel: string, time: number | null, index: number }} RawTouch `index` is the row's position in the file.
 */

/**
 * Orders touches by timestamp, then by file position. A touch without a usable timestamp keeps its place in file
 * order next to its neighbours: it takes the time of the dated touch before it (or, at the start of the journey,
 * the first dated touch after it), so it sorts right behind (or right ahead of) that touch. A journey with no dated
 * touch at all keeps file order and every touch gets the same time.
 * @param {RawTouch[]} touches In file order.
 * @returns {{ ordered: Array<{ channel: string, time: number }>, undated: number, tied: boolean }}
 *   `undated` counts touches that had no timestamp; `tied` is true when two dated touches share a timestamp.
 */
export function orderTouches(touches) {
  const dated = touches.filter((t) => t.time !== null);
  const firstDated = dated.length > 0 ? dated[0].time : 0;
  let previous = /** @type {number | null} */ (null);
  const effective = touches.map((t) => {
    if (t.time !== null) previous = t.time;
    return { channel: t.channel, index: t.index, time: t.time ?? previous ?? firstDated };
  });
  effective.sort((a, b) => a.time - b.time || a.index - b.index);
  return {
    ordered: effective.map(({ channel, time }) => ({ channel, time })),
    undated: touches.length - dated.length,
    tied: new Set(dated.map((t) => t.time)).size < dated.length,
  };
}
