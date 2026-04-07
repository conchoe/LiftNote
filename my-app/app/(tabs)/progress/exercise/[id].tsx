import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { ExerciseVolumeChart } from "@/components/ExerciseVolumeChart";
import { useWorkoutStore } from "@/context/workout-store";
import { volumeSeriesForExercise } from "@/lib/exercise-volume";
import { colors } from "@/lib/theme";

type Row = {
  sessionDate: string;
  workoutName: string;
  setIndex: number;
  reps: number;
  weight: number;
  rpe: number;
  nameSnapshot: string;
};

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useWorkoutStore();

  const exercise = state.exercises.find((e) => e.id === id);
  const title = exercise?.name ?? "Exercise";

  const volumePoints = useMemo(() => {
    if (!id) return [];
    return volumeSeriesForExercise(state.sessions, id);
  }, [state.sessions, id]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const session of state.sessions) {
      for (const set of session.sets) {
        if (set.exerciseId !== id) continue;
        out.push({
          sessionDate: session.localDate,
          workoutName: session.workoutNameSnapshot,
          setIndex: set.setIndex,
          reps: set.reps,
          weight: set.weight,
          rpe: set.rpe,
          nameSnapshot: set.exerciseNameSnapshot,
        });
      }
    }
    out.sort((a, b) => {
      if (a.sessionDate !== b.sessionDate) return a.sessionDate < b.sessionDate ? 1 : -1;
      return a.setIndex - b.setIndex;
    });
    return out;
  }, [state.sessions, id]);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.headline}>{title}</Text>
      <Text style={styles.sub}>Logged names are preserved even if you rename the exercise later.</Text>
      <ExerciseVolumeChart points={volumePoints} title="Volume over time" />
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sets logged for this exercise yet.</Text>
        </View>
      ) : (
        rows.map((r, idx) => (
          <View key={`${r.sessionDate}-${r.setIndex}-${idx}`} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.date}>{r.sessionDate}</Text>
              <Text style={styles.workout}>{r.workoutName}</Text>
            </View>
            {r.nameSnapshot !== title ? (
              <Text style={styles.snapshot}>Logged as: {r.nameSnapshot}</Text>
            ) : null}
            <Text style={styles.detail}>
              Set {r.setIndex} · {r.reps} reps · {r.weight} lb · RPE {r.rpe}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: colors.bg,
  },
  headline: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  empty: {
    paddingVertical: 24,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 12,
  },
  date: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  workout: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
    textAlign: "right",
  },
  snapshot: {
    color: colors.fire,
    fontSize: 12,
    marginBottom: 4,
  },
  detail: {
    color: colors.text,
    fontSize: 15,
  },
});
