import type { Exercise, WorkoutSession } from "@/lib/types";

export type PersonalRecord = {
  exerciseId: string;
  name: string;
  maxWeight: number;
};

/** Max logged weight per exercise (trophy case / SPEC2). */
export function computePersonalRecords(sessions: WorkoutSession[], exercises: Exercise[]): PersonalRecord[] {
  const nameById = new Map(exercises.map((e) => [e.id, e.name] as const));
  const maxByExercise = new Map<string, number>();

  for (const session of sessions) {
    for (const set of session.sets) {
      const prev = maxByExercise.get(set.exerciseId) ?? 0;
      if (set.weight > prev) maxByExercise.set(set.exerciseId, set.weight);
    }
  }

  const rows: PersonalRecord[] = [];
  for (const [exerciseId, maxWeight] of maxByExercise) {
    const name = nameById.get(exerciseId) ?? sessions.flatMap((s) => s.sets).find((x) => x.exerciseId === exerciseId)?.exerciseNameSnapshot ?? "Exercise";
    rows.push({ exerciseId, name, maxWeight });
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
