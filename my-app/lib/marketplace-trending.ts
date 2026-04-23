import type { MarketplaceSplit } from "@/lib/supabase-types";

/** SPEC2 simplified trending: likes / (days since creation + 2)^1.8 */
export function trendingScore(split: Pick<MarketplaceSplit, "likes_count" | "created_at">): number {
  const created = new Date(split.created_at).getTime();
  const days = Math.max(0, (Date.now() - created) / 86_400_000);
  const denom = Math.pow(days + 2, 1.8);
  return denom > 0 ? split.likes_count / denom : split.likes_count;
}

export type LikeRow = { target_id: string; created_at: string };

/** Likes on this split in the last 7 days (SPEC2 like velocity). */
export function likeVelocityLast7Days(splitId: string, likes: LikeRow[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  return likes.filter((r) => r.target_id === splitId && new Date(r.created_at).getTime() >= cutoff).length;
}

export function sortByTrending(splits: MarketplaceSplit[], recentLikes: LikeRow[]): MarketplaceSplit[] {
  return [...splits].sort((a, b) => {
    const va = likeVelocityLast7Days(a.id, recentLikes);
    const vb = likeVelocityLast7Days(b.id, recentLikes);
    if (vb !== va) return vb - va;
    return trendingScore(b) - trendingScore(a);
  });
}

export function topAllTime(splits: MarketplaceSplit[], n: number): MarketplaceSplit[] {
  return [...splits].sort((a, b) => b.likes_count - a.likes_count).slice(0, n);
}
