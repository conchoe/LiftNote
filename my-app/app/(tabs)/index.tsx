import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";

import { PressableScale } from "@/components/PressableScale";

import { CreateSplitModal } from "@/components/CreateSplitModal";
import { ExerciseGroupList } from "@/components/ExerciseGroupList";
import { useAuth } from "@/context/auth-context";
import { EditSplitModal } from "@/components/EditSplitModal";
import { ExerciseLogModal } from "@/components/ExerciseLogModal";
import { WorkoutSavedBanner } from "@/components/WorkoutSavedBanner";
import { useWorkoutStore } from "@/context/workout-store";
import {
  STARTER_CATALOG_SIZE,
  countStarterExercises,
  splitStarterAndCustom,
} from "@/lib/exercise-library";
import { publishSplitToMarketplace } from "@/lib/publish-split";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Exercise, Split } from "@/lib/types";
import { cardShadow, colors, theme } from "@/lib/theme";

export default function LogWorkoutScreen() {
  const { session } = useAuth();
  const {
    ready,
    state,
    addExercise,
    updateExerciseName,
    createSplit,
    replaceSplitTemplate,
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
  const [editSplitOpen, setEditSplitOpen] = useState(false);
  const [publishingSplitId, setPublishingSplitId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);

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

  const handlePublishSplit = useCallback(
    async (sp: Split) => {
      if (!isSupabaseConfigured() || !supabase) {
        Alert.alert("Supabase", "Configure Supabase in your environment to publish splits.");
        return;
      }
      const uid = session?.user?.id;
      if (!uid) {
        Alert.alert("Sign in", "Log in to publish a split to the marketplace.");
        return;
      }
      const { data: prof, error: pe } = await supabase.from("profiles").select("is_private").eq("id", uid).maybeSingle();
      if (pe) {
        Alert.alert("Profile", pe.message);
        return;
      }
      if (prof?.is_private !== false) {
        Alert.alert(
          "Public profile required",
          "Turn off private mode on the Account tab, then publish again. The marketplace only lists splits from public profiles."
        );
        return;
      }
      setPublishingSplitId(sp.id);
      try {
        const r = await publishSplitToMarketplace(supabase, uid, sp, state.exercises);
        if (!r.ok) {
          Alert.alert("Could not publish", r.message);
          return;
        }
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Published",
          "Your split is in Supabase. It appears on the marketplace when it ranks in the top 5 by likes or when your profile leads weekly likes (top 3 trending)."
        );
      } finally {
        setPublishingSplitId(null);
      }
    },
    [session?.user?.id, state.exercises]
  );

  const { starter: starterGroups, custom: customGroups } = useMemo(
    () => splitStarterAndCustom(state.exercises),
    [state.exercises]
  );
  const starterCount = useMemo(() => countStarterExercises(state.exercises), [state.exercises]);

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
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const renderLibrary = () => {
    const n = state.exercises.length;
    const customN = customGroups[0]?.items.length ?? 0;
    const renderLibRow = (e: Exercise) => (
      <View style={styles.libRow}>
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
            <TouchableOpacity
              onPress={() => {
                setRenameExerciseId(e.id);
                setRenameExerciseText(e.name);
              }}
            >
              <Text style={styles.link}>Rename</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
    return (
      <View style={styles.card}>
        <Pressable
          onPress={() => setLibraryOpen((o) => !o)}
          style={({ pressed }) => [styles.libHeaderRow, pressed && styles.libHeaderPressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: libraryOpen }}
        >
          <View style={styles.libHeaderTextCol}>
            <Text style={styles.cardTitle}>Exercise library</Text>
            <Text style={styles.libHintOnHeader}>
              {n} total · includes starter set ({starterCount || STARTER_CATALOG_SIZE} moves) ·{" "}
              {libraryOpen ? "Tap to hide" : "Tap to show"}
            </Text>
          </View>
          <Ionicons name={libraryOpen ? "chevron-up" : "chevron-down"} size={26} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.cardSub}>
          Browse the starter set by body part below, or add your own—custom moves appear in Added by you.
        </Text>
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
        {libraryOpen ? (
          <View style={styles.libScrollBody}>
            {starterGroups.length > 0 ? (
              <View style={styles.libBlock}>
                <View style={styles.starterPillRow}>
                  <Ionicons name="library-outline" size={20} color={colors.accent} />
                  <Text style={styles.starterPillText}>Starter set</Text>
                  <Text style={styles.starterPillMeta}>
                    {starterCount} move{starterCount === 1 ? "" : "s"} · by muscle group
                  </Text>
                </View>
                <ExerciseGroupList
                  groups={starterGroups}
                  collapseSections={false}
                  renderRow={renderLibRow}
                />
              </View>
            ) : null}
            {customGroups.length > 0 ? (
              <View style={[styles.libBlock, styles.libBlockCustom]}>
                <View style={styles.starterPillRow}>
                  <Ionicons name="person-outline" size={20} color={colors.accentEmphasis} />
                  <Text style={styles.starterPillText}>Added by you</Text>
                  <Text style={styles.starterPillMeta}>
                    {customN} custom move{customN === 1 ? "" : "s"}
                  </Text>
                </View>
                <ExerciseGroupList
                  groups={customGroups}
                  collapseSections={false}
                  renderRow={renderLibRow}
                />
              </View>
            ) : null}
            {starterGroups.length === 0 && customGroups.length === 0 ? (
              <Text style={styles.muted}>
                No exercises in your library yet. Use the field above to add one, or create a new profile to load the{" "}
                {STARTER_CATALOG_SIZE}-move starter set.
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

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
              {isSupabaseConfigured() && supabase ? (
                <TouchableOpacity
                  style={styles.publishBtn}
                  onPress={() => void handlePublishSplit(sp)}
                  disabled={publishingSplitId === sp.id}
                  accessibilityRole="button"
                  accessibilityLabel="Publish split to marketplace"
                >
                  {publishingSplitId === sp.id ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
                      <Text style={styles.publishBtnText}>Publish to marketplace</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
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
      <TouchableOpacity style={styles.editSplitBtn} onPress={() => setEditSplitOpen(true)} accessibilityRole="button">
        <Ionicons name="create-outline" size={18} color={colors.onAccent} />
        <Text style={styles.editSplitBtnText}>Edit split layout</Text>
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
            <ScrollView
              contentContainerStyle={styles.scrollSlot}
              keyboardShouldPersistTaps="handled"
            >
              {splitHeader(
                `${activeSlot?.workoutName ?? "Workout"} · Day ${state.activeWorkoutSlotIndex + 1}`
              )}
              <Text style={styles.sectionLabel}>Exercises</Text>
              <Text style={styles.sectionSub}>Tap a lift to log sets. Save when you are finished.</Text>
              <View style={styles.exerciseGrid}>
                {activeSlot?.exerciseIds.map((exerciseId) => {
                  const ex = state.exercises.find((e) => e.id === exerciseId);
                  const rows = state.draftByExerciseId[exerciseId] ?? [];
                  const filled = rows.filter((r) => r.reps.trim() && r.weight.trim() && r.rpe.trim()).length;
                  return (
                    <PressableScale
                      key={exerciseId}
                      onPress={() => openLogModal(exerciseId)}
                      style={styles.exerciseBox}
                      accessibilityLabel={ex?.name ?? "Exercise"}
                    >
                      <Text style={styles.exerciseBoxTitle}>{ex?.name ?? "Exercise"}</Text>
                      <Text style={styles.exerciseBoxMeta}>
                        {filled}/{rows.length} sets ready
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>
            <SafeAreaView style={styles.bottomBar} edges={["bottom"]}>
              <View style={styles.bottomActionRow}>
                <PressableScale
                  onPress={clearWorkoutSlotSelection}
                  style={styles.bottomSecondary}
                  accessibilityLabel="Change workout day"
                >
                  <Ionicons name="calendar-outline" size={22} color={colors.accent} />
                  <Text style={styles.bottomSecondaryText}>Change day</Text>
                </PressableScale>
                <PressableScale
                  onPress={handleSaveWorkout}
                  style={styles.bottomPrimary}
                  accessibilityLabel="Save workout"
                >
                  <Ionicons name="checkmark-circle" size={24} color={colors.onAccent} />
                  <Text style={styles.bottomPrimaryText}>Save workout</Text>
                </PressableScale>
              </View>
            </SafeAreaView>
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
      <EditSplitModal
        visible={editSplitOpen}
        onClose={() => setEditSplitOpen(false)}
        split={activeSplit}
        exercises={state.exercises}
        onAddExercise={(name) => addExercise(name)}
        onSave={(splitId, name, slots) => replaceSplitTemplate(splitId, name, slots)}
      />
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
  scrollSlot: {
    padding: 16,
    paddingBottom: 16,
  },
  sectionSub: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
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
  libHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: theme.minTouch,
    marginBottom: 4,
  },
  libHeaderPressed: { opacity: 0.88 },
  libHeaderTextCol: { flex: 1, paddingRight: 8 },
  libHintOnHeader: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  libScrollBody: { marginTop: 4, gap: 0 },
  libBlock: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  libBlockCustom: { marginTop: 8 },
  starterPillRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  starterPillText: { color: colors.text, fontSize: 16, fontWeight: "800" },
  starterPillMeta: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
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
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  publishBtnText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "700",
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
  editSplitBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.accent,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editSplitBtnText: {
    color: colors.onAccent,
    fontWeight: "700",
    fontSize: 14,
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
    backgroundColor: colors.surface2,
    borderRadius: theme.radii.lg,
    padding: theme.space.md,
    minHeight: 100,
    ...cardShadow,
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
  bottomBar: {
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.xs,
  },
  bottomSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radii.md,
    backgroundColor: colors.surface2,
    minHeight: theme.minTouch,
  },
  bottomSecondaryText: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  bottomPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: theme.radii.lg,
    minHeight: 52,
  },
  bottomPrimaryText: {
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
