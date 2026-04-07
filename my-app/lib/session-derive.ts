import { calendarDaysBetween } from "./date";
import type { WorkoutSession } from "./types";

/**
 * Rebuild streak and last workout date from remaining sessions (e.g. after a delete).
 * Unique calendar days are processed in order; gap ≥ 3 days resets streak to 1.
 */
export function rebuildStreakFromSessions(sessions: WorkoutSession[]): {
  streak: number;
  lastWorkoutDate: string | null;
} {
  if (sessions.length === 0) return { streak: 0, lastWorkoutDate: null };

  const uniqueDates = [...new Set(sessions.map((s) => s.localDate))].sort((a, b) => a.localeCompare(b));

  let streak = 1;
  let lastDate = uniqueDates[0];
  for (let i = 1; i < uniqueDates.length; i++) {
    const d = uniqueDates[i];
    const gap = calendarDaysBetween(lastDate, d);
    if (gap >= 3) streak = 1;
    else streak += 1;
    lastDate = d;
  }

  return { streak, lastWorkoutDate: uniqueDates[uniqueDates.length - 1] };
}

/** Most recent weight per exercise from session history (newest session wins per exercise). */
export function rebuildLastWeightsFromSessions(sessions: WorkoutSession[]): Record<string, number> {
  const sorted = [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const out: Record<string, number> = {};
  for (const ses of sorted) {
    for (const set of ses.sets) {
      if (out[set.exerciseId] === undefined) {
        out[set.exerciseId] = set.weight;
      }
    }
  }
  return out;
}
