// PhysiqueOS Web — Workout Store (Zustand)
// Active workout session state — entirely client-side.
//
// The rest timer is TIMESTAMP-BASED: we store the epoch ms when rest ends, not
// a decrementing counter. The visible countdown is derived from (restEndsAt -
// now), so it's always accurate the instant you return to the app — no drift,
// no frozen number after backgrounding. A 1s interval only drives the on-screen
// repaint while the app is open; the actual end is the timestamp.

import { create } from "zustand";
import type { ActiveWorkout, ActiveSet } from "@/lib/progression";
import {
  scheduleRestEndNotification,
  cancelRestNotification,
} from "@/lib/restTimer";

interface WorkoutStore {
  activeWorkout: ActiveWorkout | null;
  restEndsAt: number | null;       // epoch ms when rest completes
  restDuration: number | null;     // total seconds of the current rest (for the ring)
  restIntervalId: ReturnType<typeof setInterval> | null;
  restNowTick: number;             // bumped each second to force re-render

  startWorkout: (workout: ActiveWorkout) => void;
  logSet: (set: ActiveSet) => void;
  editSet: (exerciseIndex: number, setIndex: number, updates: Partial<ActiveSet>) => void;
  deleteSet: (exerciseIndex: number, setIndex: number) => void;
  startRest: (seconds: number, label?: string) => void;
  clearRest: () => void;
  goToExercise: (index: number) => void;
  nextExercise: () => void;
  prevExercise: () => void;
  advanceExercise: () => void; // kept for back-compat (alias of nextExercise)
  completeWorkout: () => void;
  cancelWorkout: () => void;
}

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  activeWorkout: null,
  restEndsAt: null,
  restDuration: null,
  restIntervalId: null,
  restNowTick: 0,

  startWorkout: (workout) =>
    set({ activeWorkout: workout, restEndsAt: null, restDuration: null }),

  logSet: (setLog) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const exercises = [...state.activeWorkout.exercises];
      const idx = state.activeWorkout.current_exercise_index;
      const current = { ...exercises[idx]! };
      current.sets = [...current.sets, setLog];
      exercises[idx] = current;
      return { activeWorkout: { ...state.activeWorkout, exercises } };
    }),

  editSet: (exerciseIndex, setIndex, updates) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const exercises = [...state.activeWorkout.exercises];
      const ex = exercises[exerciseIndex];
      if (!ex) return state;
      const sets = [...ex.sets];
      if (!sets[setIndex]) return state;
      sets[setIndex] = { ...sets[setIndex]!, ...updates };
      exercises[exerciseIndex] = { ...ex, sets };
      return { activeWorkout: { ...state.activeWorkout, exercises } };
    }),

  deleteSet: (exerciseIndex, setIndex) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const exercises = [...state.activeWorkout.exercises];
      const ex = exercises[exerciseIndex];
      if (!ex) return state;
      const sets = ex.sets.filter((_, i) => i !== setIndex);
      exercises[exerciseIndex] = { ...ex, sets };
      return { activeWorkout: { ...state.activeWorkout, exercises } };
    }),

  startRest: (seconds, label) => {
    const existing = get().restIntervalId;
    if (existing) clearInterval(existing);

    const endsAt = Date.now() + seconds * 1000;
    // OS-level alert that survives backgrounding (installed PWA + permission).
    void scheduleRestEndNotification(endsAt, label);

    const id = setInterval(() => {
      const { restEndsAt } = get();
      if (restEndsAt === null) return;
      if (Date.now() >= restEndsAt) {
        get().clearRest();
      } else {
        // Force a re-render so the derived countdown updates on screen.
        set((s) => ({ restNowTick: s.restNowTick + 1 }));
      }
    }, 1000);

    set({ restEndsAt: endsAt, restDuration: seconds, restIntervalId: id });
  },

  clearRest: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    cancelRestNotification();
    set({ restEndsAt: null, restDuration: null, restIntervalId: null });
  },

  goToExercise: (index) =>
    set((state) => {
      if (!state.activeWorkout) return state;
      const max = state.activeWorkout.exercises.length - 1;
      const clamped = Math.min(max, Math.max(0, index));
      const id = get().restIntervalId;
      if (id) clearInterval(id);
      cancelRestNotification();
      return {
        activeWorkout: { ...state.activeWorkout, current_exercise_index: clamped },
        restEndsAt: null,
        restDuration: null,
        restIntervalId: null,
      };
    }),

  nextExercise: () => {
    const w = get().activeWorkout;
    if (!w) return;
    get().goToExercise(w.current_exercise_index + 1);
  },

  prevExercise: () => {
    const w = get().activeWorkout;
    if (!w) return;
    get().goToExercise(w.current_exercise_index - 1);
  },

  advanceExercise: () => get().nextExercise(),

  completeWorkout: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    cancelRestNotification();
    set({ activeWorkout: null, restEndsAt: null, restDuration: null, restIntervalId: null });
  },

  cancelWorkout: () => {
    const id = get().restIntervalId;
    if (id) clearInterval(id);
    cancelRestNotification();
    set({ activeWorkout: null, restEndsAt: null, restDuration: null, restIntervalId: null });
  },
}));
