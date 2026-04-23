import { generateId } from "@/lib/id";
import type { Exercise, WorkoutSlot } from "@/lib/types";

function ensureSeven(slots: WorkoutSlot[]): WorkoutSlot[] {
  const copy = [...slots];
  while (copy.length < 7) copy.push(null);
  return copy.slice(0, 7);
}

export type ParsedSplitImport = {
  slots: WorkoutSlot[];
  exercises: Exercise[];
};

/**
 * Parse marketplace `structure_json` into slots + exercises with fresh IDs.
 */
export function parseMarketplaceStructureJson(json: unknown): ParsedSplitImport | null {
  if (json === null || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  if (!Array.isArray(root.slots)) return null;

  const libRaw = root.exerciseLibrary;
  const libById = new Map<string, string>();
  if (Array.isArray(libRaw)) {
    for (const e of libRaw) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      if (typeof o.id === "string" && typeof o.name === "string") libById.set(o.id, o.name.trim());
    }
  }

  const exercises: Exercise[] = [];
  const addExercise = (name: string): string => {
    const id = generateId();
    exercises.push({ id, name: name.trim() || "Exercise" });
    return id;
  };

  const slots: WorkoutSlot[] = root.slots.map((cell): WorkoutSlot => {
    if (cell === null) return null;
    if (typeof cell !== "object") return null;
    const c = cell as Record<string, unknown>;
    const wn = typeof c.workoutName === "string" ? c.workoutName.trim() : "";
    if (!wn) return null;

    if (Array.isArray(c.exerciseNames)) {
      const names = c.exerciseNames.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      if (names.length === 0) return null;
      const exerciseIds = names.map((name) => addExercise(name));
      return { workoutName: wn, exerciseIds };
    }

    if (Array.isArray(c.exerciseIds)) {
      const ids = c.exerciseIds.filter((x): x is string => typeof x === "string");
      if (ids.length === 0) return null;
      const exerciseIds = ids.map((oldId) => {
        const label = libById.get(oldId) ?? "Exercise";
        return addExercise(label);
      });
      return { workoutName: wn, exerciseIds };
    }

    return null;
  });

  const used = slots.filter(Boolean) as NonNullable<WorkoutSlot>[];
  if (used.length === 0) return null;

  return { slots: ensureSeven(slots), exercises };
}
