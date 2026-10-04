/** First year of professional work; the years-of-experience figure is derived from it. */
export const CAREER_START_YEAR = 2004;

/**
 * Whole calendar years since `CAREER_START_YEAR`. Evaluated at build time, so it moves each January
 * on the next deploy instead of going stale in copy.
 * @param {Date} [now]
 * @returns {number}
 */
export function yearsOfExperience(now = new Date()) {
  return now.getFullYear() - CAREER_START_YEAR;
}
