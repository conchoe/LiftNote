import legacyStorage, { createAsyncStorage } from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { createBaseExercises, mergeBaseLibraryIfNeeded, syncStarterCatalogIntoState } from "./exercise-library";
import { generateId } from "./id";
import { applyStreakDecayToState } from "./streak-sync";
import type { AppStateV1, Exercise } from "./types";

/** Legacy single-user key (pre–per-account storage). */
export const LEGACY_WORKOUT_STORAGE_KEY = "workout_logger_state_v1";

/**
 * When Supabase auth is on, each signed-in user gets their own blob so accounts
 * never share splits/sessions on one device. Not signed in → `…:guest`.
 * Auth off → legacy key only (one local profile).
 */
export function getWorkoutStorageKey(authEnabled: boolean, userId: string | null): string {
  if (!authEnabled) return LEGACY_WORKOUT_STORAGE_KEY;
  if (userId) return `${LEGACY_WORKOUT_STORAGE_KEY}:u:${userId}`;
  return `${LEGACY_WORKOUT_STORAGE_KEY}:guest`;
}

type KV = Pick<typeof legacyStorage, "getItem" | "setItem" | "removeItem">;

const mem = new Map<string, string>();

/** Last resort when no native module / no browser storage works. Session-only. */
const memoryStorage: KV = {
  getItem: async (key) => (mem.has(key) ? mem.get(key)! : null),
  setItem: async (key, value) => {
    mem.set(key, value);
  },
  removeItem: async (key) => {
    mem.delete(key);
  },
};

function getWebIndexedDbStorage(): KV {
  return createAsyncStorage("homework9_workout_logger");
}

function isWeb(): boolean {
  return Platform.OS === "web";
}

type ResolvedStorage = {
  /** All reads/writes go here */
  primary: KV;
  /** Web only: localStorage-backed legacy export, used to migrate data into IndexedDB */
  webMigrationSource?: KV;
};

let storageResolution: Promise<ResolvedStorage> | null = null;

let warnedInMemory = false;

/**
 * Picks the first storage backend that actually works in this runtime.
 *
 * If you see the in-memory warning on a phone/simulator, AsyncStorage's native
 * module is not in the binary (e.g. custom dev client built without it, or a
 * broken native rebuild). Fix: use Expo Go, or `npx expo prebuild` + rebuild,
 * and ensure `@react-native-async-storage/async-storage` is installed.
 */
async function resolveStorage(): Promise<ResolvedStorage> {
  if (storageResolution) return storageResolution;

  storageResolution = (async (): Promise<ResolvedStorage> => {
    if (isWeb()) {
      try {
        const idb = getWebIndexedDbStorage();
        await idb.getItem(LEGACY_WORKOUT_STORAGE_KEY);
        return { primary: idb, webMigrationSource: legacyStorage };
      } catch {
        /* IndexedDB unavailable */
      }
      try {
        await legacyStorage.getItem(LEGACY_WORKOUT_STORAGE_KEY);
        return { primary: legacyStorage };
      } catch {
        if (!warnedInMemory) {
          warnedInMemory = true;
          console.warn(
            "[WorkoutLogger] Web storage unavailable; using in-memory store (data clears on refresh)."
          );
        }
        return { primary: memoryStorage };
      }
    }

    try {
      await legacyStorage.getItem(LEGACY_WORKOUT_STORAGE_KEY);
      return { primary: legacyStorage };
    } catch {
      if (!warnedInMemory) {
        warnedInMemory = true;
        console.warn(
          "[WorkoutLogger] AsyncStorage native module is missing in this build. Using in-memory storage — " +
            "nothing will persist after you close the app. Use Expo Go, or create a dev build that includes AsyncStorage " +
            "(`npx expo prebuild` then run on a simulator/device)."
        );
      }
      return { primary: memoryStorage };
    }
  })();

  return storageResolution;
}

/** Serialize writes so rapid state updates never overlap storage transactions. */
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite(task: () => Promise<void>): Promise<void> {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readRawWithMigration(storageKey: string): Promise<string | null> {
  const { primary, webMigrationSource } = await resolveStorage();

  let raw = await primary.getItem(storageKey);
  if (raw) return raw;

  // One-time: old installs used a single key — move into this signed-in user's slot once.
  if (storageKey.startsWith(`${LEGACY_WORKOUT_STORAGE_KEY}:u:`)) {
    const legacy = await primary.getItem(LEGACY_WORKOUT_STORAGE_KEY);
    if (legacy) {
      try {
        await primary.setItem(storageKey, legacy);
        await primary.removeItem(LEGACY_WORKOUT_STORAGE_KEY);
      } catch {
        /* still use legacy payload below */
      }
      return legacy;
    }
  }

  if (webMigrationSource) {
    try {
      let fromLegacy = await webMigrationSource.getItem(storageKey);
      if (!fromLegacy && storageKey.startsWith(`${LEGACY_WORKOUT_STORAGE_KEY}:u:`)) {
        fromLegacy = await webMigrationSource.getItem(LEGACY_WORKOUT_STORAGE_KEY);
      }
      if (!fromLegacy) return null;
      try {
        await primary.setItem(storageKey, fromLegacy);
      } catch {
        /* still return migrated payload */
      }
      return fromLegacy;
    } catch {
      return null;
    }
  }

  return null;
}

/** Clears persisted state for the given auth scope (same key rules as load/save). */
export async function clearAllData(authEnabled: boolean, userId: string | null): Promise<void> {
  const storageKey = getWorkoutStorageKey(authEnabled, userId);
  await enqueueWrite(async () => {
    mem.delete(storageKey);
    const { primary, webMigrationSource } = await resolveStorage();
    try {
      await primary.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    if (webMigrationSource) {
      try {
        await webMigrationSource.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  });
}

export async function debugStorageSize(authEnabled: boolean, userId: string | null): Promise<void> {
  try {
    const { primary } = await resolveStorage();
    const key = getWorkoutStorageKey(authEnabled, userId);
    const raw = await primary.getItem(key);
    if (!raw) {
      console.log(`No data stored for ${key}`);
      return;
    }
    const sizeKB = raw.length / 1024;
    console.log(`Stored data size (${key}): ~${sizeKB.toFixed(2)} KB`);
  } catch (err) {
    console.error("Error checking storage size:", err);
  }
}

export function createDefaultState(): AppStateV1 {
  return {
    version: 1,
    exercises: createBaseExercises(),
    splits: [],
    sessions: [],
    streak: 0,
    lastWorkoutDate: null,
    lastWeightByExerciseId: {},
    activeSplitId: null,
    activeWorkoutSlotIndex: null,
    draftByExerciseId: {},
  };
}

function normalizeState(raw: unknown): AppStateV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  return {
    version: 1,
    exercises: Array.isArray(o.exercises) ? (o.exercises as unknown[]).map((raw): Exercise => {
      if (!raw || typeof raw !== "object") {
        return { id: generateId(), name: "Exercise" };
      }
      const e = raw as Record<string, unknown>;
      const id = typeof e.id === "string" && e.id ? e.id : generateId();
      const name = typeof e.name === "string" ? e.name : "Exercise";
      const lk = e.libraryKey;
      if (
        lk === "legs" ||
        lk === "chest" ||
        lk === "back" ||
        lk === "shoulders" ||
        lk === "arms" ||
        lk === "core"
      ) {
        return { id, name, libraryKey: lk };
      }
      return { id, name };
    }) : [],
    splits: Array.isArray(o.splits) ? (o.splits as AppStateV1["splits"]) : [],
    sessions: Array.isArray(o.sessions) ? (o.sessions as AppStateV1["sessions"]) : [],
    streak: typeof o.streak === "number" ? o.streak : 0,
    lastWorkoutDate: typeof o.lastWorkoutDate === "string" || o.lastWorkoutDate === null ? (o.lastWorkoutDate as string | null) : null,
    lastWeightByExerciseId:
      o.lastWeightByExerciseId && typeof o.lastWeightByExerciseId === "object"
        ? (o.lastWeightByExerciseId as Record<string, number>)
        : {},
    activeSplitId: typeof o.activeSplitId === "string" || o.activeSplitId === null ? (o.activeSplitId as string | null) : null,
    activeWorkoutSlotIndex:
      typeof o.activeWorkoutSlotIndex === "number" || o.activeWorkoutSlotIndex === null
        ? (o.activeWorkoutSlotIndex as number | null)
        : null,
    draftByExerciseId:
      o.draftByExerciseId && typeof o.draftByExerciseId === "object"
        ? (o.draftByExerciseId as AppStateV1["draftByExerciseId"])
        : {},
  };
}

function repairActivePointers(state: AppStateV1): AppStateV1 {
  const splitIds = new Set(state.splits.map((s) => s.id));
  let activeSplitId = state.activeSplitId;
  if (activeSplitId && !splitIds.has(activeSplitId)) {
    activeSplitId = null;
  }
  let activeWorkoutSlotIndex = state.activeWorkoutSlotIndex;
  if (!activeSplitId) {
    activeWorkoutSlotIndex = null;
  } else if (typeof activeWorkoutSlotIndex === "number") {
    const split = state.splits.find((s) => s.id === activeSplitId);
    const slot = split?.slots[activeWorkoutSlotIndex];
    if (!slot) {
      activeWorkoutSlotIndex = null;
    }
  }
  return { ...state, activeSplitId, activeWorkoutSlotIndex };
}

export async function loadPersistedState(authEnabled: boolean, userId: string | null): Promise<AppStateV1> {
  try {
    const storageKey = getWorkoutStorageKey(authEnabled, userId);
    const raw = await readRawWithMigration(storageKey);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeState(parsed);
    if (!normalized) return createDefaultState();
    const merged = mergeBaseLibraryIfNeeded(normalized);
    const withStarters = syncStarterCatalogIntoState(merged);
    const repaired = repairActivePointers(withStarters);
    return applyStreakDecayToState(repaired);
  } catch (error) {
    console.error("Failed to load persisted state:", error);
    return createDefaultState();
  }
}

async function trySave(json: string, storageKey: string): Promise<void> {
  const { primary } = await resolveStorage();

  if (isWeb() && primary !== legacyStorage && primary !== memoryStorage) {
    try {
      await primary.setItem(storageKey, json);
      return;
    } catch (primaryErr) {
      console.warn("IndexedDB save failed, trying legacy localStorage:", primaryErr);
      try {
        await legacyStorage.setItem(storageKey, json);
        return;
      } catch {
        await memoryStorage.setItem(storageKey, json);
        return;
      }
    }
  }

  await primary.setItem(storageKey, json);
}

export async function savePersistedState(
  state: AppStateV1,
  authEnabled: boolean,
  userId: string | null
): Promise<void> {
  const storageKey = getWorkoutStorageKey(authEnabled, userId);
  const json = JSON.stringify(state);
  return enqueueWrite(async () => {
    try {
      await trySave(json, storageKey);
    } catch (error) {
      console.error("Failed to save state:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("full")) {
        try {
          const trimmedState: AppStateV1 = {
            ...state,
            sessions: state.sessions.slice(0, Math.max(0, state.sessions.length - 100)),
          };
          const trimmedJson = JSON.stringify(trimmedState);
          await trySave(trimmedJson, storageKey);
          return;
        } catch (fallback) {
          console.error("Even trimmed state failed:", fallback);
        }
      }
      throw error;
    }
  });
}
