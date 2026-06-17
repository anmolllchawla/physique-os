// PhysiqueOS Web — Workout Store (Zustand)
// Manages active workout session state — entirely client-side.

import { create } from "zustand";
import type { ActiveWorkout, ActiveSet, ActiveExercise } from "@/lib/progression";

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  restTimerSeconds: number | null;
  restIntervalId: ReturnType<typeof setInterval> | null;

  startWorkout: (workout: ActiveWorkout) => void;
  logSet: (set: ActiveSet) => void;
  startRest: (seconds: number) => void;
  tickRest: () => void;
  clearRest: () => void;
  advanceExercise: () => void;
  completeWorkout: () => void;
  cancelWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  activeWorkout: null,
  restTimerSeconds: null,
  restIntervalId: null,

  startWorkout: (workout) => set({ activeWorkout: workout, restTimerSeconds: null }),

  logSet: (setLog) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const workout = { ...state.activeWorkout };
      const exercises = [...workout.exercises];
      const idx = workout.current_exercise_index;
      const current = { ...exercises[idx]! };
      current.sets = [...current.sets, setLog];
      exercises[idx] = current;
      return { activeWorkout: { ...workout, exercises } };
    }),

  startRest: (seconds) => {
    const existing = get().restIntervalId;
    if (existing) clearInterval(existing);
    const id = setInterval(() => get().tickRest(), 1000);
    set({ restTimerSeconds: seconds, restIntervalId: id });
  },

  tickRest: () =>
    set((state) => {
      if (state.restTimerSeconds === null || state.restTimerSeconds <= 1) {
        if (state.restIntervalId) clearInterval(state.restIntervalId);
        return { restTimerSeconds: null, restIntervalId: null };
      }
      return { restTimerSeconds: state.restTimerSeconds - 1 };
    }),

  clearRest: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    set({ restTimerSeconds: null, restIntervalId: null });
  },

  advanceExercise: () =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const next = state.activeWorkout.current_exercise_index + 1;
      if (next >= state.activeWorkout.exercises.length) {
        return state;
      }
      return {
        activeWorkout: {
          ...state.activeWorkout,
          current_exercise_index: next,
        },
        restTimerSeconds: null,
      };
    }),

  completeWorkout: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    set({ activeWorkout: null, restTimerSeconds: null, restIntervalId: null });
  },

  cancelWorkout: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    set({ activeWorkout: null, restTimerSeconds: null, restIntervalId: null });
  },
}));
