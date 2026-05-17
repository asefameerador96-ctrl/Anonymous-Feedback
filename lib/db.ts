import { sql } from "@vercel/postgres";

export { sql };

/**
 * Round a date to the start of the day in UTC.
 * Used to coarsen timestamps so they can't be correlated with badge/log data.
 */
export function dayBucket(date: Date = new Date()): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  return d.toISOString().split("T")[0];
}

/**
 * Minimum responses required to display any aggregated result for a group.
 * Below this threshold, results are suppressed entirely.
 */
export const MIN_AGGREGATE_THRESHOLD = 5;
