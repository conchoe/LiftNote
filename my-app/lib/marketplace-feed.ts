import { sortByTrending, type LikeRow } from "@/lib/marketplace-trending";
import type { MarketplaceSplit } from "@/lib/supabase-types";

export type MarketplaceFeedResult = {
  /** Top 3 trending splits from the public profile that earned the most split likes in the last 7 days. */
  trending: MarketplaceSplit[];
  /** Top 5 split likes among all public-profile splits. */
  allTime: MarketplaceSplit[];
};

function publicProfileSplits(splits: MarketplaceSplit[], publicCreatorIds: Set<string>): MarketplaceSplit[] {
  return splits.filter((s) => s.creator_id != null && publicCreatorIds.has(s.creator_id));
}

function weeklySplitLikesByCreator(
  publicSplits: MarketplaceSplit[],
  recentLikes: LikeRow[]
): Map<string, number> {
  const weekMs = 7 * 86_400_000;
  const cutoff = Date.now() - weekMs;
  const splitToCreator = new Map(publicSplits.map((s) => [s.id, s.creator_id] as const));
  const by = new Map<string, number>();
  for (const r of recentLikes) {
    if (new Date(r.created_at).getTime() < cutoff) continue;
    const cid = splitToCreator.get(r.target_id);
    if (!cid) continue;
    by.set(cid, (by.get(cid) ?? 0) + 1);
  }
  return by;
}

function pickWinningCreator(weeklyByCreator: Map<string, number>, publicSplits: MarketplaceSplit[]): string | null {
  if (weeklyByCreator.size === 0) return null;
  let max = 0;
  for (const v of weeklyByCreator.values()) max = Math.max(max, v);
  if (max <= 0) return null;

  const tied = [...weeklyByCreator.entries()].filter(([, v]) => v === max).map(([k]) => k);
  if (tied.length === 1) return tied[0];

  const byCreator = new Map<string, MarketplaceSplit[]>();
  for (const s of publicSplits) {
    if (!s.creator_id) continue;
    const arr = byCreator.get(s.creator_id) ?? [];
    arr.push(s);
    byCreator.set(s.creator_id, arr);
  }

  let best = tied[0];
  let bestScore = -1;
  for (const cid of tied) {
    const list = byCreator.get(cid) ?? [];
    const score = list.reduce((acc, x) => acc + x.likes_count, 0);
    if (score > bestScore) {
      bestScore = score;
      best = cid;
    } else if (score === bestScore && cid.localeCompare(best) < 0) {
      best = cid;
    }
  }
  return best;
}

/**
 * Marketplace surface = public-profile splits only:
 * - All-time: top 5 by `likes_count`.
 * - Trending: among creators, whoever got the most split likes in the last 7 days; then their top 3 by existing trending sort.
 */
export function computeMarketplaceFeed(
  splits: MarketplaceSplit[],
  publicCreatorIds: Set<string>,
  recentLikes: LikeRow[]
): MarketplaceFeedResult {
  const pub = publicProfileSplits(splits, publicCreatorIds);
  const ranked = [...pub].sort((a, b) => b.likes_count - a.likes_count);

  const weekly = weeklySplitLikesByCreator(pub, recentLikes);
  const winner = pickWinningCreator(weekly, pub);
  const winnerSplits = winner ? pub.filter((s) => s.creator_id === winner) : [];
  const trending = winner ? sortByTrending(winnerSplits, recentLikes).slice(0, 3) : [];

  const trendingIds = new Set(trending.map((s) => s.id));
  const allTime: MarketplaceSplit[] = [];
  for (const s of ranked) {
    if (allTime.length >= 5) break;
    if (!trendingIds.has(s.id)) allTime.push(s);
  }
  for (const s of ranked) {
    if (allTime.length >= 5) break;
    if (!allTime.some((x) => x.id === s.id)) allTime.push(s);
  }

  return { trending, allTime };
}
