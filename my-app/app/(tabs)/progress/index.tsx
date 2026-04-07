import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { WeeklyBarChart } from "@/components/WeeklyBarChart";
import { useWorkoutStore } from "@/context/workout-store";
import { colors } from "@/lib/theme";
import type { WorkoutSession } from "@/lib/types";

export default function ProgressScreen() {
  const router = useRouter();
  const { ready, state, displayStreak } = useWorkoutStore();
  const [query, setQuery] = useState("");

  const exercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return state.exercises;
    return state.exercises.filter((e) => e.name.toLowerCase().includes(q));
  }, [state.exercises, query]);

  const recentWorkouts = useMemo(() => {
    return [...state.sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 8);
  }, [state.sessions]);

  const formatSessionSummary = (s: WorkoutSession) => {
    const vol = s.sets.reduce((acc, x) => acc + x.reps * x.weight, 0);
    return `${s.sets.length} sets · ${Math.round(vol)} lb volume`;
  };

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const hasHistory = state.sessions.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.streakCard}>
        <Ionicons name="flame" size={56} color={colors.fire} />
        <Text style={styles.streakValue}>{displayStreak}</Text>
        <Text style={styles.streakLabel}>day streak</Text>
        <Text style={styles.streakHint}>Miss 3 days in a row and it resets.</Text>
      </View>

      {hasHistory ? (
        <View style={styles.chartWrap}>
          <WeeklyBarChart sessions={state.sessions} />
        </View>
      ) : (
        <View style={styles.emptyChart}>
          <Text style={styles.emptyText}>No Workouts Saved</Text>
          <Text style={styles.emptySub}>Log a workout on the Log tab to see your chart and history.</Text>
        </View>
      )}

      {hasHistory ? (
        <>
          <Text style={styles.sectionTitle}>Recent workouts</Text>
          <Text style={styles.sectionSub}>Open a session to see every set, or delete a mistaken log.</Text>
          {recentWorkouts.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.row}
              onPress={() => router.push(`/progress/workout/${s.id}`)}
            >
              <View style={styles.recentMain}>
                <Text style={styles.recentTitle}>{s.workoutNameSnapshot}</Text>
                <Text style={styles.recentMeta}>
                  {s.localDate} · {s.splitNameSnapshot}
                </Text>
                <Text style={styles.recentSummary}>{formatSessionSummary(s)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      <Text style={[styles.sectionTitle, hasHistory && styles.sectionSpaced]}>Exercise library</Text>
      <Text style={styles.sectionSub}>Search and open any movement to see every set you have logged.</Text>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.search}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {exercises.length === 0 ? (
        <Text style={styles.none}>No exercises match your search.</Text>
      ) : (
        exercises.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={styles.row}
            onPress={() => router.push(`/progress/exercise/${e.id}`)}
          >
            <Text style={styles.rowTitle}>{e.name}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: colors.bg,
  },
  streakCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakValue: {
    color: colors.text,
    fontSize: 44,
    fontWeight: "800",
    marginTop: 4,
  },
  streakLabel: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: "600",
  },
  streakHint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  chartWrap: {
    marginBottom: 20,
  },
  emptyChart: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    color: colors.text,
    paddingVertical: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    paddingRight: 8,
  },
  none: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 8,
  },
  sectionSpaced: {
    marginTop: 8,
  },
  recentMain: {
    flex: 1,
    paddingRight: 8,
  },
  recentTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  recentMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 2,
  },
  recentSummary: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
