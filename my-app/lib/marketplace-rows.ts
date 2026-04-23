import type { MarketplaceSplit } from "@/lib/supabase-types";

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

/** Narrow Supabase rows into `MarketplaceSplit[]` (REVIEW: avoid blind casts). */
export function parseMarketplaceSplitRows(rows: unknown[] | null | undefined): MarketplaceSplit[] {
  if (!rows?.length) return [];
  const out: MarketplaceSplit[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || typeof r.name !== "string") continue;
    const created =
      typeof r.created_at === "string"
        ? r.created_at
        : r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date().toISOString();
    out.push({
      id: r.id,
      creator_id: typeof r.creator_id === "string" ? r.creator_id : null,
      name: r.name,
      description: typeof r.description === "string" ? r.description : null,
      structure_json: r.structure_json ?? null,
      likes_count: num(r.likes_count, 0),
      created_at: created,
    });
  }
  return out;
}
