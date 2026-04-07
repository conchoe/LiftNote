import type { WorkoutSession } from "./types";

export type VolumePoint = {
  sessionId: string;
  completedAt: string;
  localDate: string;
  volume: number;
  /** Short label for chart axis */
  label: string;
};

/**
 * Total volume (reps × weight) for one exercise per workout session, oldest → newest.
 */
export function volumeSeriesForExercise(sessions: WorkoutSession[], exerciseId: string): VolumePoint[] {
  const sorted = [...sessions].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const points: VolumePoint[] = [];

  for (const ses of sorted) {
    let vol = 0;
    for (const set of ses.sets) {
      if (set.exerciseId !== exerciseId) continue;
      vol += set.reps * set.weight;
    }
    if (vol <= 0) continue;
    const d = new Date(ses.localDate + "T12:00:00");
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    points.push({
      sessionId: ses.id,
      completedAt: ses.completedAt,
      localDate: ses.localDate,
      volume: vol,
      label,
    });
  }

  return points;
}
