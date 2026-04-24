import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";
import { useAuth } from "@/context/auth-context";
import { useWorkoutStore } from "@/context/workout-store";
import { errorMessageFromUnknown } from "@/lib/error";
import { computeMarketplaceFeed } from "@/lib/marketplace-feed";
import { parseMarketplaceStructureJson } from "@/lib/marketplace-split-import";
import { parseMarketplaceSplitRows } from "@/lib/marketplace-rows";
import { likeVelocityLast7Days, type LikeRow } from "@/lib/marketplace-trending";
import type { MarketplaceSplit } from "@/lib/supabase-types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cardShadow, colors, theme } from "@/lib/theme";

type OptimisticEntry = { liked: boolean; likes_count: number };

function mergeDisplay(
  split: MarketplaceSplit,
  likedIds: Set<string>,
  optimistic: Record<string, OptimisticEntry | undefined>
): { liked: boolean; likes_count: number } {
  const o = optimistic[split.id];
  if (o) return o;
  return { liked: likedIds.has(split.id), likes_count: split.likes_count ?? 0 };
}

export default function MarketplaceScreen() {
  const { session } = useAuth();
  const { importSplitBundle } = useWorkoutStore();
  const userId = session?.user?.id;

  const [catalogSplits, setCatalogSplits] = useState<MarketplaceSplit[]>([]);
  const [publicCreatorIds, setPublicCreatorIds] = useState<Set<string>>(() => new Set());
  const [recentLikes, setRecentLikes] = useState<LikeRow[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setError(null);

    const { data: splitRows, error: splitErr } = await supabase
      .from("splits")
      .select("id, creator_id, name, description, structure_json, likes_count, created_at")
      .order("likes_count", { ascending: false });

    if (splitErr) {
      setError(splitErr.message);
      setCatalogSplits([]);
      setPublicCreatorIds(new Set());
      setRecentLikes([]);
      setLikedIds(new Set());
      setLoading(false);
      return;
    }

    const list = parseMarketplaceSplitRows(splitRows ?? []);
    const creatorIds = [...new Set(list.map((s) => s.creator_id).filter(Boolean))] as string[];
    const nameById = new Map<string, string>();
    const pub = new Set<string>();
    if (creatorIds.length > 0) {
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, is_private, username")
        .in("id", creatorIds);
      if (profErr) {
        setError(profErr.message);
      } else {
        for (const row of profs ?? []) {
          const p = row as { id?: string; is_private?: boolean; username?: string };
          if (typeof p.id === "string" && typeof p.username === "string") {
            nameById.set(p.id, p.username);
          }
          if (typeof p.id === "string" && p.is_private === false) pub.add(p.id);
        }
      }
    }
    setPublicCreatorIds(pub);
    setCatalogSplits(
      list.map((s) => ({
        ...s,
        creator_display_name: s.creator_id ? nameById.get(s.creator_id) ?? null : null,
      }))
    );

    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data: likeRows } = await supabase
      .from("likes")
      .select("target_id, created_at")
      .eq("type", "split")
      .gte("created_at", weekAgo);

    setRecentLikes(
      (likeRows ?? []).filter(
        (r): r is LikeRow => typeof r.target_id === "string" && typeof r.created_at === "string"
      )
    );

    if (!userId || list.length === 0) {
      setLikedIds(new Set());
      setLoading(false);
      return;
    }

    const ids = list.map((s) => s.id);
    const { data: myLikes, error: likeErr } = await supabase
      .from("likes")
      .select("target_id")
      .eq("user_id", userId)
      .eq("type", "split")
      .in("target_id", ids);

    if (likeErr) {
      setError(likeErr.message);
      setLikedIds(new Set());
    } else {
      setLikedIds(new Set((myLikes ?? []).map((r) => r.target_id as string)));
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void load();
  }, [configured, load]);

  useEffect(() => {
    const client = supabase;
    if (!client || !configured) return;
    const channel = client
      .channel("marketplace-splits")
      .on("postgres_changes", { event: "*", schema: "public", table: "splits" }, () => void load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "likes" }, () => void load())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "likes" }, () => void load())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [configured, load]);

  const { trending, allTime: allTimeGreats } = useMemo(
    () => computeMarketplaceFeed(catalogSplits, publicCreatorIds, recentLikes),
    [catalogSplits, publicCreatorIds, recentLikes]
  );

  const clearOptimisticKey = useCallback((id: string) => {
    setOptimistic((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const onToggleLike = useCallback(
    async (split: MarketplaceSplit) => {
      if (!supabase) return;

      const display = mergeDisplay(split, likedIds, optimistic);
      const nextLiked = !display.liked;
      const nextCount = Math.max(0, display.likes_count + (nextLiked ? 1 : -1));

      setOptimistic((prev) => ({
        ...prev,
        [split.id]: { liked: nextLiked, likes_count: nextCount },
      }));

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const user = session?.user;
        if (!user) {
          clearOptimisticKey(split.id);
          Alert.alert("Sign in to like", "Log in with Supabase Auth to like splits.");
          return;
        }

        if (nextLiked) {
          const { error: insertErr } = await supabase.from("likes").insert({
            user_id: user.id,
            target_id: split.id,
            type: "split",
          });
          if (insertErr) throw insertErr;
        } else {
          const { error: deleteErr } = await supabase
            .from("likes")
            .delete()
            .eq("user_id", user.id)
            .eq("target_id", split.id)
            .eq("type", "split");
          if (deleteErr) throw deleteErr;
        }

        await load();
        clearOptimisticKey(split.id);
      } catch (e) {
        clearOptimisticKey(split.id);
        Alert.alert("Like failed", errorMessageFromUnknown(e));
      }
    },
    [clearOptimisticKey, likedIds, optimistic, session?.user, load]
  );

  const onDownload = useCallback(
    (split: MarketplaceSplit) => {
      const parsed = parseMarketplaceStructureJson(split.structure_json);
      if (!parsed) {
        Alert.alert(
          "Cannot import",
          "This split’s structure_json is missing or invalid. It should include slots with workoutName and exerciseNames or exerciseIds plus exerciseLibrary."
        );
        return;
      }
      const name = `${split.name} (imported)`.slice(0, 80);
      const id = importSplitBundle(name, parsed.exercises, parsed.slots);
      if (id) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Added to Trainer", "Open the Log tab and pick your new split to start using it.");
      }
    },
    [importSplitBundle]
  );

  const subtitle = useMemo(() => {
    if (!configured) {
      return "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment.";
    }
    return "Public splits only: trending (weekly leader) and top 5 all-time — sign in to like or publish from Log.";
  }, [configured]);

  const renderSplitCard = useCallback(
    (split: MarketplaceSplit, compact?: boolean) => {
      const { liked, likes_count } = mergeDisplay(split, likedIds, optimistic);
      const vel = likeVelocityLast7Days(split.id, recentLikes);
      const creator =
        split.creator_display_name != null && split.creator_display_name !== ""
          ? `@${split.creator_display_name}`
          : split.creator_id
            ? "Creator"
            : "Catalog";
      return (
        <View style={[styles.card, compact && styles.cardCompact]}>
          <View style={styles.cardTop}>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {split.name}
              </Text>
              <Text style={styles.cardCreator} numberOfLines={1}>
                {creator}
              </Text>
              {split.description ? (
                <Text style={styles.cardDesc} numberOfLines={compact ? 2 : 3}>
                  {split.description}
                </Text>
              ) : null}
              <View style={styles.likePill}>
                <Ionicons name="heart" size={16} color={colors.fire} />
                <Text style={styles.likePillText}>{likes_count}</Text>
                {vel > 0 ? <Text style={styles.metaSide}> · {vel} this week</Text> : null}
              </View>
            </View>
            <View style={styles.cardActions}>
              <PressableScale
                accessibilityLabel={liked ? "Unlike split" : "Like split"}
                onPress={() => void onToggleLike(split)}
                style={styles.iconBtn}
                hitSlop={10}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={26}
                  color={liked ? colors.fire : colors.textMuted}
                />
              </PressableScale>
            </View>
          </View>
          <PressableScale onPress={() => onDownload(split)} style={styles.downloadBtn}>
            <Ionicons name="download-outline" size={20} color={colors.onAccent} />
            <Text style={styles.downloadBtnText}>Download to my Trainer</Text>
          </PressableScale>
        </View>
      );
    },
    [likedIds, optimistic, recentLikes, onToggleLike, onDownload]
  );

  if (!configured) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>Supabase is not configured.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Marketplace</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {error ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()} accessibilityRole="button">
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {catalogSplits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>
              No splits you can see yet. Publish from the Log tab (with a public account), or ask a friend with a
              public profile to publish one.
            </Text>
          </View>
        ) : trending.length === 0 && allTimeGreats.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>
              Nothing in the curated feed right now. Public profiles with published splits will appear here once they
              earn likes (top 5 all-time, or weekly trending leader’s top 3).
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>Trending Splits</Text>
            <Text style={styles.sectionHint}>
              Top 3 from the public profile that earned the most split likes in the last 7 days (tie-break: highest
              total likes), sorted by weekly velocity then score ÷ age^1.8
            </Text>
            <FlatList
              horizontal
              data={trending}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hRow}
              ListEmptyComponent={
                <Text style={[styles.muted, { paddingVertical: 12, maxWidth: 280 }]}>
                  No weekly leader yet. Split likes from the last 7 days pick which public profile is featured here.
                </Text>
              }
              renderItem={({ item }) => renderSplitCard(item, true)}
            />

            <Text style={[styles.sectionLabel, styles.sectionSpaced]}>All-Time Greats</Text>
            <Text style={styles.sectionHint}>Top 5 public-profile splits by total likes</Text>
            {allTimeGreats.map((s) => (
              <Fragment key={s.id}>{renderSplitCard(s)}</Fragment>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
  },
  banner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  bannerText: {
    color: colors.danger,
    fontSize: 13,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryBtnText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 14,
  },
  empty: {
    paddingVertical: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 4,
  },
  sectionSpaced: {
    marginTop: 20,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 8,
  },
  hRow: {
    gap: 12,
    paddingBottom: 8,
  },
  card: {
    backgroundColor: colors.surface2,
    borderRadius: theme.radii.lg,
    padding: theme.space.md,
    marginBottom: 12,
    ...cardShadow,
  },
  cardCompact: {
    width: 280,
    marginRight: 12,
    marginBottom: 0,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  cardCreator: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "600",
    color: colors.accent,
  },
  likePill: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 4,
  },
  likePillText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },
  metaSide: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: "500",
  },
  cardDesc: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    minWidth: theme.minTouch,
    minHeight: theme.minTouch,
    alignItems: "center",
    justifyContent: "center",
  },
  downloadBtn: {
    marginTop: 14,
    minHeight: theme.minTouch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: 12,
  },
  downloadBtnText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 15,
  },
});
