import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { getOutgoingFriendStatus, sendFollowRequest } from "@/lib/social";
import { errorMessageFromUnknown } from "@/lib/error";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type ProfileHit = { id: string; username: string };
type FriendRow = { id: string; user_id: string; friend_id: string; status: string };
type FriendIncoming = FriendRow & { requesterUsername: string };
type FollowBackEntry = { userId: string; username: string };
type FeedItem = {
  id: string;
  user_id: string;
  workout_name: string | null;
  split_name: string | null;
  volume_total: number;
  likes_count: number;
  created_at: string;
  actor_username?: string;
};

function activityRest(item: FeedItem): string {
  const wn = item.workout_name ?? "a workout";
  const sn = item.split_name ? ` (${item.split_name})` : "";
  const vol = item.volume_total > 0 ? ` — ${item.volume_total.toLocaleString()} lb volume` : "";
  return ` finished ${wn}${sn}${vol}.`;
}

export default function CommunityScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const configured = isSupabaseConfigured();

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProfileHit[]>([]);
  const [searching, setSearching] = useState(false);

  const [incoming, setIncoming] = useState<FriendIncoming[]>([]);
  const [acceptedAwaitingFollowBack, setAcceptedAwaitingFollowBack] = useState<FollowBackEntry[]>([]);
  const followBackRef = useRef<FollowBackEntry[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [likedWorkouts, setLikedWorkouts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    followBackRef.current = acceptedAwaitingFollowBack;
  }, [acceptedAwaitingFollowBack]);

  const pruneFollowBack = useCallback(async () => {
    if (!supabase || !userId) return;
    const fb = followBackRef.current;
    if (fb.length === 0) return;
    const kept: FollowBackEntry[] = [];
    for (const x of fb) {
      const st = await getOutgoingFriendStatus(supabase, userId, x.userId);
      if (st == null) kept.push(x);
    }
    setAcceptedAwaitingFollowBack(kept);
  }, [userId]);

  const loadFriendsAndFeed = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: fr, error: frErr } = await supabase
        .from("friends")
        .select("id, user_id, friend_id, status")
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

      if (frErr) {
        Alert.alert("Friends", frErr.message);
        setIncoming([]);
        setFeed([]);
        setLikedWorkouts(new Set());
        return;
      }

      const rows = (fr ?? []) as FriendRow[];
      const pendingIncoming = rows.filter((r) => r.status === "pending" && r.friend_id === userId);
      if (pendingIncoming.length === 0) {
        setIncoming([]);
      } else {
        const fromIds = pendingIncoming.map((r) => r.user_id);
        const { data: reqProfs } = await supabase.from("profiles").select("id, username").in("id", fromIds);
        const nameById = new Map(
          (reqProfs ?? []).map((p) => [p.id as string, String((p as { username?: string }).username ?? "user")])
        );
        setIncoming(
          pendingIncoming.map((r) => ({
            ...r,
            requesterUsername: nameById.get(r.user_id) ?? "Unknown user",
          }))
        );
      }

      const friendIds = new Set<string>();
      for (const r of rows) {
        if (r.status !== "accepted") continue;
        const other = r.user_id === userId ? r.friend_id : r.user_id;
        friendIds.add(other);
      }

      const ids = [...friendIds];
      if (ids.length === 0) {
        setFeed([]);
        setLikedWorkouts(new Set());
        return;
      }

      const { data: logs, error: logErr } = await supabase
        .from("workout_logs")
        .select("id, user_id, workout_name, split_name, volume_total, likes_count, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(40);

      if (logErr) {
        Alert.alert("Feed", logErr.message);
        setFeed([]);
        return;
      }

      const logRows = (logs ?? []) as Omit<FeedItem, "actor_username">[];
      const { data: profs } = await supabase.from("profiles").select("id, username").in("id", ids);
      const nameById = new Map((profs ?? []).map((p) => [p.id as string, p.username as string]));

      const enriched: FeedItem[] = logRows.map((l) => ({
        ...l,
        actor_username: nameById.get(l.user_id),
      }));
      setFeed(enriched);

      const logIds = enriched.map((l) => l.id);
      if (logIds.length === 0) {
        setLikedWorkouts(new Set());
      } else {
        const { data: lk } = await supabase
          .from("likes")
          .select("target_id")
          .eq("user_id", userId)
          .eq("type", "workout")
          .in("target_id", logIds);
        setLikedWorkouts(new Set((lk ?? []).map((x) => x.target_id as string)));
      }
    } finally {
      await pruneFollowBack();
      setLoading(false);
    }
  }, [userId, pruneFollowBack]);

  useEffect(() => {
    if (!configured || !userId) {
      setLoading(false);
      return;
    }
    void loadFriendsAndFeed();
  }, [configured, userId, loadFriendsAndFeed]);

  useEffect(() => {
    const client = supabase;
    if (!client || !configured || !userId) return;
    const ch = client
      .channel("community-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workout_logs" },
        () => void loadFriendsAndFeed()
      )
      .subscribe();
    return () => {
      void client.removeChannel(ch);
    };
  }, [configured, userId, loadFriendsAndFeed]);

  const runSearch = useCallback(async () => {
    const q = query.trim();
    if (!supabase || !userId || q.length < 2) {
      setHits([]);
      return;
    }
    setSearching(true);
    const safe = q.replace(/%/g, "");
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${safe}%`)
      .neq("id", userId)
      .limit(20);
    setSearching(false);
    if (error) {
      Alert.alert("Search", error.message);
      setHits([]);
      return;
    }
    setHits((data ?? []) as ProfileHit[]);
  }, [query, userId]);

  const sendRequest = useCallback(
    async (friendId: string) => {
      if (!supabase || !userId) return;
      const { error } = await supabase.from("friends").insert({
        user_id: userId,
        friend_id: friendId,
        status: "pending",
      });
      if (error) {
        if (error.code === "23505") {
          Alert.alert("Follow", "A request already exists between you and this person.");
        } else {
          Alert.alert("Follow", error.message);
        }
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert("Request sent", "They can accept from their Community tab.");
      void loadFriendsAndFeed();
    },
    [userId, loadFriendsAndFeed]
  );

  const acceptRequest = useCallback(
    async (row: FriendIncoming) => {
      if (!supabase || !userId) return;
      const { error } = await supabase.from("friends").update({ status: "accepted" }).eq("id", row.id);
      if (error) {
        Alert.alert("Accept", error.message);
        return;
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadFriendsAndFeed();
      const st = await getOutgoingFriendStatus(supabase, userId, row.user_id);
      if (st == null) {
        setAcceptedAwaitingFollowBack((prev) =>
          prev.some((p) => p.userId === row.user_id)
            ? prev
            : [...prev, { userId: row.user_id, username: row.requesterUsername }]
        );
      }
    },
    [loadFriendsAndFeed, userId]
  );

  const declineRequest = useCallback(
    async (row: FriendIncoming) => {
      if (!supabase) return;
      const { error } = await supabase.from("friends").delete().eq("id", row.id);
      if (error) {
        Alert.alert("Decline", error.message);
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      void loadFriendsAndFeed();
    },
    [loadFriendsAndFeed]
  );

  const onFollowBack = useCallback(
    async (entry: FollowBackEntry) => {
      if (!supabase || !userId) return;
      const r = await sendFollowRequest(supabase, userId, entry.userId);
      if (!r.ok) {
        if (r.code === "23505") {
          Alert.alert("Follow", "A request already exists between you and this person.");
        } else {
          Alert.alert("Follow", r.message);
        }
        return;
      }
      setAcceptedAwaitingFollowBack((prev) => prev.filter((p) => p.userId !== entry.userId));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Request sent", `@${entry.username} will see your follow request.`);
      void loadFriendsAndFeed();
    },
    [loadFriendsAndFeed, userId]
  );

  const openProfile = useCallback((uid: string) => {
    router.push(`/(tabs)/account/user/${uid}`);
  }, []);

  const toggleWorkoutLike = useCallback(
    async (item: FeedItem) => {
      if (!supabase || !userId) {
        Alert.alert("Sign in", "Log in to like workouts.");
        return;
      }
      const liked = likedWorkouts.has(item.id);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      try {
        if (liked) {
          const { error } = await supabase
            .from("likes")
            .delete()
            .eq("user_id", userId)
            .eq("target_id", item.id)
            .eq("type", "workout");
          if (error) throw error;
          setLikedWorkouts((prev) => {
            const n = new Set(prev);
            n.delete(item.id);
            return n;
          });
        } else {
          const { error } = await supabase.from("likes").insert({
            user_id: userId,
            target_id: item.id,
            type: "workout",
          });
          if (error) throw error;
          setLikedWorkouts((prev) => new Set(prev).add(item.id));
        }
        void loadFriendsAndFeed();
      } catch (e) {
        Alert.alert("Like failed", errorMessageFromUnknown(e));
      }
    },
    [userId, likedWorkouts, loadFriendsAndFeed]
  );

  const subtitle = useMemo(() => {
    if (!configured) return "Configure Supabase to use the community feed.";
    if (!userId) return "Sign in to follow friends and see their workouts.";
    return "Friend activity and requests.";
  }, [configured, userId]);

  if (!configured) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header title="Community" subtitle={subtitle} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <Header title="Community" subtitle={subtitle} />
        <View style={styles.centered}>
          <Text style={styles.muted}>Sign in on the Account tab to use Community.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <Header title="Community" subtitle={subtitle} />

      <View style={styles.searchBlock}>
        <Text style={styles.label}>Find people by username</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            placeholder="Search…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.searchBtn} onPress={() => void runSearch()}>
            <Text style={styles.searchBtnText}>{searching ? "…" : "Search"}</Text>
          </TouchableOpacity>
        </View>
        {hits.map((h) => (
          <View key={h.id} style={styles.hitRow}>
            <TouchableOpacity onPress={() => openProfile(h.id)} style={styles.hitNameWrap}>
              <Text style={styles.hitName}>@{h.username}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void sendRequest(h.id)} style={styles.followBtn}>
              <Text style={styles.followBtnText}>Follow</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {incoming.length > 0 ? (
        <View style={styles.incoming}>
          <Text style={styles.sectionTitle}>Follow requests</Text>
          {incoming.map((r) => (
            <View key={r.id} style={styles.reqRow}>
              <TouchableOpacity style={styles.reqTextCol} onPress={() => openProfile(r.user_id)}>
                <Text style={styles.reqUsername}>@{r.requesterUsername}</Text>
                <Text style={styles.reqSub}>Wants to follow you</Text>
              </TouchableOpacity>
              <View style={styles.reqActions}>
                <TouchableOpacity style={styles.declineBtn} onPress={() => void declineRequest(r)}>
                  <Text style={styles.declineBtnText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => void acceptRequest(r)}>
                  <Text style={styles.acceptBtnText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {acceptedAwaitingFollowBack.length > 0 ? (
        <View style={styles.incoming}>
          <Text style={styles.sectionTitle}>Follow back</Text>
          {acceptedAwaitingFollowBack.map((r) => (
            <View key={r.userId} style={styles.reqRow}>
              <View style={styles.reqTextCol}>
                <Text style={styles.reqUsername}>@{r.username}</Text>
                <Text style={styles.reqSub}>Now follows you</Text>
              </View>
              <TouchableOpacity style={styles.followBackBtn} onPress={() => void onFollowBack(r)}>
                <Text style={styles.followBackBtnText}>Follow back</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>No friend activity yet. Follow people above.</Text>}
          renderItem={({ item }) => {
            const liked = likedWorkouts.has(item.id);
            return (
              <View style={styles.feedCard}>
                <View style={styles.feedTop}>
                  <Text style={styles.feedText}>
                    <Text style={styles.feedLink} onPress={() => openProfile(item.user_id)}>
                      {item.actor_username ?? "Someone"}
                    </Text>
                    <Text>{activityRest(item)}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => void toggleWorkoutLike(item)} style={styles.heartWrap}>
                    <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? colors.fire : colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.feedMeta}>
                  {new Date(item.created_at).toLocaleString()} · {item.likes_count} likes
                </Text>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingBottom: 10 },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  subtitle: { marginTop: 6, fontSize: 14, color: colors.textMuted },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  searchBlock: { paddingHorizontal: 20, gap: 8, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "600", color: colors.textMuted, textTransform: "uppercase" },
  searchRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  searchBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBtnText: { color: colors.onAccent, fontWeight: "700" },
  hitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  hitNameWrap: { flex: 1, marginRight: 12, justifyContent: "center" },
  hitName: { fontSize: 16, color: colors.text, fontWeight: "600" },
  followBtn: { backgroundColor: colors.surface2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  followBtnText: { color: colors.accent, fontWeight: "700" },
  incoming: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 8 },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  reqTextCol: { flex: 1, minWidth: 0 },
  reqUsername: { fontSize: 16, fontWeight: "700", color: colors.text },
  reqSub: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  reqActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  declineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  declineBtnText: { color: colors.textMuted, fontWeight: "600", fontSize: 13 },
  acceptBtn: { backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  acceptBtnText: { color: colors.onAccent, fontWeight: "700" },
  followBackBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  followBackBtnText: { color: colors.accent, fontWeight: "700" },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  feedCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  feedTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  feedText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  feedLink: { fontWeight: "700", color: colors.accent },
  heartWrap: { padding: 4 },
  feedMeta: { marginTop: 8, fontSize: 12, color: colors.textMuted },
});
