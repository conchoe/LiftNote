import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/context/auth-context";
import { parseWorkoutPayload } from "@/lib/cloud-sync";
import { computePersonalRecords } from "@/lib/pr";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";
import type { Exercise, WorkoutSession } from "@/lib/types";

type ProfileRow = {
  id: string;
  username: string;
  is_private: boolean;
  current_streak: number;
};

type LogRow = {
  id: string;
  workout_name: string | null;
  split_name: string | null;
  volume_total: number;
  created_at: string;
  payload: unknown;
};

export default function UserProfileScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const userId = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";
  const { session } = useAuth();
  const me = session?.user?.id;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setLoading(false);
      setBlocked(true);
      return;
    }
    setLoading(true);
    setBlocked(false);

    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("id, username, is_private, current_streak")
      .eq("id", userId)
      .maybeSingle();

    if (pErr || !prof) {
      setProfile(null);
      setLogs([]);
      setBlocked(true);
      setLoading(false);
      return;
    }

    setProfile(prof as ProfileRow);

    const { data: logData, error: lErr } = await supabase
      .from("workout_logs")
      .select("id, workout_name, split_name, volume_total, created_at, payload")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (lErr) {
      setLogs([]);
    } else {
      setLogs((logData ?? []) as LogRow[]);
    }

    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const { prs, lastSplitLabel } = useMemo(() => {
    const sessions: WorkoutSession[] = [];
    const exerciseById = new Map<string, Exercise>();
    for (const row of logs) {
      const s = parseWorkoutPayload(row.payload);
      if (!s) continue;
      sessions.push(s);
      for (const set of s.sets) {
        if (!exerciseById.has(set.exerciseId)) {
          exerciseById.set(set.exerciseId, { id: set.exerciseId, name: set.exerciseNameSnapshot });
        }
      }
    }
    const exercises = [...exerciseById.values()];
    const prsLocal = computePersonalRecords(sessions, exercises);
    const latest = logs[0];
    let lastSplit = "—";
    if (latest?.split_name?.trim()) lastSplit = latest.split_name.trim();
    else {
      const parsed = latest ? parseWorkoutPayload(latest.payload) : null;
      if (parsed?.splitNameSnapshot?.trim()) lastSplit = parsed.splitNameSnapshot.trim();
    }
    return { prs: prsLocal, lastSplitLabel: lastSplit };
  }, [logs]);

  const recentWorkouts = useMemo(
    () =>
      logs.slice(0, 6).map((r) => ({
        id: r.id,
        title: r.workout_name?.trim() || "Workout",
        split: r.split_name?.trim() || null,
        vol: r.volume_total,
        at: r.created_at,
      })),
    [logs]
  );

  if (!userId) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <Text style={styles.muted}>Missing profile id.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (blocked || !profile) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
        <View style={styles.centered}>
          <Text style={styles.muted}>
            This profile is private or unavailable. Public profiles and people you are connected with stay visible here.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSelf = me === userId;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerBlock}>
          <Text style={styles.handle}>@{profile.username}</Text>
          {isSelf ? <Text style={styles.badge}>You</Text> : null}
          <Text style={styles.metaRow}>
            Streak {profile.current_streak} · {profile.is_private ? "Private" : "Public"}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Last used split</Text>
        <View style={styles.card}>
          <Text style={styles.splitName}>{lastSplitLabel}</Text>
        </View>

        <Text style={styles.sectionTitle}>Recent workouts</Text>
        <View style={styles.card}>
          {recentWorkouts.length === 0 ? (
            <Text style={styles.muted}>No synced workouts yet.</Text>
          ) : (
            recentWorkouts.map((w) => (
              <View key={w.id} style={styles.workRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.workTitle}>{w.title}</Text>
                  {w.split ? <Text style={styles.workSub}>{w.split}</Text> : null}
                </View>
                <Text style={styles.workMeta}>
                  {w.vol > 0 ? `${w.vol.toLocaleString()} lb` : "—"}
                  {"\n"}
                  {new Date(w.at).toLocaleDateString()}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.sectionTitle}>Trophy case</Text>
        <Text style={styles.sectionSub}>Best logged weight per exercise from synced sessions.</Text>
        <View style={styles.card}>
          {prs.length === 0 ? (
            <Text style={styles.muted}>No PR data in synced workouts yet.</Text>
          ) : (
            prs.map((p) => (
              <View key={p.exerciseId} style={styles.prRow}>
                <Text style={styles.prName}>{p.name}</Text>
                <Text style={styles.prVal}>{p.maxWeight} lbs</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  muted: { fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },
  headerBlock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  handle: { fontSize: 26, fontWeight: "800", color: colors.text },
  badge: { marginTop: 6, fontSize: 13, fontWeight: "700", color: colors.accent },
  metaRow: { marginTop: 8, fontSize: 14, color: colors.textMuted },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSub: {
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 10,
    fontSize: 13,
    color: colors.textMuted,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  splitName: { fontSize: 17, fontWeight: "700", color: colors.text },
  workRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  workTitle: { fontSize: 15, fontWeight: "600", color: colors.text },
  workSub: { marginTop: 4, fontSize: 13, color: colors.textMuted },
  workMeta: { fontSize: 12, color: colors.textMuted, textAlign: "right", lineHeight: 18 },
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  prName: { fontSize: 15, color: colors.text, flex: 1 },
  prVal: { fontSize: 15, fontWeight: "700", color: colors.accent },
});
