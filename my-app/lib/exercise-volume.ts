import type { WorkoutSession } from "./types";

export type VolumePoint = {
  /** Stable key for list rendering */
  key: string;
  sessionId: string;
  completedAt: string;
  localDate: string;
  /** Set number within that session for this exercise */
  setIndex: number;
  volume: number;
  /** Short label under the bar */
  label: string;
};

/**
 * One bar per logged set: volume = reps × weight, chronological (oldest → newest).
 */
export function volumeSeriesPerSetForExercise(sessions: WorkoutSession[], exerciseId: string): VolumePoint[] {
  const sorted = [...sessions].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const points: VolumePoint[] = [];
  let ordinal = 0;

  for (const ses of sorted) {
    const forExercise = ses.sets
      .filter((x) => x.exerciseId === exerciseId)
      .sort((a, b) => a.setIndex - b.setIndex);

    for (const set of forExercise) {
      ordinal += 1;
      const vol = set.reps * set.weight;
      points.push({
        key: `${ses.id}-${set.exerciseId}-${set.setIndex}`,
        sessionId: ses.id,
        completedAt: ses.completedAt,
        localDate: ses.localDate,
        setIndex: set.setIndex,
        volume: vol,
        label: `${ordinal}`,
      });
    }
  }

  return points;
}
