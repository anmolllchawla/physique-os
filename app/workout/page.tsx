"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTemplates, useRecentSessions } from "@/hooks/useWorkout";
import { useActiveSession } from "@/hooks/useWorkout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { loadTemplateForSession } from "@/hooks/useWorkout";
import { generateId, formatDateShort, formatDuration } from "@/lib/utils";
import type { ActiveWorkout } from "@/lib/progression";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dumbbell, Settings } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  push: "#F2555A",
  pull: "#C7F23E",
  legs: "#36D399",
  full_body: "#A78BFA",
  custom: "#F5B83D",
};

export default function WorkoutHubPage() {
  const router = useRouter();
  const templates = useTemplates();
  const sessions = useRecentSessions(10);
  const activeSession = useActiveSession();
  const store = useWorkoutStore();
  const storeActive = store.activeWorkout;

  const displayActive = storeActive ?? (activeSession ? {
    session_id: activeSession.id,
    template_id: activeSession.template_id,
    name: activeSession.name,
    category: activeSession.category,
    started_at: activeSession.started_at,
    exercises: [],
    current_exercise_index: 0,
  } : null);

  const handleStart = async (templateId: string) => {
    const data = await loadTemplateForSession(templateId);
    if (!data) return;

    const sessionId = generateId();
    await (await import("@/lib/db")).db.workoutSessions.add({
      id: sessionId, template_id: templateId,
      name: data.template.name, category: data.template.category,
      started_at: new Date().toISOString(),
      completed_at: null, duration_sec: null, notes: null,
    });

    const active: ActiveWorkout = {
      session_id: sessionId,
      template_id: templateId,
      name: data.template.name,
      category: data.template.category,
      started_at: new Date().toISOString(),
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
    router.push(`/workout/${sessionId}`);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Workout</h1>
          <Link href="/workout/templates">
            <Button variant="ghost" size="sm">
              <Settings className="w-4 h-4 mr-1" />
              Manage
            </Button>
          </Link>
        </div>

        {/* Active workout */}
        {displayActive && (
          <Link href={`/workout/${displayActive.session_id}`}>
            <Card className="bg-[#C7F23E]/15 border-[#C7F23E] cursor-pointer hover:bg-[#C7F23E]/20 transition-colors">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#C7F23E] uppercase tracking-wider">
                    Continue Workout
                  </p>
                  <p className="text-lg font-bold mt-1">{displayActive.name}</p>
                </div>
                <Dumbbell className="w-5 h-5 text-[#C7F23E]" />
              </CardContent>
            </Card>
          </Link>
        )}

        {/* Templates */}
        <div>
          <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider mb-3">
            Templates
          </p>
          <div className="flex flex-col gap-2">
            {templates.map((t) => (
              <Card key={t.id} className="bg-[#121316] border-[#24262C]">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px]"
                        style={{
                          color: CATEGORY_COLORS[t.category] ?? "#9BA0A6",
                          borderColor: (CATEGORY_COLORS[t.category] ?? "#9BA0A6") + "40",
                        }}
                      >
                        {t.category.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleStart(t.id)}>
                    Start
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider mb-3">
              Recent
            </p>
            <div className="flex flex-col gap-1">
              {sessions.slice(0, 8).map((s) => (
                <Link
                  key={s.id}
                  href={s.completed_at ? `/history/${s.id}` : `/workout/${s.id}`}
                  className="flex items-center justify-between py-3 border-b border-[#24262C] hover:bg-[#121316]/50 px-2 rounded transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-[#9BA0A6] mt-0.5">
                      {formatDateShort(s.started_at)}
                      {s.duration_sec ? ` · ${formatDuration(s.duration_sec)}` : ""}
                      {!s.completed_at ? " · In progress" : ""}
                    </p>
                  </div>
                  <span className="text-[#5A5F66] text-lg">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
