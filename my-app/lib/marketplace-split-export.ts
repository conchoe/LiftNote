import type { Exercise, Split } from "@/lib/types";

/** Shape expected by `parseMarketplaceStructureJson` when someone downloads the split. */
export function splitToMarketplaceStructureJson(split: Split, exercises: Exercise[]): Record<string, unknown> {
  const slots = split.slots.map((slot): Record<string, unknown> | null => {
    if (!slot) return null;
    const names = slot.exerciseIds
      .map((id) => exercises.find((e) => e.id === id)?.name?.trim())
      .filter((n): n is string => Boolean(n && n.length > 0));
    if (names.length === 0) return null;
    return { workoutName: slot.workoutName.trim(), exerciseNames: names };
  });
  return { slots };
}
