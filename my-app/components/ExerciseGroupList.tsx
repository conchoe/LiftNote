import { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { GroupedExercises } from "@/lib/exercise-library";
import type { Exercise } from "@/lib/types";
import { colors, theme } from "@/lib/theme";

type Props = {
  groups: GroupedExercises;
  /** `true` = show only category headers until each section is expanded (split pickers). */
  collapseSections: boolean;
  renderRow: (e: Exercise) => React.ReactNode;
  emptyText?: string;
};

export function ExerciseGroupList({ groups, collapseSections, renderRow, emptyText }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = useCallback((key: string) => {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (groups.length === 0) {
    return <Text style={styles.empty}>{emptyText ?? "No exercises in your library yet."}</Text>;
  }

  return (
    <View>
      {groups.map((g, i) => {
        const isOpen = open[g.key] ?? false;
        const showItems = !collapseSections || isOpen;
        return (
          <View key={g.key} style={i > 0 ? styles.section : styles.sectionFirst}>
            {collapseSections ? (
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggle(g.key)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={styles.sectionLabel}>{g.label}</Text>
                <Text style={styles.count}>({g.items.length})</Text>
                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.sectionHeaderStatic} accessibilityRole="text">
                <Text style={styles.sectionLabel}>{g.label}</Text>
                <Text style={styles.countInline}>({g.items.length})</Text>
              </View>
            )}
            {showItems
              ? g.items.map((e) => (
                  <View key={e.id} style={styles.rowWrap}>
                    {renderRow(e)}
                  </View>
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 12 },
  sectionFirst: { marginTop: 0 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: theme.minTouch,
    paddingVertical: 4,
    gap: 6,
  },
  sectionHeaderStatic: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    paddingTop: 4,
  },
  sectionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
  count: { color: colors.textMuted, fontSize: 14, fontWeight: "600" },
  countInline: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  rowWrap: { marginBottom: 0 },
  empty: { color: colors.textMuted, fontSize: 14, paddingVertical: 8, lineHeight: 20 },
});
