import { generateId } from "@/lib/id";
import type { AppStateV1, Exercise, ExerciseLibraryKey } from "@/lib/types";

/** Ordered category metadata for UI + grouping. */
export const EXERCISE_CATEGORIES: { id: ExerciseLibraryKey; label: string }[] = [
  { id: "legs", label: "Legs" },
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "arms", label: "Arms" },
  { id: "core", label: "Core & Foundation" },
];

const BASE: { key: ExerciseLibraryKey; name: string }[] = [
  { key: "legs", name: "Back Squat / Front Squat" },
  { key: "legs", name: "Leg Press" },
  { key: "legs", name: "Romanian Deadlift (RDL)" },
  { key: "legs", name: "Leg Extension" },
  { key: "legs", name: "Leg Curl" },
  { key: "legs", name: "Lunges" },
  { key: "legs", name: "Calf Raises" },

  { key: "chest", name: "Bench Press (Flat, Incline, or Decline)" },
  { key: "chest", name: "Dumbbell Press" },
  { key: "chest", name: "Chest Flyes" },
  { key: "chest", name: "Push-ups" },
  { key: "chest", name: "Dips" },

  { key: "back", name: "Deadlift" },
  { key: "back", name: "Pull-ups / Chin-ups" },
  { key: "back", name: "Lat Pulldowns" },
  { key: "back", name: "Bent-Over Rows" },
  { key: "back", name: "Seated Cable Rows" },
  { key: "back", name: "Face Pulls" },

  { key: "shoulders", name: "Overhead Press" },
  { key: "shoulders", name: "Dumbbell Lateral Raises" },
  { key: "shoulders", name: "Arnold Press" },
  { key: "shoulders", name: "Front Raises" },
  { key: "shoulders", name: "Reverse Flyes" },

  { key: "arms", name: "Barbell Bicep Curls" },
  { key: "arms", name: "Hammer Curls" },
  { key: "arms", name: "Preacher Curls" },
  { key: "arms", name: "Tricep Pushdowns" },
  { key: "arms", name: "Skull Crushers" },
  { key: "arms", name: "Overhead Tricep Extension" },

  { key: "core", name: "Plank" },
  { key: "core", name: "Hanging Leg Raises" },
  { key: "core", name: "Crunches / Sit-ups" },
  { key: "core", name: "Russian Twists" },
];

/** Count of built-in starter moves (must match `createBaseExercises`). */
export const STARTER_CATALOG_SIZE = BASE.length;

/**
 * New installs get the full catalog with stable grouping keys.
 */
export function createBaseExercises(): Exercise[] {
  return BASE.map((row) => ({
    id: generateId(),
    name: row.name,
    libraryKey: row.key,
  }));
}

function sortByName(a: Exercise, b: Exercise): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export type GroupedExercises = {
  key: string;
  label: string;
  items: Exercise[];
}[];

/**
 * Splits the flat library into body-part groups, then a tail group for custom entries.
 */
export function groupExercisesForDisplay(exercises: Exercise[]): GroupedExercises {
  const bucket = new Map<ExerciseLibraryKey, Exercise[]>();
  for (const c of EXERCISE_CATEGORIES) {
    bucket.set(c.id, []);
  }
  const custom: Exercise[] = [];
  for (const e of exercises) {
    const k = e.libraryKey;
    if (k && bucket.has(k)) {
      bucket.get(k)!.push(e);
    } else {
      custom.push(e);
    }
  }
  const out: GroupedExercises = [];
  for (const c of EXERCISE_CATEGORIES) {
    const items = (bucket.get(c.id) ?? []).sort(sortByName);
    if (items.length) {
      out.push({ key: c.id, label: c.label, items });
    }
  }
  if (custom.length) {
    custom.sort(sortByName);
    out.push({ key: "custom", label: "Added by you", items: custom });
  }
  return out;
}

/**
 * Splits the grouped list into a visible “starter set” vs custom adds (for Log + split pickers).
 */
export function splitStarterAndCustom(exercises: Exercise[]): {
  starter: GroupedExercises;
  custom: GroupedExercises;
} {
  const all = groupExercisesForDisplay(exercises);
  return {
    starter: all.filter((g) => g.key !== "custom"),
    custom: all.filter((g) => g.key === "custom"),
  };
}

/** How many library rows are bundled starters (for badges). */
export function countStarterExercises(exercises: Exercise[]): number {
  return exercises.filter((e) => e.libraryKey != null).length;
}

/**
 * If there are no exercises and no split references an exercise, seed the default catalog
 * (first launch or “empty” profile that never had exercises before).
 */
export function shouldMergeBaseLibrary(state: AppStateV1): boolean {
  if (state.exercises.length > 0) return false;
  for (const sp of state.splits) {
    for (const slot of sp.slots) {
      if (slot && slot.exerciseIds.length > 0) {
        return false;
      }
    }
  }
  return true;
}

export function mergeBaseLibraryIfNeeded(state: AppStateV1): AppStateV1 {
  if (!shouldMergeBaseLibrary(state)) return state;
  return { ...state, exercises: createBaseExercises() };
}

function normExName(s: string): string {
  return s.trim().toLowerCase();
}

const baseByNormName: Map<string, { key: ExerciseLibraryKey; name: string }> = (() => {
  const m = new Map<string, { key: ExerciseLibraryKey; name: string }>();
  for (const row of BASE) {
    m.set(normExName(row.name), row);
  }
  return m;
})();

/**
 * Idempotent: ensures every built-in catalog move exists and has `libraryKey`.
 * Run on load so long-time users (who only had hand-typed custom exercises) still get the starter set.
 * Matches existing rows by name (case-insensitive) to assign `libraryKey` without duplicating; appends any missing moves.
 */
export function syncStarterCatalogIntoState(state: AppStateV1): AppStateV1 {
  const upgraded = state.exercises.map((e) => {
    if (e.libraryKey) return e;
    const row = baseByNormName.get(normExName(e.name));
    if (row) {
      return { ...e, libraryKey: row.key, name: row.name };
    }
    return e;
  });

  const present = new Set(upgraded.map((e) => normExName(e.name)));
  const toAdd: Exercise[] = [];
  for (const row of BASE) {
    if (!present.has(normExName(row.name))) {
      toAdd.push({ id: generateId(), name: row.name, libraryKey: row.key });
      present.add(normExName(row.name));
    }
  }
  if (toAdd.length === 0) {
    return { ...state, exercises: upgraded };
  }
  return { ...state, exercises: [...upgraded, ...toAdd] };
}
