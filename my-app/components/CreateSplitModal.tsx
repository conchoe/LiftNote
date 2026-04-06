import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/lib/theme";
import type { Exercise, WorkoutSlot } from "@/lib/types";

type SlotDraft = {
  enabled: boolean;
  workoutName: string;
  exerciseIds: string[];
};

function emptySlots(): SlotDraft[] {
  return Array.from({ length: 7 }, () => ({
    enabled: false,
    workoutName: "",
    exerciseIds: [],
  }));
}

export function CreateSplitModal({
  visible,
  onClose,
  exercises,
  onCreate,
  onAddExercise,
}: {
  visible: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onCreate: (name: string, slots: WorkoutSlot[]) => boolean;
  onAddExercise: (name: string) => string | null;
}) {
  const [splitName, setSplitName] = useState("");
  const [slots, setSlots] = useState<SlotDraft[]>(emptySlots);
  const [newExName, setNewExName] = useState("");
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);

  const reset = () => {
    setSplitName("");
    setSlots(emptySlots());
    setNewExName("");
    setPickerSlot(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleExercise = (slotIndex: number, exerciseId: string) => {
    setSlots((prev) =>
      prev.map((s, i) => {
        if (i !== slotIndex) return s;
        const has = s.exerciseIds.includes(exerciseId);
        return {
          ...s,
          exerciseIds: has ? s.exerciseIds.filter((id) => id !== exerciseId) : [...s.exerciseIds, exerciseId],
        };
      })
    );
  };

  const buildWorkoutSlots = (): WorkoutSlot[] => {
    return slots.map((s) => {
      if (!s.enabled) return null;
      return {
        workoutName: s.workoutName.trim(),
        exerciseIds: [...s.exerciseIds],
      };
    });
  };

  const handleSave = () => {
    const ok = onCreate(splitName, buildWorkoutSlots());
    if (ok) {
      reset();
      onClose();
    }
  };

  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} hitSlop={10}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>New split</Text>
          <TouchableOpacity onPress={handleSave} hitSlop={10}>
            <Text style={styles.save}>Save</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.label}>Split name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Push / Pull / Legs"
            placeholderTextColor={colors.textMuted}
            value={splitName}
            onChangeText={setSplitName}
          />

          <Text style={styles.sectionTitle}>7-day template</Text>
          <Text style={styles.sectionSub}>Leave days off as rest. Only filled days are saved.</Text>

          {slots.map((slot, index) => (
            <View key={index} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>Day {index + 1}</Text>
                <View style={styles.dayToggle}>
                  <Text style={styles.toggleLabel}>Workout</Text>
                  <Switch
                    value={slot.enabled}
                    onValueChange={(v) =>
                      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, enabled: v } : s)))
                    }
                    trackColor={{ false: colors.border, true: colors.accentMuted }}
                    thumbColor={slot.enabled ? colors.accent : "#f4f4f5"}
                  />
                </View>
              </View>
              {slot.enabled ? (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Workout name"
                    placeholderTextColor={colors.textMuted}
                    value={slot.workoutName}
                    onChangeText={(t) =>
                      setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, workoutName: t } : s)))
                    }
                  />
                  <View style={styles.chips}>
                    {slot.exerciseIds.map((id) => (
                      <View key={id} style={styles.chip}>
                        <Text style={styles.chipText}>{exerciseById.get(id)?.name ?? id}</Text>
                        <TouchableOpacity
                          onPress={() =>
                            setSlots((prev) =>
                              prev.map((s, i) =>
                                i === index
                                  ? { ...s, exerciseIds: s.exerciseIds.filter((x) => x !== id) }
                                  : s
                              )
                            )
                          }
                        >
                          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <TouchableOpacity style={styles.pickBtn} onPress={() => setPickerSlot(index)}>
                    <Ionicons name="barbell-outline" size={20} color={colors.accent} />
                    <Text style={styles.pickBtnText}>Add exercises from library</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.restHint}>Rest day</Text>
              )}
            </View>
          ))}

          <View style={styles.addExBlock}>
            <Text style={styles.label}>Quick add exercise to library</Text>
            <View style={styles.addExRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="New exercise name"
                placeholderTextColor={colors.textMuted}
                value={newExName}
                onChangeText={setNewExName}
              />
              <TouchableOpacity
                style={styles.addExBtn}
                onPress={() => {
                  const id = onAddExercise(newExName);
                  if (id) setNewExName("");
                }}
              >
                <Text style={styles.addExBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Modal visible={pickerSlot !== null} transparent animationType="fade">
          <View style={styles.pickerBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerSlot(null)} />
            <View style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>Tap to toggle</Text>
              <ScrollView>
                {exercises.length === 0 ? (
                  <Text style={styles.emptyLib}>No exercises yet. Add one below the day cards.</Text>
                ) : (
                  exercises.map((e) => {
                    const on = pickerSlot !== null && slots[pickerSlot].exerciseIds.includes(e.id);
                    return (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.pickerRow, on && styles.pickerRowOn]}
                        onPress={() => pickerSlot !== null && toggleExercise(pickerSlot, e.id)}
                      >
                        <Text style={styles.pickerRowText}>{e.name}</Text>
                        {on ? <Ionicons name="checkmark-circle" size={22} color={colors.accent} /> : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
              <TouchableOpacity style={styles.pickerDone} onPress={() => setPickerSlot(null)}>
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 52,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancel: { color: colors.textMuted, fontSize: 16 },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  save: { color: colors.accent, fontSize: 16, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 48 },
  label: { color: colors.textMuted, fontSize: 13, marginBottom: 6 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 20 },
  sectionSub: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 10,
  },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayTitle: { color: colors.text, fontSize: 16, fontWeight: "700" },
  dayToggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { color: colors.textMuted, fontSize: 13 },
  restHint: { color: colors.textMuted, fontStyle: "italic", paddingVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surface2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { color: colors.text, fontSize: 13 },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  pickBtnText: { color: colors.accent, fontSize: 15, fontWeight: "600" },
  addExBlock: { marginTop: 8 },
  addExRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  addExBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addExBtnText: { color: colors.onAccent, fontWeight: "700" },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    maxHeight: "70%",
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
  },
  pickerTitle: { color: colors.text, fontSize: 16, fontWeight: "700", marginBottom: 10 },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    backgroundColor: colors.surface2,
  },
  pickerRowOn: { borderWidth: 1, borderColor: colors.accent },
  pickerRowText: { color: colors.text, fontSize: 16 },
  pickerDone: {
    marginTop: 12,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  pickerDoneText: { color: colors.onAccent, fontWeight: "700", fontSize: 16 },
  emptyLib: { color: colors.textMuted, paddingVertical: 12 },
});
