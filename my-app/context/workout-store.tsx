import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState } from "react-native";

import { generateId } from "@/lib/id";
import { getLocalDateString } from "@/lib/date";
import { createDefaultState, loadPersistedState, savePersistedState } from "@/lib/persistence";
import { applyStreakDecayToState } from "@/lib/streak-sync";
import { rebuildLastWeightsFromSessions, rebuildStreakFromSessions } from "@/lib/session-derive";
import { computeStreakAfterWorkout, streakDisplayValue } from "@/lib/streak";
import type { AppStateV1, DraftSet, Exercise, WorkoutSession, WorkoutSlot } from "@/lib/types";
import { validateSetRow } from "@/lib/validation";

type WorkoutStoreValue = {
  ready: boolean;
  state: AppStateV1;
  displayStreak: number;
  addExercise: (name: string) => string | null;
  updateExerciseName: (id: string, name: string) => void;
  createSplit: (name: string, slots: WorkoutSlot[]) => string | null;
  replaceSplitTemplate: (splitId: string, name: string, slots: WorkoutSlot[]) => boolean;
  updateSplitName: (splitId: string, name: string) => void;
  enterSplit: (splitId: string) => void;
  exitSplit: () => void;
  selectWorkoutSlot: (slotIndex: number) => void;
  clearWorkoutSlotSelection: () => void;
  updateDraftSet: (exerciseId: string, setIndex: number, patch: Partial<DraftSet>) => void;
  addDraftSet: (exerciseId: string) => void;
  removeDraftSet: (exerciseId: string, setIndex: number) => void;
  saveWorkout: () => { ok: true } | { ok: false; error: string };
  dismissSaveBanner: () => void;
  showSaveBanner: boolean;
  deleteSession: (sessionId: string) => void;
};

const Ctx = createContext<WorkoutStoreValue | null>(null);

function ensureSevenSlots(slots: WorkoutSlot[]): WorkoutSlot[] {
  const copy = [...slots];
  while (copy.length < 7) copy.push(null);
  return copy.slice(0, 7);
}

function validateWorkoutSlots(
  slotsInput: WorkoutSlot[]
): { ok: true; slots: WorkoutSlot[] } | { ok: false; message: string } {
  const slots = ensureSevenSlots(slotsInput);
  const used = slots.filter(Boolean) as NonNullable<WorkoutSlot>[];
  if (used.length === 0) {
    return { ok: false, message: "Add at least one workout day to your split." };
  }
  for (const slot of used) {
    if (!slot.workoutName.trim()) {
      return { ok: false, message: "Each workout needs a name." };
    }
    if (slot.exerciseIds.length === 0) {
      return { ok: false, message: "Each workout needs at least one exercise." };
    }
  }
  return { ok: true, slots };
}

function buildInitialDraft(
  exerciseIds: string[],
  lastWeightByExerciseId: Record<string, number>
): AppStateV1["draftByExerciseId"] {
  const draft: AppStateV1["draftByExerciseId"] = {};
  for (const id of exerciseIds) {
    const w = lastWeightByExerciseId[id];
    draft[id] = [
      {
        reps: "",
        weight: w !== undefined ? String(w) : "",
        rpe: "",
      },
    ];
  }
  return draft;
}

export function WorkoutStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppStateV1 | null>(null);
  const stateRef = useRef<AppStateV1 | null>(null);
  const [ready, setReady] = useState(false);
  const [showSaveBanner, setShowSaveBanner] = useState(false);

  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadPersistedState();
        if (!cancelled) {
          setState(loaded);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          Alert.alert("Storage error", "Could not load saved data. Starting fresh.");
          setState(createDefaultState());
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !state) return;
    const t = setTimeout(() => {
      const attempt = () => {
        const latest = stateRef.current;
        if (!latest) return Promise.resolve();
        return savePersistedState(latest);
      };
      attempt()
        .catch(() => new Promise((r) => setTimeout(r, 250)).then(attempt))
        .catch((err) => {
          console.error("AsyncStorage save error:", err);
          Alert.alert(
            "Storage error",
            "Could not save your data after retrying. If you are on web, disable private browsing or clear site data and try again."
          );
        });
    }, 450);
    return () => clearTimeout(t);
  }, [state, ready]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setState((prev) => (prev ? applyStreakDecayToState(prev) : prev));
      }
    });
    return () => sub.remove();
  }, []);

  const setAndDecay = useCallback((updater: (s: AppStateV1) => AppStateV1) => {
    setState((prev) => {
      if (!prev) return prev;
      return applyStreakDecayToState(updater(prev));
    });
  }, []);

  const displayStreak = useMemo(() => {
    if (!state) return 0;
    return streakDisplayValue(state.streak, state.lastWorkoutDate);
  }, [state]);

  const addExercise = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Invalid name", "Exercise name cannot be empty.");
      return null;
    }
    const id = generateId();
    setAndDecay((s) => ({
      ...s,
      exercises: [...s.exercises, { id, name: trimmed }],
    }));
    return id;
  }, [setAndDecay]);

  const updateExerciseName = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        Alert.alert("Invalid name", "Exercise name cannot be empty.");
        return;
      }
      setAndDecay((s) => ({
        ...s,
        exercises: s.exercises.map((e) => (e.id === id ? { ...e, name: trimmed } : e)),
      }));
    },
    [setAndDecay]
  );

  const createSplit = useCallback(
    (name: string, slotsInput: WorkoutSlot[]) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        Alert.alert("Invalid split", "Split name cannot be empty.");
        return null;
      }
      const v = validateWorkoutSlots(slotsInput);
      if (!v.ok) {
        Alert.alert("Invalid split", v.message);
        return null;
      }
      const id = generateId();
      setAndDecay((s) => ({
        ...s,
        splits: [...s.splits, { id, name: trimmedName, slots: v.slots }],
      }));
      return id;
    },
    [setAndDecay]
  );

  const replaceSplitTemplate = useCallback(
    (splitId: string, name: string, slotsInput: WorkoutSlot[]) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        Alert.alert("Invalid split", "Split name cannot be empty.");
        return false;
      }
      const v = validateWorkoutSlots(slotsInput);
      if (!v.ok) {
        Alert.alert("Invalid split", v.message);
        return false;
      }
      setAndDecay((s) => {
        if (!s.splits.some((sp) => sp.id === splitId)) return s;
        const nextSplits = s.splits.map((sp) =>
          sp.id === splitId ? { ...sp, name: trimmedName, slots: v.slots } : sp
        );
        let activeWorkoutSlotIndex = s.activeWorkoutSlotIndex;
        let draftByExerciseId = s.draftByExerciseId;
        if (s.activeSplitId === splitId && s.activeWorkoutSlotIndex !== null) {
          const slot = v.slots[s.activeWorkoutSlotIndex];
          if (!slot) {
            activeWorkoutSlotIndex = null;
            draftByExerciseId = {};
          } else {
            draftByExerciseId = buildInitialDraft(slot.exerciseIds, s.lastWeightByExerciseId);
          }
        }
        return {
          ...s,
          splits: nextSplits,
          activeWorkoutSlotIndex,
          draftByExerciseId,
        };
      });
      return true;
    },
    [setAndDecay]
  );

  const updateSplitName = useCallback(
    (splitId: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        Alert.alert("Invalid name", "Split name cannot be empty.");
        return;
      }
      setAndDecay((s) => ({
        ...s,
        splits: s.splits.map((sp) => (sp.id === splitId ? { ...sp, name: trimmed } : sp)),
      }));
    },
    [setAndDecay]
  );

  const enterSplit = useCallback(
    (splitId: string) => {
      setAndDecay((s) => {
        if (!s.splits.some((x) => x.id === splitId)) return s;
        return {
          ...s,
          activeSplitId: splitId,
          activeWorkoutSlotIndex: null,
          draftByExerciseId: {},
        };
      });
    },
    [setAndDecay]
  );

  const exitSplit = useCallback(() => {
    setAndDecay((s) => ({
      ...s,
      activeSplitId: null,
      activeWorkoutSlotIndex: null,
      draftByExerciseId: {},
    }));
  }, [setAndDecay]);

  const selectWorkoutSlot = useCallback(
    (slotIndex: number) => {
      setAndDecay((s) => {
        if (!s.activeSplitId) return s;
        const split = s.splits.find((x) => x.id === s.activeSplitId);
        if (!split) return { ...s, activeSplitId: null, activeWorkoutSlotIndex: null, draftByExerciseId: {} };
        const slot = split.slots[slotIndex];
        if (!slot) return s;
        const draft = buildInitialDraft(slot.exerciseIds, s.lastWeightByExerciseId);
        return {
          ...s,
          activeWorkoutSlotIndex: slotIndex,
          draftByExerciseId: draft,
        };
      });
    },
    [setAndDecay]
  );

  const clearWorkoutSlotSelection = useCallback(() => {
    setAndDecay((s) => ({
      ...s,
      activeWorkoutSlotIndex: null,
      draftByExerciseId: {},
    }));
  }, [setAndDecay]);

  const updateDraftSet = useCallback(
    (exerciseId: string, setIndex: number, patch: Partial<DraftSet>) => {
      setState((prev) => {
        if (!prev) return prev;
        const rows = prev.draftByExerciseId[exerciseId];
        if (!rows || !rows[setIndex]) return prev;
        const nextRows = rows.map((row, i) => (i === setIndex ? { ...row, ...patch } : row));
        return { ...prev, draftByExerciseId: { ...prev.draftByExerciseId, [exerciseId]: nextRows } };
      });
    },
    []
  );

  const addDraftSet = useCallback((exerciseId: string) => {
    setState((prev) => {
      if (!prev) return prev;
      const rows = prev.draftByExerciseId[exerciseId] ?? [];
      const last = rows[rows.length - 1];
      const lastWeight = last?.weight.trim() || String(prev.lastWeightByExerciseId[exerciseId] ?? "");
      const nextRows = [
        ...rows,
        { reps: "", weight: lastWeight, rpe: "" },
      ];
      return { ...prev, draftByExerciseId: { ...prev.draftByExerciseId, [exerciseId]: nextRows } };
    });
  }, []);

  const removeDraftSet = useCallback((exerciseId: string, setIndex: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const rows = prev.draftByExerciseId[exerciseId];
      if (!rows || rows.length <= 1) return prev;
      const nextRows = rows.filter((_, i) => i !== setIndex);
      return { ...prev, draftByExerciseId: { ...prev.draftByExerciseId, [exerciseId]: nextRows } };
    });
  }, []);

  const saveWorkout = useCallback((): { ok: true } | { ok: false; error: string } => {
    if (!state) return { ok: false, error: "Not ready" };
    if (!state.activeSplitId || state.activeWorkoutSlotIndex === null) {
      return { ok: false, error: "No active workout" };
    }
    const split = state.splits.find((s) => s.id === state.activeSplitId);
    if (!split) return { ok: false, error: "Split not found" };
    const slot = split.slots[state.activeWorkoutSlotIndex];
    if (!slot) return { ok: false, error: "Invalid workout day" };

    const setsOut: WorkoutSession["sets"] = [];
    let totalSets = 0;

    for (const exerciseId of slot.exerciseIds) {
      const exercise = state.exercises.find((e) => e.id === exerciseId);
      const nameSnapshot = exercise?.name ?? "Unknown exercise";
      const rows = state.draftByExerciseId[exerciseId] ?? [];
      let setIndex = 0;
      for (const row of rows) {
        const hasAny = row.reps.trim() !== "" || row.weight.trim() !== "" || row.rpe.trim() !== "";
        if (!hasAny) continue;
        const v = validateSetRow(row.reps, row.weight, row.rpe);
        if (!v.ok) {
          return { ok: false, error: `${nameSnapshot}: ${v.error}` };
        }
        setIndex += 1;
        totalSets += 1;
        setsOut.push({
          exerciseId,
          exerciseNameSnapshot: nameSnapshot,
          setIndex,
          reps: v.reps,
          weight: v.weight,
          rpe: v.rpe,
        });
      }
    }

    if (totalSets === 0) {
      return { ok: false, error: "Add at least one complete set before saving." };
    }

    const now = new Date();
    const localDate = getLocalDateString(now);
    const session: WorkoutSession = {
      id: generateId(),
      completedAt: now.toISOString(),
      localDate,
      splitId: split.id,
      splitNameSnapshot: split.name,
      workoutSlotIndex: state.activeWorkoutSlotIndex,
      workoutNameSnapshot: slot.workoutName,
      sets: setsOut,
    };

    const lastByEx: Record<string, number> = { ...state.lastWeightByExerciseId };
    for (const s of setsOut) {
      lastByEx[s.exerciseId] = s.weight;
    }

    const streakUpdate = computeStreakAfterWorkout(state.streak, state.lastWorkoutDate, localDate);

    setAndDecay((s) => ({
      ...s,
      sessions: [session, ...s.sessions],
      streak: streakUpdate.streak,
      lastWorkoutDate: streakUpdate.lastWorkoutDate,
      lastWeightByExerciseId: { ...s.lastWeightByExerciseId, ...lastByEx },
      activeWorkoutSlotIndex: null,
      draftByExerciseId: {},
    }));

    setShowSaveBanner(true);
    return { ok: true };
  }, [state, setAndDecay]);

  const dismissSaveBanner = useCallback(() => setShowSaveBanner(false), []);

  const deleteSession = useCallback(
    (sessionId: string) => {
      setAndDecay((s) => {
        const sessions = s.sessions.filter((x) => x.id !== sessionId);
        const { streak, lastWorkoutDate } = rebuildStreakFromSessions(sessions);
        const lastWeightByExerciseId = rebuildLastWeightsFromSessions(sessions);
        return { ...s, sessions, streak, lastWorkoutDate, lastWeightByExerciseId };
      });
    },
    [setAndDecay]
  );

  const value = useMemo<WorkoutStoreValue>(() => {
    const fallback = createDefaultState();
    return {
      ready,
      state: state ?? fallback,
      displayStreak,
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
      dismissSaveBanner,
      showSaveBanner,
      deleteSession,
    };
  }, [
    ready,
    state,
    displayStreak,
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
    dismissSaveBanner,
    showSaveBanner,
    deleteSession,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkoutStore(): WorkoutStoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkoutStore must be used within WorkoutStoreProvider");
  return v;
}

export function useExercise(id: string): Exercise | undefined {
  const { state } = useWorkoutStore();
  return state.exercises.find((e) => e.id === id);
}
