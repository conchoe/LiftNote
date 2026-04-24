import { useCallback } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { PressableScale } from "@/components/PressableScale";
import { cardShadow, theme } from "@/lib/theme";
import type { DraftSet } from "@/lib/types";

const c = theme.colors;

function rowComplete(d: DraftSet): boolean {
  return (
    d.reps.trim().length > 0 && d.weight.trim().length > 0 && d.rpe.trim().length > 0
  );
}

export function ExerciseLogModal({
  visible,
  title,
  sets,
  onClose,
  onChangeSet,
  onAddSet,
  onRemoveSet,
}: {
  visible: boolean;
  title: string;
  sets: DraftSet[];
  onClose: () => void;
  onChangeSet: (index: number, field: keyof DraftSet, value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (index: number) => void;
}) {
  const handleField = useCallback(
    (index: number, field: keyof DraftSet, value: string) => {
      const was = rowComplete(sets[index] ?? { reps: "", weight: "", rpe: "" });
      const next: DraftSet = { ...sets[index]!, [field]: value };
      onChangeSet(index, field, value);
      if (!was && rowComplete(next)) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [onChangeSet, sets]
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="Close modal" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={2}>
              {title}
            </Text>
            <PressableScale
              onPress={onClose}
              hitSlop={12}
              style={styles.closeBtn}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={26} color={c.textMuted} />
            </PressableScale>
          </View>
          <Text style={styles.hint}>
            Reps, weight (lb), RPE 1–10 — row fills in as you go. Light haptic when a set is complete.
          </Text>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {sets.map((row, idx) => (
              <View key={idx} style={styles.setCard}>
                <View style={styles.setTop}>
                  <Text style={styles.setIndex}>Set {idx + 1}</Text>
                  {sets.length > 1 ? (
                    <PressableScale
                      onPress={() => onRemoveSet(idx)}
                      style={styles.trash}
                      hitSlop={8}
                      accessibilityLabel={`Remove set ${idx + 1}`}
                    >
                      <Ionicons name="trash-outline" size={22} color={c.danger} />
                    </PressableScale>
                  ) : (
                    <View style={{ width: 40 }} />
                  )}
                </View>
                <View style={styles.fieldRow}>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Reps</Text>
                    <TextInput
                      style={styles.inputLg}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      value={row.reps}
                      onChangeText={(t) => handleField(idx, "reps", t)}
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <TextInput
                      style={styles.inputLg}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      keyboardType="decimal-pad"
                      value={row.weight}
                      onChangeText={(t) => handleField(idx, "weight", t)}
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>RPE</Text>
                    <TextInput
                      style={styles.inputLg}
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      keyboardType="number-pad"
                      value={row.rpe}
                      onChangeText={(t) => handleField(idx, "rpe", t)}
                    />
                  </View>
                </View>
              </View>
            ))}
            <PressableScale
              onPress={onAddSet}
              style={styles.addBtn}
              accessibilityLabel="Add another set"
            >
              <Ionicons name="add-circle-outline" size={24} color={c.accent} />
              <Text style={styles.addBtnText}>Add set</Text>
            </PressableScale>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backdropPress: {
    flex: 1,
    width: "100%",
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: theme.radii.xl,
    borderTopRightRadius: theme.radii.xl,
    paddingBottom: theme.space.xl,
    maxHeight: "88%" as const,
    ...cardShadow,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xs,
  },
  headerTitle: {
    color: c.text,
    fontSize: theme.type.title2,
    fontWeight: "700",
    flex: 1,
    paddingRight: theme.space.sm,
  },
  closeBtn: {
    padding: theme.space.xs,
  },
  hint: {
    color: c.textMuted,
    fontSize: theme.type.caption,
    paddingHorizontal: theme.space.md,
    marginBottom: theme.space.sm,
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.md,
    gap: theme.space.sm,
  },
  setCard: {
    backgroundColor: c.surface2,
    borderRadius: theme.radii.lg,
    padding: theme.space.md,
    marginBottom: theme.space.sm,
    // Light separation without heavy border
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderHairline,
  },
  setTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.space.sm,
  },
  setIndex: {
    color: c.textSecondary,
    fontSize: theme.type.caption,
    fontWeight: "600",
  },
  trash: {
    padding: theme.space.xs,
  },
  fieldRow: {
    flexDirection: "row",
    gap: theme.space.sm,
  },
  fieldBlock: {
    flex: 1,
  },
  fieldLabel: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputLg: {
    backgroundColor: c.surfaceElevated,
    borderRadius: theme.radii.md,
    color: c.text,
    fontSize: theme.type.setInput,
    fontWeight: "600" as const,
    paddingVertical: 14,
    paddingHorizontal: 10,
    textAlign: "center" as const,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
    marginTop: theme.space.sm,
    paddingVertical: 14,
    minHeight: theme.minTouch,
  },
  addBtnText: {
    color: c.accent,
    fontSize: theme.type.subhead,
    fontWeight: "600",
  },
});
