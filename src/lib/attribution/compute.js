/**
 * Pure multi-touch attribution: splits each converting journey's value across its ordered touches under five
 * models. Channel and journey names are user data, so they only ever key Maps (D2). Turning a CSV into journeys
 * (columns, dates, revenue, dedupe) lives in prepare.js; the credit math here is pinned by golden tests.
 */

/** @typedef {{ channel: string, time: number }} ScoredTouch Touches in order, time in ms (UTC). */
/** @typedef {{ id: string, value: number, touches: ScoredTouch[] }} ScoredJourney */
/**
 * @typedef {{
 *   credit: Map<string, Map<string, number>>,
 *   channels: string[],
 *   totalValue: number,
 *   touchpointCount: number,
 *   journeyCount: number,
 * }} AttributionResult
 */

export const MODELS = /** @type {const} */ (["Last-touch", "First-touch", "Linear", "Position-based", "Time-decay"]);
export const DEFAULT_HALF_LIFE_DAYS = 7;
/** Position-based weights: first and last touch take 40 percent each, the middle touches share 20 percent. Two touches split 50/50. */
export const POSITION_WEIGHTS = Object.freeze({ first: 0.4, middle: 0.2, last: 0.4, two: 0.5 });
export const DAY_MS = 86400000;

/**
 * Splits one journey's value across its touches under every model.
 * @param {ScoredJourney} journey Touches already in time order.
 * @param {number} halfLifeDays
 * @param {(model: string, channel: string, amount: number) => void} addCredit
 */
function creditJourney(journey, halfLifeDays, addCredit) {
  const { touches, value } = journey;
  const n = touches.length;

  addCredit("Last-touch", touches[n - 1].channel, value);
  addCredit("First-touch", touches[0].channel, value);
  touches.forEach((t) => addCredit("Linear", t.channel, value / n));

  if (n === 1) {
    addCredit("Position-based", touches[0].channel, value);
  } else if (n === 2) {
    addCredit("Position-based", touches[0].channel, value * POSITION_WEIGHTS.two);
    addCredit("Position-based", touches[1].channel, value * POSITION_WEIGHTS.two);
  } else {
    addCredit("Position-based", touches[0].channel, value * POSITION_WEIGHTS.first);
    addCredit("Position-based", touches[n - 1].channel, value * POSITION_WEIGHTS.last);
    const middleShare = (value * POSITION_WEIGHTS.middle) / (n - 2);
    for (let i = 1; i < n - 1; i++) addCredit("Position-based", touches[i].channel, middleShare);
  }

  const lastTime = touches[n - 1].time;
  const weights = touches.map((t) => Math.pow(2, -((lastTime - t.time) / (halfLifeDays * DAY_MS))));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  touches.forEach((t, i) => addCredit("Time-decay", t.channel, (value * weights[i]) / totalWeight));
}

/**
 * @param {ScoredJourney[]} journeys Converting journeys with at least one touch, touches in time order.
 * @param {{ halfLifeDays?: number }} [options] Time-decay half-life in days (default 7).
 * @returns {AttributionResult}
 */
export function computeAttribution(journeys, { halfLifeDays = DEFAULT_HALF_LIFE_DAYS } = {}) {
  /** @type {Map<string, Map<string, number>>} */
  const credit = new Map(MODELS.map((m) => [m, new Map()]));
  const addCredit = (/** @type {string} */ model, /** @type {string} */ channel, /** @type {number} */ amount) => {
    const byChannel = credit.get(model);
    byChannel.set(channel, (byChannel.get(channel) || 0) + amount);
  };

  let totalValue = 0;
  let touchpointCount = 0;
  let journeyCount = 0;
  journeys.forEach((journey) => {
    if (journey.touches.length === 0) return;
    journeyCount += 1;
    touchpointCount += journey.touches.length;
    totalValue += journey.value;
    creditJourney(journey, halfLifeDays, addCredit);
  });

  const channels = new Set();
  MODELS.forEach((m) => credit.get(m).forEach((_, channel) => channels.add(channel)));

  return { credit, channels: [...channels].sort(), totalValue, touchpointCount, journeyCount };
}

/**
 * @param {AttributionResult} result
 * @param {string} model
 * @param {string} channel
 * @returns {number} Credit the model gave the channel, or 0.
 */
export function creditFor(result, model, channel) {
  return result.credit.get(model)?.get(channel) || 0;
}
