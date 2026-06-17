"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { loadTemplateForSession, completeWorkout, logSetToDB, getLastPerformance } from "@/hooks/useWorkout";
import { db, type ExerciseLog } from "@/lib/db";
import type { ActiveWorkout } from "@/lib/progression";
import { getProgression } from "@/lib/progression";
import { SetLogger } from "@/components/workout/SetLogger";
import { RestTimer } from "@/components/workout/RestTimer";
import { ProgressDots } from "@/components/workout/ProgressDots";
import { requestNotificationPermission, notificationPermission } from "@/lib/restTimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Trash2, X, Bell, Check } from "lucide-react";

export default function ActiveWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const store = useWorkoutStore();
  const [showLogForm, setShowLogForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastPerf, setLastPerf] = useState<{ date: string; sets: ExerciseLog[] } | null>(null);
  const [showDiscard, setShowDiscard] = useState(false);
  const [editingSet, setEditingSet] = useState<number | null>(null);
  const [notifAsked, setNotifAsked] = useState(false);

  const sessionId = params.id as string;

  // Initialize active workout if not in store
  useEffect(() => {
    if (store.activeWorkout) return;
    async function init() {
      const session = await db.workoutSessions.get(sessionId);
      if (!session || session.completed_at) {
        router.replace("/workout");
        return;
      }
      if (session.template_id) {
        const data = await loadTemplateForSession(session.template_id);
        if (data) {
          const active: ActiveWorkout = {
            session_id: sessionId,
            template_id: session.template_id,
            name: session.name,
            category: session.category,
            started_at: session.started_at,
            exercises: data.exercises.map((te) => ({
              exercise_id: te.exercise_id,
              exercise_name: te.exercise?.name ?? "Exercise",
              target_sets: te.target_sets,
              target_reps: te.target_reps,
              rest_seconds: te.rest_seconds,
              rpe_target: te.rpe_target,
              sets: [],
            })),
            current_exercise_index: 0,
          };
          store.startWorkout(active);
        }
      }
    }
    init();
  }, [sessionId, store, router]);

  const workout = store.activeWorkout;
  // Derived, timestamp-based remaining seconds (re-reads restNowTick so it
  // repaints each second while open, and is correct the instant you return).
  void store.restNowTick;
  const restSeconds =
    store.restEndsAt != null
      ? Math.max(0, Math.ceil((store.restEndsAt - Date.now()) / 1000))
      : null;
  const restActive = restSeconds != null && restSeconds > 0;

  const currentExerciseId =
    workout && workout.session_id === sessionId
      ? workout.exercises[workout.current_exercise_index]?.exercise_id
      : undefined;

  // Pull the previous session's performance for the current exercise.
  useEffect(() => {
    let cancelled = false;
    if (!currentExerciseId) {
      setLastPerf(null);
      return;
    }
    getLastPerformance(currentExerciseId, sessionId).then((res) => {
      if (!cancelled) setLastPerf(res);
    });
    return () => {
      cancelled = true;
    };
  }, [currentExerciseId, sessionId]);

  if (!workout || workout.session_id !== sessionId) {
    return (
      <main className="min-h-screen bg-[#08090A] flex items-center justify-center">
        <p className="text-[#9BA0A6] animate-pulse">Loading workout...</p>
      </main>
    );
  }

  const exercises = workout.exercises;
  const idx = workout.current_exercise_index;
  const currentExercise = exercises[idx];
  const isLastExercise = idx >= exercises.length - 1;

  if (!currentExercise) {
    // All exercises done
    return (
      <main className="min-h-screen bg-[#08090A] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-2xl font-bold">Workout Complete</p>
        <p className="text-[#9BA0A6]">Great work. Head back to the dashboard.</p>
        <ProgressDots total={exercises.length} current={exercises.length} />
        <Button onClick={() => router.push("/")}>Back to Dashboard</Button>
      </main>
    );
  }

  const handleLogSet = async (data: {
    weight_lbs: number | null;
    reps: number;
    rpe: number | null;
    is_warmup: boolean;
  }) => {
    const setNumber = currentExercise.sets.length + 1;
    const setEntry = {
      exercise_id: currentExercise.exercise_id,
      exercise_name: currentExercise.exercise_name,
      set_number: setNumber,
      ...data,
    };

    store.logSet(setEntry);

    // Persist to DB
    setSaving(true);
    try {
      await logSetToDB({
        session_id: sessionId,
        exercise_id: currentExercise.exercise_id,
        set_number: setNumber,
        weight_lbs: data.weight_lbs,
        reps: data.reps,
        rpe: data.rpe,
        is_warmup: data.is_warmup,
        notes: null,
      });
    } catch (e) {
      console.error("Failed to persist set:", e);
    }
    setSaving(false);

    store.startRest(currentExercise.rest_seconds, currentExercise.exercise_name);
    setShowLogForm(false);
  };

  const handleEditSet = async (setIndex: number, updates: { weight_lbs?: number | null; reps?: number; rpe?: number | null }) => {
    store.editSet(idx, setIndex, updates);
    // Persist: find the matching DB log for this session+exercise+set_number and update it.
    try {
      const logs = await db.exerciseLogs
        .where("session_id")
        .equals(sessionId)
        .toArray();
      const target = logs
        .filter((l) => l.exercise_id === currentExercise.exercise_id)
        .sort((a, b) => a.set_number - b.set_number)[setIndex];
      if (target) await db.exerciseLogs.update(target.id, updates);
    } catch (e) {
      console.error("Failed to persist set edit:", e);
    }
  };

  const handleDeleteSet = async (setIndex: number) => {
    const removed = currentExercise.sets[setIndex];
    store.deleteSet(idx, setIndex);
    try {
      const logs = await db.exerciseLogs
        .where("session_id")
        .equals(sessionId)
        .toArray();
      const target = logs
        .filter((l) => l.exercise_id === currentExercise.exercise_id)
        .sort((a, b) => a.set_number - b.set_number)[setIndex];
      if (target) await db.exerciseLogs.delete(target.id);
    } catch (e) {
      console.error("Failed to delete set:", e);
    }
    void removed;
  };

  const handleNextExercise = async () => {
    if (isLastExercise) {
      await handleFinishWorkout();
      return;
    }
    store.nextExercise();
  };

  const handlePrevExercise = () => {
    store.prevExercise();
  };

  const handleFinishWorkout = async () => {
    try {
      await completeWorkout(sessionId);
    } catch (e) {
      console.error("Failed to complete workout:", e);
    }
    store.completeWorkout();
    router.push("/workout");
  };

  // Pause: leave the session in progress, just go back.
  const handleCancel = () => {
    router.push("/workout");
  };

  // Discard: permanently delete this session and its logged sets.
  const handleDiscard = async () => {
    try {
      await db.exerciseLogs.where("session_id").equals(sessionId).delete();
      await db.workoutSessions.delete(sessionId);
    } catch (e) {
      console.error("Failed to discard workout:", e);
    }
    store.cancelWorkout();
    router.push("/workout");
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#24262C]">
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 text-sm font-medium text-[#9BA0A6]"
        >
          <ChevronLeft className="w-4 h-4" /> Pause
        </button>
        <h1 className="text-base font-bold truncate px-2">{workout.name}</h1>
        <button
          onClick={() => setShowDiscard(true)}
          className="flex items-center gap-1 text-sm font-medium text-[#F2555A]"
        >
          <Trash2 className="w-4 h-4" /> Discard
        </button>
      </div>

      {/* Discard confirm sheet */}
      {showDiscard && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end"
          onClick={() => setShowDiscard(false)}
        >
          <div
            className="w-full bg-[#121316] border-t border-[#24262C] rounded-t-2xl p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-lg">Discard this workout?</p>
            <p className="text-sm text-[#9BA0A6] mt-1">
              All sets logged in this session will be permanently deleted. This can&apos;t be undone.
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <Button variant="destructive" onClick={handleDiscard}>
                Discard workout
              </Button>
              <Button variant="ghost" onClick={() => setShowDiscard(false)}>
                Keep going
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Exercise navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevExercise}
            disabled={idx === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#9BA0A6] disabled:opacity-30 active:bg-[#1B1D22]"
          >
            <ChevronLeft className="w-4 h-4" /> Prev
          </button>
          <span className="text-sm text-[#9BA0A6] tabular-nums font-semibold">
            {idx + 1} / {exercises.length}
          </span>
          <button
            onClick={() => store.nextExercise()}
            disabled={isLastExercise}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-[#9BA0A6] disabled:opacity-30 active:bg-[#1B1D22]"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Notification opt-in (shown once if not yet granted) */}
        {!notifAsked && notificationPermission() === "default" && (
          <button
            onClick={async () => {
              await requestNotificationPermission();
              setNotifAsked(true);
            }}
            className="flex items-center gap-2 rounded-xl border border-[#C7F23E]/30 bg-[#C7F23E]/[0.06] px-3.5 py-2.5 text-sm text-left"
          >
            <Bell className="w-4 h-4 text-[#C7F23E] shrink-0" />
            <span className="text-[#D6D9D6]">
              Enable rest-timer alerts so you&apos;re notified when rest ends, even with the app closed.
            </span>
          </button>
        )}

        {/* Rest Timer */}
        {restActive ? (
          <RestTimer
            seconds={restSeconds!}
            total={store.restDuration ?? restSeconds!}
            onSkip={store.clearRest}
            onAdd={() => store.startRest((restSeconds ?? 0) + 30, currentExercise.exercise_name)}
          />
        ) : (
          <>
            {/* Current Exercise */}
            <Card className="bg-[#121316] border-[#24262C]">
              <CardContent className="p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider">
                  Current Exercise
                </p>
                <p className="text-xl font-extrabold">
                  {currentExercise.exercise_name}
                </p>
                <div className="flex gap-4 text-sm text-[#9BA0A6]">
                  <span>Target: {currentExercise.target_sets} × {currentExercise.target_reps}</span>
                  <span>Rest: {currentExercise.rest_seconds}s</span>
                </div>

                {/* Last time + progression suggestion */}
                {lastPerf && lastPerf.sets.length > 0 && (() => {
                  const prog = getProgression(
                    lastPerf.sets.map((s) => ({
                      exercise_id: s.exercise_id,
                      exercise_name: currentExercise.exercise_name,
                      set_number: s.set_number,
                      weight_lbs: s.weight_lbs,
                      reps: s.reps,
                      rpe: s.rpe,
                      is_warmup: s.is_warmup,
                    })),
                    currentExercise.target_reps
                  );
                  const tone =
                    prog.action === "increase_weight"
                      ? "#36D399"
                      : prog.action === "deload"
                        ? "#F2555A"
                        : "#C7F23E";
                  return (
                    <div className="rounded-lg bg-[#08090A] border border-[#24262C] p-3 flex flex-col gap-1.5">
                      <p className="text-[10px] font-bold text-[#5A5F66] uppercase tracking-wider">
                        Last time
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lastPerf.sets.map((s) => (
                          <span
                            key={s.id}
                            className="text-xs font-semibold tabular-nums px-2 py-0.5 rounded bg-[#121316] text-[#9BA0A6]"
                          >
                            {s.weight_lbs ? `${s.weight_lbs}×${s.reps}` : `${s.reps} reps`}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs font-semibold mt-1" style={{ color: tone }}>
                        → {prog.reason}
                      </p>
                    </div>
                  );
                })()}

                {/* Sets logged */}
                {currentExercise.sets.length > 0 && (
                  <div className="flex flex-col gap-1 mt-2">
                    {currentExercise.sets.map((s, i) =>
                      editingSet === i ? (
                        <SetEditRow
                          key={i}
                          weight={s.weight_lbs}
                          reps={s.reps}
                          onCancel={() => setEditingSet(null)}
                          onSave={async (w, r) => {
                            await handleEditSet(i, { weight_lbs: w, reps: r });
                            setEditingSet(null);
                          }}
                          onDelete={async () => {
                            await handleDeleteSet(i);
                            setEditingSet(null);
                          }}
                        />
                      ) : (
                        <button
                          key={i}
                          onClick={() => setEditingSet(i)}
                          className="flex items-center gap-3 px-3 py-2 bg-[#1B1D22] rounded-md text-left active:bg-[#23262C]"
                        >
                          <span className="text-xs font-bold text-[#5A5F66] w-5">
                            {s.set_number}
                          </span>
                          <span className="text-sm font-semibold tabular-nums">
                            {s.weight_lbs ? `${s.weight_lbs}lb` : "BW"} × {s.reps}
                          </span>
                          {s.rpe != null && (
                            <span className="text-xs text-[#9BA0A6]">@ {s.rpe}</span>
                          )}
                          {s.is_warmup && (
                            <span className="text-[10px] font-bold text-[#F5B83D]">W</span>
                          )}
                          <span className="ml-auto text-[10px] text-[#5A5F66]">tap to edit</span>
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* Log Set Button */}
                {!showLogForm && (
                  <Button
                    className="mt-2"
                    size="lg"
                    onClick={() => setShowLogForm(true)}
                  >
                    Log Set #{currentExercise.sets.length + 1}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Log Form */}
            {showLogForm && (
              <SetLogger
                setNumber={currentExercise.sets.length + 1}
                onLog={handleLogSet}
                onCancel={() => setShowLogForm(false)}
                loading={saving}
              />
            )}

            {/* Next Exercise */}
            {!showLogForm && (
              <Button
                variant="secondary"
                size="lg"
                className="mt-2"
                onClick={handleNextExercise}
              >
                {isLastExercise ? "Finish Workout" : "Next Exercise"}
              </Button>
            )}
          </>
        )}

        <ProgressDots total={exercises.length} current={idx} />
      </div>
    </main>
  );
}

function SetEditRow({
  weight,
  reps,
  onSave,
  onCancel,
  onDelete,
}: {
  weight: number | null;
  reps: number;
  onSave: (weight: number | null, reps: number) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [w, setW] = useState(weight != null ? String(weight) : "");
  const [r, setR] = useState(String(reps));
  return (
    <div className="flex items-center gap-2 px-2 py-2 bg-[#08090A] border border-[#C7F23E]/30 rounded-md">
      <input
        type="number"
        inputMode="decimal"
        value={w}
        onChange={(e) => setW(e.target.value)}
        placeholder="lb"
        className="w-16 bg-[#1B1D22] rounded px-2 py-1 text-sm tabular-nums outline-none"
      />
      <span className="text-[#5A5F66]">×</span>
      <input
        type="number"
        inputMode="numeric"
        value={r}
        onChange={(e) => setR(e.target.value)}
        placeholder="reps"
        className="w-16 bg-[#1B1D22] rounded px-2 py-1 text-sm tabular-nums outline-none"
      />
      <button
        onClick={() => {
          const repsNum = parseInt(r, 10);
          if (isNaN(repsNum) || repsNum <= 0) return;
          onSave(w.trim() === "" ? null : parseFloat(w), repsNum);
        }}
        className="ml-auto grid place-items-center h-8 w-8 rounded-md bg-[#C7F23E] text-[#08090A]"
        aria-label="Save set"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={onDelete}
        className="grid place-items-center h-8 w-8 rounded-md bg-[#F2555A]/15 text-[#F2555A]"
        aria-label="Delete set"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        onClick={onCancel}
        className="grid place-items-center h-8 w-8 rounded-md text-[#9BA0A6]"
        aria-label="Cancel"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
