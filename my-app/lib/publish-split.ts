import type { SupabaseClient } from "@supabase/supabase-js";

import { splitToMarketplaceStructureJson } from "@/lib/marketplace-split-export";
import type { Exercise, Split } from "@/lib/types";

export function canPublishSplit(split: Split): { ok: true } | { ok: false; reason: string } {
  const used = split.slots.filter(Boolean) as NonNullable<Split["slots"][number]>[];
  if (used.length === 0) {
    return { ok: false, reason: "Add at least one workout day before publishing." };
  }
  for (const slot of used) {
    if (!slot.workoutName.trim()) {
      return { ok: false, reason: "Each workout day needs a name." };
    }
    if (slot.exerciseIds.length === 0) {
      return { ok: false, reason: "Each day needs at least one exercise." };
    }
  }
  return { ok: true };
}

export async function publishSplitToMarketplace(
  supabase: SupabaseClient,
  userId: string,
  split: Split,
  exercises: Exercise[]
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const v = canPublishSplit(split);
  if (!v.ok) return { ok: false, message: v.reason };

  const structure_json = splitToMarketplaceStructureJson(split, exercises);
  const { data, error } = await supabase
    .from("splits")
    .insert({
      creator_id: userId,
      name: split.name.trim().slice(0, 200),
      description: null,
      structure_json,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, message: error.message };
  if (!data || typeof (data as { id?: unknown }).id !== "string") {
    return { ok: false, message: "No row returned." };
  }
  return { ok: true, id: (data as { id: string }).id };
}
