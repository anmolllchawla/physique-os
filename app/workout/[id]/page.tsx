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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ActiveWorkoutPage() {
  const params = useParams();
  const router = useRouter();
  const store = useWorkoutStore();
  const [showLogForm, setShowLogForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastPerf, setLastPerf] = useState<{ date: string; sets: ExerciseLog[] } | null>(null);

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
  const restSeconds = store.restTimerSeconds;

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

    store.startRest(currentExercise.rest_seconds);
    setShowLogForm(false);
  };

  const handleNextExercise = async () => {
    if (isLastExercise) {
      await handleFinishWorkout();
      return;
    }
    store.clearRest();
    store.advanceExercise();
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

  const handleCancel = () => {
    store.cancelWorkout();
    router.push("/workout");
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#24262C]">
        <button onClick={handleCancel} className="text-sm font-medium text-[#F2555A]">
          Cancel
        </button>
        <h1 className="text-base font-bold">{workout.name}</h1>
        <span className="text-sm text-[#9BA0A6] tabular-nums font-semibold">
          {idx + 1}/{exercises.length}
        </span>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* Rest Timer */}
        {restSeconds !== null && restSeconds > 0 ? (
          <RestTimer seconds={restSeconds} onSkip={store.clearRest} />
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
                    {currentExercise.sets.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-1.5 bg-[#1B1D22] rounded-md"
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
                          <span className="text-[10px] font-bold text-[#F5B83D] ml-auto">
                            W
                          </span>
                        )}
                      </div>
                    ))}
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
