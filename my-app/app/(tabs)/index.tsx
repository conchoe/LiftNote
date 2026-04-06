import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { CreateSplitModal } from "@/components/CreateSplitModal";
import { ExerciseLogModal } from "@/components/ExerciseLogModal";
import { WorkoutSavedBanner } from "@/components/WorkoutSavedBanner";
import { useWorkoutStore } from "@/context/workout-store";
import { colors } from "@/lib/theme";

export default function LogWorkoutScreen() {
  const {
    ready,
    state,
    addExercise,
    updateExerciseName,
    createSplit,
    updateSplitName,
    enterSplit,
    exitSplit,
    selectWorkoutSlot,
    clearWorkoutSlotSelection,
    updateDraftSet,
    addDraftSet,
    removeDraftSet,
    saveWorkout,
    showSaveBanner,
    dismissSaveBanner,
  } = useWorkoutStore();

  const [createOpen, setCreateOpen] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [renameSplitId, setRenameSplitId] = useState<string | null>(null);
  const [renameSplitText, setRenameSplitText] = useState("");
  const [renameExerciseId, setRenameExerciseId] = useState<string | null>(null);
  const [renameExerciseText, setRenameExerciseText] = useState("");
  const [logExerciseId, setLogExerciseId] = useState<string | null>(null);

  const activeSplit = useMemo(
    () => state.splits.find((s) => s.id === state.activeSplitId) ?? null,
    [state.splits, state.activeSplitId]
  );

  const activeSlot =
    activeSplit && state.activeWorkoutSlotIndex !== null
      ? activeSplit.slots[state.activeWorkoutSlotIndex]
      : null;

  const logExercise = logExerciseId ? state.exercises.find((e) => e.id === logExerciseId) : undefined;
  const logDraftSets = logExerciseId ? state.draftByExerciseId[logExerciseId] ?? [] : [];

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const openLogModal = (exerciseId: string) => setLogExerciseId(exerciseId);

  const handleSaveWorkout = () => {
    const result = saveWorkout();
    if (!result.ok) {
      Alert.alert("Cannot save workout", result.error);
    }
  };

  const renderLibrary = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Exercise library</Text>
      <Text style={styles.cardSub}>Add movements you use across splits. Names can be renamed anytime.</Text>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="New exercise name"
          placeholderTextColor={colors.textMuted}
          value={newExerciseName}
          onChangeText={setNewExerciseName}
        />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            const id = addExercise(newExerciseName);
            if (id) setNewExerciseName("");
          }}
        >
          <Text style={styles.primaryBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      {state.exercises.length === 0 ? (
        <Text style={styles.muted}>No exercises yet. Add a few to build your split.</Text>
      ) : (
        state.exercises.map((e) => (
          <View key={e.id} style={styles.libRow}>
            {renameExerciseId === e.id ? (
              <View style={styles.renameRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={renameExerciseText}
                  onChangeText={setRenameExerciseText}
                  autoFocus
                />
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => {
                    updateExerciseName(e.id, renameExerciseText);
                    setRenameExerciseId(null);
                  }}
                >
                  <Text style={styles.smallBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.smallGhost} onPress={() => setRenameExerciseId(null)}>
                  <Text style={styles.smallGhostText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.libName}>{e.name}</Text>
                <TouchableOpacity onPress={() => {
                  setRenameExerciseId(e.id);
                  setRenameExerciseText(e.name);
                }}>
                  <Text style={styles.link}>Rename</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ))
      )}
    </View>
  );

  if (!state.activeSplitId) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.screenTitle}>Log workout</Text>
          <Text style={styles.screenSub}>
            Pick a split to train, or create one. You will not be able to log sets until a split exists.
          </Text>

          {state.splits.length === 0 ? (
            <View style={styles.banner}>
              <Ionicons name="information-circle" size={22} color={colors.accent} />
              <Text style={styles.bannerText}>Create a split first. It only takes a minute.</Text>
            </View>
          ) : null}

          {renderLibrary()}

          <TouchableOpacity style={styles.createSplitBtn} onPress={() => setCreateOpen(true)}>
            <Ionicons name="add-circle-outline" size={22} color={colors.onAccent} />
            <Text style={styles.createSplitBtnText}>Create new split</Text>
          </TouchableOpacity>

          {state.splits.map((sp) => (
            <View key={sp.id} style={styles.splitCard}>
              {renameSplitId === sp.id ? (
                <View style={styles.renameRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={renameSplitText}
                    onChangeText={setRenameSplitText}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.smallBtn}
                    onPress={() => {
                      updateSplitName(sp.id, renameSplitText);
                      setRenameSplitId(null);
                    }}
                  >
                    <Text style={styles.smallBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.splitHeader}>
                  <Text style={styles.splitName}>{sp.name}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setRenameSplitId(sp.id);
                      setRenameSplitText(sp.name);
                    }}
                  >
                    <Text style={styles.link}>Rename</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.enterBtn} onPress={() => enterSplit(sp.id)}>
                <Text style={styles.enterBtnText}>Continue this split</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.accent} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <CreateSplitModal
          visible={createOpen}
          onClose={() => setCreateOpen(false)}
          exercises={state.exercises}
          onAddExercise={(name) => addExercise(name)}
          onCreate={(name, slots) => createSplit(name, slots) !== null}
        />
      </View>
    );
  }

  if (!activeSplit) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Split data is missing. Please restart the app.</Text>
      </View>
    );
  }

  const splitHeader = (subtitle: string) => (
    <View style={styles.headerBlock}>
      <Text style={styles.screenTitle}>{activeSplit.name}</Text>
      <Text style={styles.screenSub}>{subtitle}</Text>
      <TouchableOpacity
        style={styles.exitRow}
        onPress={exitSplit}
        accessibilityRole="button"
        accessibilityLabel="Exit split"
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons name="log-out-outline" size={20} color={colors.text} />
        <Text style={styles.exitRowText}>Exit split</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <WorkoutSavedBanner visible={showSaveBanner} onDismiss={dismissSaveBanner} />
      <SafeAreaView style={styles.safeMain} edges={["top"]}>
        {state.activeWorkoutSlotIndex === null ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {splitHeader("Choose today’s workout from your split.")}
            <View style={styles.dayGrid}>
              {activeSplit.slots.map((slot, index) => {
                if (!slot) {
                  return (
                    <View key={index} style={[styles.dayBox, styles.dayBoxRest]}>
                      <Text style={styles.dayBoxTitle}>Day {index + 1}</Text>
                      <Text style={styles.dayBoxRestText}>Rest</Text>
                    </View>
                  );
                }
                return (
                  <TouchableOpacity key={index} style={styles.dayBox} onPress={() => selectWorkoutSlot(index)}>
                    <Text style={styles.dayBoxTitle}>Day {index + 1}</Text>
                    <Text style={styles.dayBoxWorkout}>{slot.workoutName}</Text>
                    <Text style={styles.dayBoxMeta}>{slot.exerciseIds.length} exercises</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.slotScreen}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {splitHeader(
                `${activeSlot?.workoutName ?? "Workout"} · Day ${state.activeWorkoutSlotIndex + 1}`
              )}
              <TouchableOpacity style={styles.backDay} onPress={clearWorkoutSlotSelection}>
                <Ionicons name="chevron-back" size={18} color={colors.accent} />
                <Text style={styles.backDayText}>Change workout day</Text>
              </TouchableOpacity>
              <Text style={styles.sectionLabel}>Exercises</Text>
              <View style={styles.exerciseGrid}>
                {activeSlot?.exerciseIds.map((exerciseId) => {
                  const ex = state.exercises.find((e) => e.id === exerciseId);
                  const rows = state.draftByExerciseId[exerciseId] ?? [];
                  const filled = rows.filter((r) => r.reps.trim() && r.weight.trim() && r.rpe.trim()).length;
                  return (
                    <TouchableOpacity key={exerciseId} style={styles.exerciseBox} onPress={() => openLogModal(exerciseId)}>
                      <Text style={styles.exerciseBoxTitle}>{ex?.name ?? "Exercise"}</Text>
                      <Text style={styles.exerciseBoxMeta}>
                        {filled}/{rows.length} sets ready
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={styles.saveWorkoutBtn} onPress={handleSaveWorkout}>
                <Ionicons name="checkmark-done" size={22} color={colors.onAccent} />
                <Text style={styles.saveWorkoutBtnText}>Save workout</Text>
              </TouchableOpacity>
            </ScrollView>
            <ExerciseLogModal
              visible={logExerciseId !== null}
              title={logExercise?.name ?? "Exercise"}
              sets={logDraftSets}
              onClose={() => setLogExerciseId(null)}
              onChangeSet={(index, field, value) => {
                if (!logExerciseId) return;
                updateDraftSet(logExerciseId, index, { [field]: value });
              }}
              onAddSet={() => logExerciseId && addDraftSet(logExerciseId)}
              onRemoveSet={(index) => logExerciseId && removeDraftSet(logExerciseId, index)}
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeMain: {
    flex: 1,
  },
  slotScreen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 6,
  },
  screenSub: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  banner: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  cardSub: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  addRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 16,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
  libRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  libName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    paddingRight: 12,
  },
  link: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 14,
  },
  renameRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flex: 1,
  },
  smallBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  smallBtnText: {
    color: colors.onAccent,
    fontWeight: "700",
  },
  smallGhost: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  smallGhostText: {
    color: colors.textMuted,
    fontWeight: "600",
  },
  createSplitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 16,
  },
  createSplitBtnText: {
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: "800",
  },
  splitCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  splitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  splitName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
  },
  enterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface2,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  enterBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  headerBlock: {
    marginBottom: 8,
  },
  exitRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 10,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 48,
    backgroundColor: colors.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exitRowText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  dayGrid: {
    gap: 10,
  },
  dayBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayBoxRest: {
    opacity: 0.65,
  },
  dayBoxTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  dayBoxWorkout: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  dayBoxMeta: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 14,
  },
  dayBoxRestText: {
    color: colors.textMuted,
    fontSize: 15,
    fontStyle: "italic",
  },
  backDay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  backDayText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  exerciseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  exerciseBox: {
    width: "48%",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 96,
  },
  exerciseBoxTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  exerciseBoxMeta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  saveWorkoutBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveWorkoutBtnText: {
    color: colors.onAccent,
    fontSize: 17,
    fontWeight: "800",
  },
  errorText: {
    color: colors.text,
    textAlign: "center",
    fontSize: 16,
  },
});
