/** Subgroups for the default catalog; custom exercises omit this. */
export type ExerciseLibraryKey = "legs" | "chest" | "back" | "shoulders" | "arms" | "core";

export type Exercise = {
  id: string;
  name: string;
  /** Set for bundled starter moves; custom adds from the app leave this unset. */
  libraryKey?: ExerciseLibraryKey;
};

export type WorkoutSlot = {
  workoutName: string;
  exerciseIds: string[];
} | null;

export type Split = {
  id: string;
  name: string;
  slots: WorkoutSlot[];
};

export type SetLog = {
  exerciseId: string;
  exerciseNameSnapshot: string;
  setIndex: number;
  reps: number;
  weight: number;
  rpe: number;
};

export type WorkoutSession = {
  id: string;
  completedAt: string;
  localDate: string;
  splitId: string;
  splitNameSnapshot: string;
  workoutSlotIndex: number;
  workoutNameSnapshot: string;
  sets: SetLog[];
};

export type DraftSet = {
  reps: string;
  weight: string;
  rpe: string;
};

export type AppStateV1 = {
  version: 1;
  exercises: Exercise[];
  splits: Split[];
  sessions: WorkoutSession[];
  streak: number;
  lastWorkoutDate: string | null;
  lastWeightByExerciseId: Record<string, number>;
  activeSplitId: string | null;
  activeWorkoutSlotIndex: number | null;
  draftByExerciseId: Record<string, DraftSet[]>;
};
