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
        <Text style={styles.empty}>Log this exercise to see per-set volume.</Text>
      </View>
    );
  }

  const bars = points.map((p) => {
    const h = Math.max(4, (p.volume / max) * CHART_H);
    return (
      <View key={p.key} style={styles.barCol}>
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
      <Text style={styles.unit}>Each bar is one set (reps × weight). Numbers are set order oldest → newest.</Text>
      {points.length > 5 ? (
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
    lineHeight: 18,
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
    gap: 5,
    flexWrap: "wrap",
    paddingRight: 8,
  },
  barCol: {
    alignItems: "center",
    width: 44,
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
    fontSize: 9,
    fontWeight: "700",
    marginTop: 4,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
    width: "100%",
  },
});
