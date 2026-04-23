import type { SupabaseClient } from "@supabase/supabase-js";

import { enqueueWorkoutSync, loadSyncQueue, removeFromSyncQueue } from "@/lib/sync-queue";
import type { AppStateV1, WorkoutSession } from "@/lib/types";

/** `workout_logs.id` in Postgres is type `uuid`; only UUID-shaped strings can be inserted. */
const WORKOUT_LOG_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function sessionVolumeTotal(session: WorkoutSession): number {
  return session.sets.reduce((sum, s) => sum + s.reps * s.weight, 0);
}

export function mergeRemoteSessionsIntoState(state: AppStateV1, remote: WorkoutSession[]): AppStateV1 {
  const existing = new Set(state.sessions.map((s) => s.id));
  const incoming = remote.filter((s) => !existing.has(s.id));
  if (incoming.length === 0) return state;

  const exerciseById = new Map(state.exercises.map((e) => [e.id, e] as const));
  const exercises = [...state.exercises];

  for (const session of incoming) {
    for (const set of session.sets) {
      if (!exerciseById.has(set.exerciseId)) {
        exercises.push({ id: set.exerciseId, name: set.exerciseNameSnapshot });
        exerciseById.set(set.exerciseId, { id: set.exerciseId, name: set.exerciseNameSnapshot });
      }
    }
  }

  const mergedSessions = [...incoming, ...state.sessions].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
  );

  return { ...state, exercises, sessions: mergedSessions };
}

export async function pushWorkoutLog(
  supabase: SupabaseClient,
  userId: string,
  session: WorkoutSession
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!WORKOUT_LOG_ID_UUID.test(session.id)) {
    if (__DEV__) {
      console.warn(
        "[cloud-sync] Skipping upload: session id is not a UUID. Legacy sessions cannot sync; log a new workout."
      );
    }
    await removeFromSyncQueue(session.id);
    return { ok: true };
  }

  const volume = sessionVolumeTotal(session);
  const { error } = await supabase.from("workout_logs").upsert(
    {
      id: session.id,
      user_id: userId,
      payload: session as unknown as Record<string, unknown>,
      volume_total: Math.round(volume),
      workout_name: session.workoutNameSnapshot,
      split_name: session.splitNameSnapshot,
    },
    { onConflict: "id" }
  );
  if (error) {
    if (__DEV__) {
      console.warn("[cloud-sync] workout_logs upsert failed", error.message);
    }
    return { ok: false, error: error.message };
  }
  await removeFromSyncQueue(session.id);
  return { ok: true };
}

export async function fetchOwnWorkoutLogs(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_logs")
    .select("payload")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  const out: WorkoutSession[] = [];
  for (const row of data) {
    const s = parseWorkoutPayload(row.payload);
    if (s) out.push(s);
  }
  return out;
}

export function parseWorkoutPayload(payload: unknown): WorkoutSession | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.id !== "string" || typeof p.completedAt !== "string" || !Array.isArray(p.sets)) return null;
  return payload as WorkoutSession;
}

export async function flushWorkoutSyncQueue(supabase: SupabaseClient): Promise<void> {
  const q = await loadSyncQueue();
  for (const item of q) {
    const r = await pushWorkoutLog(supabase, item.userId, item.session);
    if (!r.ok) break;
  }
}

export async function syncWorkoutAfterSave(
  supabase: SupabaseClient | null,
  userId: string | undefined,
  session: WorkoutSession
): Promise<void> {
  if (!supabase || !userId) return;
  const r = await pushWorkoutLog(supabase, userId, session);
  if (!r.ok) await enqueueWorkoutSync(userId, session);
}
