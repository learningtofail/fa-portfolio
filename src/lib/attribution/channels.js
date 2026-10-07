/** Channel names come from the file. Labels and variants key Maps only (D2). */

export const BLANK_CHANNEL = "(blank channel)";

/**
 * Builds a function that maps a raw channel cell to the label it is scored under.
 * With normalisation on, names that differ only in case or spacing share one label (the most common spelling).
 * @param {Iterable<string>} rawChannels Every channel cell in the scored file.
 * @param {boolean} normalize
 * @returns {{ label: (raw: string) => string, merges: Array<{ label: string, variants: string[] }> }}
 *   `merges` lists the groups that combined spellings that differ by more than whitespace.
 */
export function buildChannelLabels(rawChannels, normalize) {
  const clean = (/** @type {string} */ raw) => raw.trim().replace(/\s+/g, " ");
  /** @type {Map<string, Map<string, number>>} */
  const groups = new Map();
  if (normalize) {
    for (const raw of rawChannels) {
      const text = clean(raw);
      if (text === "") continue;
      const key = text.toLowerCase();
      if (!groups.has(key)) groups.set(key, new Map());
      const variants = groups.get(key);
      variants.set(text, (variants.get(text) || 0) + 1);
    }
  }
  /** @type {Map<string, string>} */
  const labels = new Map();
  /** @type {Array<{ label: string, variants: string[] }>} */
  const merges = [];
  groups.forEach((variants, key) => {
    let best = "";
    let bestCount = -1;
    variants.forEach((count, text) => {
      if (count > bestCount) {
        best = text;
        bestCount = count;
      }
    });
    labels.set(key, best);
    if (variants.size > 1) merges.push({ label: best, variants: [...variants.keys()] });
  });
  return {
    label: (raw) => {
      if (raw.trim() === "") return BLANK_CHANNEL;
      return normalize ? labels.get(clean(raw).toLowerCase()) : raw;
    },
    merges,
  };
}
