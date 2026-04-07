import { useMemo } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useWorkoutStore } from "@/context/workout-store";
import { colors } from "@/lib/theme";
import type { SetLog } from "@/lib/types";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { state, deleteSession } = useWorkoutStore();

  const session = useMemo(
    () => state.sessions.find((s) => s.id === sessionId) ?? null,
    [state.sessions, sessionId]
  );

  const grouped = useMemo(() => {
    if (!session) return [];
    const map = new Map<string, SetLog[]>();
    for (const set of session.sets) {
      const key = set.exerciseNameSnapshot;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(set);
    }
    return Array.from(map.entries()).map(([name, sets]) => ({
      name,
      sets: sets.sort((a, b) => a.setIndex - b.setIndex),
    }));
  }, [session]);

  if (!session) {
    return (
      <View style={styles.miss}>
        <Text style={styles.missText}>This workout is no longer saved.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const totalVolume = session.sets.reduce((acc, s) => acc + s.reps * s.weight, 0);

  const onDelete = () => {
    Alert.alert(
      "Delete workout?",
      "This removes the whole session from your history. You cannot undo this.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSession(session.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.hero}>
        <Text style={styles.date}>{session.localDate}</Text>
        <Text style={styles.workoutTitle}>{session.workoutNameSnapshot}</Text>
        <Text style={styles.meta}>{session.splitNameSnapshot}</Text>
        <Text style={styles.meta}>{formatTime(session.completedAt)}</Text>
        <Text style={styles.volume}>Session volume: {Math.round(totalVolume)} lb (reps × weight)</Text>
      </View>

      {grouped.map(({ name, sets }) => (
        <View key={name} style={styles.block}>
          <Text style={styles.exerciseName}>{name}</Text>
          {sets.map((s) => (
            <Text key={`${s.exerciseId}-${s.setIndex}`} style={styles.setLine}>
              Set {s.setIndex} · {s.reps} × {s.weight} lb · RPE {s.rpe}
            </Text>
          ))}
        </View>
      ))}

      <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
        <Text style={styles.deleteText}>Delete this workout log</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: colors.bg,
  },
  miss: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  missText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  backBtn: {
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    color: colors.text,
    fontWeight: "600",
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  date: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  workoutTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 2,
  },
  volume: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
  },
  block: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  setLine: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 4,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  deleteText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "700",
  },
});
