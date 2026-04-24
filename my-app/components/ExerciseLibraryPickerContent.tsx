import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ExerciseGroupList } from "@/components/ExerciseGroupList";
import { countStarterExercises, splitStarterAndCustom } from "@/lib/exercise-library";
import type { Exercise } from "@/lib/types";
import { colors, theme } from "@/lib/theme";

type Props = {
  exercises: Exercise[];
  renderRow: (e: Exercise) => React.ReactNode;
  emptyText?: string;
};

/**
 * Full exercise list for split “add from library” modals: starter set (grouped) + custom adds, all scrollable.
 */
export function ExerciseLibraryPickerContent({ exercises, renderRow, emptyText }: Props) {
  const { starter, custom } = useMemo(() => splitStarterAndCustom(exercises), [exercises]);
  const starterN = useMemo(() => countStarterExercises(exercises), [exercises]);

  if (exercises.length === 0) {
    return <Text style={styles.empty}>{emptyText ?? "No exercises in your library yet."}</Text>;
  }

  return (
    <View>
      {starter.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Starter set</Text>
            <Text style={styles.sectionMeta}>
              {starterN} move{starterN === 1 ? "" : "s"} (built-in catalog)
            </Text>
          </View>
          <Text style={styles.hint}>Tap a row to add it to this workout day. Tap again to remove.</Text>
          <ExerciseGroupList groups={starter} collapseSections={false} renderRow={renderRow} />
        </View>
      ) : null}
      {custom.length > 0 ? (
        <View style={[styles.block, starter.length > 0 ? styles.blockAfterStarter : null]}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Added by you</Text>
            <Text style={styles.sectionMeta}>{custom[0]?.items.length ?? 0} custom</Text>
          </View>
          <ExerciseGroupList groups={custom} collapseSections={false} renderRow={renderRow} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 0, paddingTop: 4 },
  blockAfterStarter: { marginTop: theme.space.md, paddingTop: theme.space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sectionMeta: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 16, marginBottom: 8 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: 10, lineHeight: 20 },
});
