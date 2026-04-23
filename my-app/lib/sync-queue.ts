import AsyncStorage from "@react-native-async-storage/async-storage";

import type { WorkoutSession } from "@/lib/types";

const KEY = "@capstone_workout_sync_queue";

export type QueuedWorkout = { userId: string; session: WorkoutSession };

export async function loadSyncQueue(): Promise<QueuedWorkout[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is QueuedWorkout =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as QueuedWorkout).userId === "string" &&
        typeof (x as QueuedWorkout).session === "object" &&
        typeof (x as QueuedWorkout).session?.id === "string"
    );
  } catch {
    return [];
  }
}

export async function enqueueWorkoutSync(userId: string, session: WorkoutSession): Promise<void> {
  const q = await loadSyncQueue();
  if (q.some((x) => x.session.id === session.id)) return;
  q.push({ userId, session });
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}

export async function removeFromSyncQueue(sessionId: string): Promise<void> {
  const q = (await loadSyncQueue()).filter((x) => x.session.id !== sessionId);
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}
