import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { VolumePoint } from "@/lib/exercise-volume";
import { colors } from "@/lib/theme";

const CHART_H = 140;

export function ExerciseVolumeChart({ points, title }: { points: VolumePoint[]; title: string }) {
  const max = useMemo(() => Math.max(1, ...points.map((p) => p.volume)), [points]);

  if (points.length === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.empty}>Log this exercise in at least one workout to see volume.</Text>
      </View>
    );
  }

  const bars = points.map((p) => {
    const h = Math.max(6, (p.volume / max) * CHART_H);
    return (
      <View key={p.sessionId} style={styles.barCol}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { height: h }]} />
        </View>
        <Text style={styles.volText}>{Math.round(p.volume)}</Text>
        <Text style={styles.barLabel} numberOfLines={1}>
          {p.label}
        </Text>
      </View>
    );
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.chartTitle}>{title}</Text>
      <Text style={styles.unit}>Total lbs moved per session (reps × weight)</Text>
      {points.length > 6 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {bars}
        </ScrollView>
      ) : (
        <View style={styles.row}>{bars}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  unit: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 12,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 6,
    flexWrap: "wrap",
  },
  barCol: {
    alignItems: "center",
    width: 52,
    marginBottom: 4,
  },
  barTrack: {
    width: "100%",
    height: CHART_H,
    backgroundColor: colors.surface2,
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    backgroundColor: colors.chartBar,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  volText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 9,
    marginTop: 2,
    textAlign: "center",
    width: "100%",
  },
});
