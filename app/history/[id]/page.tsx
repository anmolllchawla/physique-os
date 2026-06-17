"use client";

import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { estimatedOneRM } from "@/lib/progression";
import { useSettings } from "@/hooks/useSettings";
import { formatDateShort, formatDuration, displayWeight } from "@/lib/utils";
import { PageHeader, Section, StatTile, EmptyState } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { Dumbbell } from "lucide-react";

export default function HistoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { weight_unit } = useSettings();
  const wu = weight_unit;

  const session = useLiveQuery(() => db.workoutSessions.get(id), [id]);
  const logs = useLiveQuery(
    () => db.exerciseLogs.where("session_id").equals(id).sortBy("created_at"),
    [id]
  );
  const exercises = useLiveQuery(() => db.exercises.toArray(), []) ?? [];
  const exMap = new Map(exercises.map((e) => [e.id, e.name]));

  if (session === undefined || logs === undefined) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center">
        <p className="text-[#9BA0A6] animate-pulse">Loading…</p>
      </main>
    );
  }
  if (session === null) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center px-4 text-center gap-3">
        <p className="text-[#9BA0A6]">This session no longer exists.</p>
        <Button onClick={() => router.push("/workout")}>Back to Workouts</Button>
      </main>
    );
  }

  // Group sets by exercise, preserving first-seen order.
  const order: string[] = [];
  const grouped = new Map<string, typeof logs>();
  for (const l of logs) {
    if (!grouped.has(l.exercise_id)) {
      grouped.set(l.exercise_id, []);
      order.push(l.exercise_id);
    }
    grouped.get(l.exercise_id)!.push(l);
  }

  const workSets = logs.filter((l) => !l.is_warmup);
  const totalVolume = workSets.reduce((s, l) => s + (l.weight_lbs ?? 0) * l.reps, 0);
  const totalReps = workSets.reduce((s, l) => s + l.reps, 0);
  const topE1rm = workSets.reduce((mx, l) => {
    if (!l.weight_lbs) return mx;
    return Math.max(mx, estimatedOneRM(l.weight_lbs, l.reps));
  }, 0);

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader
        title={session.name}
        back="/workout"
        subtitle={formatDateShort(session.started_at)}
      />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Summary */}
        <div className="flex gap-3">
          <StatTile
            label="Volume"
            value={`${((displayWeight(totalVolume, wu) ?? totalVolume) / 1000).toFixed(1)}k`}
            unit={wu}
          />
          <StatTile label="Sets" value={workSets.length} accent="#A78BFA" />
          <StatTile
            label="Time"
            value={session.duration_sec ? formatDuration(session.duration_sec) : "—"}
            accent="#36D399"
          />
        </div>
        <div className="flex gap-3">
          <StatTile label="Total reps" value={totalReps} accent="#9BA0A6" />
          <StatTile
            label="Top e1RM"
            value={topE1rm ? (displayWeight(Math.round(topE1rm), wu) ?? 0) : "—"}
            unit={topE1rm ? wu : undefined}
            accent="#C7F23E"
          />
        </div>

        {session.notes && (
          <p className="text-sm text-[#9BA0A6] bg-[#121316] border border-[#24262C] rounded-xl p-3 italic">
            {session.notes}
          </p>
        )}

        {/* Per-exercise breakdown */}
        {order.length === 0 ? (
          <EmptyState icon={Dumbbell} title="No sets were logged in this session" />
        ) : (
          <Section label="Exercises">
            <div className="flex flex-col gap-3">
              {order.map((exId) => {
                const sets = grouped.get(exId)!;
                const name = exMap.get(exId) ?? "Exercise";
                const exVol = sets
                  .filter((s) => !s.is_warmup)
                  .reduce((sum, s) => sum + (s.weight_lbs ?? 0) * s.reps, 0);
                return (
                  <div key={exId} className="rounded-2xl bg-[#121316] border border-[#24262C] p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="font-semibold">{name}</p>
                      <span className="text-[11px] text-[#5A5F66] tnums">
                        {(displayWeight(exVol, wu) ?? exVol).toLocaleString()} {wu}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {sets.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#1B1D22]"
                        >
                          <span className="text-[11px] font-bold text-[#5A5F66] w-4">
                            {s.set_number}
                          </span>
                          <span className="text-sm font-semibold tnums">
                            {s.weight_lbs
                              ? `${displayWeight(s.weight_lbs, wu)} ${wu}`
                              : "BW"}{" "}
                            × {s.reps}
                          </span>
                          {s.rpe != null && (
                            <span className="text-xs text-[#5A5F66]">@ {s.rpe}</span>
                          )}
                          {s.is_warmup && (
                            <span className="text-[10px] font-bold text-[#F5B83D] ml-auto">
                              WARMUP
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
