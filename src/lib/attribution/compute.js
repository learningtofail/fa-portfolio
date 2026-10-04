/**
 * Pure multi-touch attribution. Channel and journey names are user data, so they only ever key Maps (D2).
 * The credit math is pinned by golden tests (tests/unit/attribution.compute.test.js); the revenue input contract
 * is an open decision (docs/open-decisions.md, D9), so revenue is still summed per journey.
 */

/** @typedef {{ journeyId: string, channel: string, time: number, timeIsFallback: boolean, revenue: number | null }} Touchpoint */
/**
 * @typedef {{
 *   credit: Map<string, Map<string, number>>,
 *   channels: string[],
 *   totalValue: number,
 *   touchpointCount: number,
 *   journeyCount: number,
 *   revenueIssues: RevenueIssues,
 * }} AttributionResult
 */
/** @typedef {{ repeatedRevenueJourneys: number, journeysWithRevenue: number, journeysWithoutRevenue: number, mixedUnits: boolean }} RevenueIssues */

export const MODELS = /** @type {const} */ (["Last-touch", "First-touch", "Linear", "Position-based", "Time-decay"]);
export const HALF_LIFE_DAYS = 7;
const DAY_MS = 86400000;

/**
 * @param {Record<string, string>} keys A row with lowercased headers.
 * @param {number} fallbackIndex Row index, used to order rows when the timestamp is missing or unparseable.
 * @returns {Touchpoint}
 */
export function normalizeTouchpoint(keys, fallbackIndex) {
  const rawRevenue = keys.revenue;
  const revenue =
    rawRevenue !== undefined && rawRevenue !== "" && !isNaN(Number(rawRevenue)) ? Number(rawRevenue) : null;
  const parsedTime = keys.timestamp ? Date.parse(keys.timestamp) : NaN;
  return {
    journeyId: keys.journey_id || keys.journeyid || keys.journey || "",
    channel: keys.channel || keys.touchpoint || "(unknown)",
    time: isNaN(parsedTime) ? fallbackIndex * DAY_MS : parsedTime,
    timeIsFallback: isNaN(parsedTime),
    revenue,
  };
}

/**
 * Groups rows into journeys. Rows with no journey id cannot be grouped and are skipped.
 * @param {Array<Record<string, string>>} rows Rows with lowercased headers.
 * @returns {{ journeys: Map<string, Touchpoint[]>, anyRevenue: boolean, anyFallbackTime: boolean }}
 */
export function groupJourneys(rows) {
  /** @type {Map<string, Touchpoint[]>} */
  const journeys = new Map();
  let anyRevenue = false;
  let anyFallbackTime = false;
  rows.forEach((row, i) => {
    const touch = normalizeTouchpoint(row, i);
    if (!touch.journeyId) return;
    if (touch.revenue != null) anyRevenue = true;
    if (touch.timeIsFallback) anyFallbackTime = true;
    if (!journeys.has(touch.journeyId)) journeys.set(touch.journeyId, []);
    journeys.get(touch.journeyId).push(touch);
  });
  return { journeys, anyRevenue, anyFallbackTime };
}

/**
 * Flags revenue input that the credit math cannot interpret safely (D9). Reports only; the math is unchanged.
 * @param {Map<string, Array<{ revenue: number | null }>>} journeys
 * @returns {RevenueIssues}
 */
export function detectRevenueIssues(journeys) {
  let repeatedRevenueJourneys = 0;
  let journeysWithRevenue = 0;
  let journeysWithoutRevenue = 0;
  journeys.forEach((touches) => {
    const amounts = touches.map((t) => t.revenue || 0).filter((r) => r > 0);
    if (amounts.length === 0) {
      journeysWithoutRevenue += 1;
      return;
    }
    journeysWithRevenue += 1;
    if (amounts.length > 1 && amounts.every((a) => a === amounts[0])) repeatedRevenueJourneys += 1;
  });
  return {
    repeatedRevenueJourneys,
    journeysWithRevenue,
    journeysWithoutRevenue,
    mixedUnits: journeysWithRevenue > 0 && journeysWithoutRevenue > 0,
  };
}

/**
 * @param {RevenueIssues} issues
 * @returns {string[]} Human-readable warnings, empty when the input looks safe.
 */
export function revenueWarnings(issues) {
  const out = [];
  if (issues.repeatedRevenueJourneys > 0) {
    out.push(
      `${issues.repeatedRevenueJourneys} journey(s) repeat the same revenue on several rows. Revenue is summed across a journey's rows, so a conversion value copied onto every touchpoint is counted once per row.`,
    );
  }
  if (issues.mixedUnits) {
    out.push(
      `${issues.journeysWithRevenue} journey(s) have revenue and ${issues.journeysWithoutRevenue} do not. Journeys without revenue count as 1 next to revenue amounts from other journeys, so the totals mix units.`,
    );
  }
  return out;
}

/**
 * Splits one journey's value across its touches under every model.
 * @param {Touchpoint[]} touchesRaw
 * @param {(model: string, channel: string, amount: number) => void} addCredit
 * @returns {number} The journey's total value (revenue sum, or 1 when it has no revenue).
 */
function creditJourney(touchesRaw, addCredit) {
  const touches = [...touchesRaw].sort((a, b) => a.time - b.time);
  const n = touches.length;
  const revenueSum = touches.reduce((sum, t) => sum + (t.revenue || 0), 0);
  const value = revenueSum > 0 ? revenueSum : 1;

  addCredit("Last-touch", touches[n - 1].channel, value);
  addCredit("First-touch", touches[0].channel, value);
  touches.forEach((t) => addCredit("Linear", t.channel, value / n));

  if (n === 1) {
    addCredit("Position-based", touches[0].channel, value);
  } else if (n === 2) {
    addCredit("Position-based", touches[0].channel, value * 0.5);
    addCredit("Position-based", touches[1].channel, value * 0.5);
  } else {
    addCredit("Position-based", touches[0].channel, value * 0.4);
    addCredit("Position-based", touches[n - 1].channel, value * 0.4);
    const middleShare = (value * 0.2) / (n - 2);
    for (let i = 1; i < n - 1; i++) addCredit("Position-based", touches[i].channel, middleShare);
  }

  const lastTime = touches[n - 1].time;
  const weights = touches.map((t) => Math.pow(2, -((lastTime - t.time) / (HALF_LIFE_DAYS * DAY_MS))));
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  touches.forEach((t, i) => addCredit("Time-decay", t.channel, (value * weights[i]) / totalWeight));
  return value;
}

/**
 * @param {Map<string, Touchpoint[]>} journeys Non-empty journeys.
 * @returns {AttributionResult}
 */
export function computeAttribution(journeys) {
  /** @type {Map<string, Map<string, number>>} */
  const credit = new Map(MODELS.map((m) => [m, new Map()]));
  const addCredit = (/** @type {string} */ model, /** @type {string} */ channel, /** @type {number} */ amount) => {
    const byChannel = credit.get(model);
    byChannel.set(channel, (byChannel.get(channel) || 0) + amount);
  };

  let totalValue = 0;
  let touchpointCount = 0;
  journeys.forEach((touches) => {
    touchpointCount += touches.length;
    totalValue += creditJourney(touches, addCredit);
  });

  const channels = new Set();
  MODELS.forEach((m) => credit.get(m).forEach((_, channel) => channels.add(channel)));

  return {
    credit,
    channels: [...channels].sort(),
    totalValue,
    touchpointCount,
    journeyCount: journeys.size,
    revenueIssues: detectRevenueIssues(journeys),
  };
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
