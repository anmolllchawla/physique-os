"use client";

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { estimatedOneRM } from "@/lib/progression";
import { readinessLabel } from "@/lib/scoring";
import { formatDateShort, formatDuration, displayWeight } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { LineTrend, BarTrend } from "@/components/Chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import {
  ArrowLeft,
  Minus,
  TrendingUp,
  TrendingDown,
  BarChart3,
} from "lucide-react";

// ── helpers ─────────────────────────────────────

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

function getMonday(d: Date): string {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const m = new Date(d);
  m.setDate(diff);
  return m.toISOString().split("T")[0]!;
}

function weekLabel(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - offset * 7);
  const mon = getMonday(d);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(new Date(mon))} – ${fmt(sun)}`;
}

// ── components ──────────────────────────────────

function TrendIcon({ value }: { value: number | null }) {
  if (value == null)
    return <Minus className="w-4 h-4 text-[#5A5F66]" />;
  if (value > 0)
    return <TrendingUp className="w-4 h-4 text-[#36D399]" />;
  if (value < 0)
    return <TrendingDown className="w-4 h-4 text-[#F2555A]" />;
  return <Minus className="w-4 h-4 text-[#9BA0A6]" />;
}

// ── page ────────────────────────────────────────

export default function ProgressPage() {
  const [seeded, setSeeded] = useState(false);
  useEffect(() => { seedIfNeeded().then(() => setSeeded(true)); }, []);
  const { weight_unit } = useSettings();

  const bodyweightLogs = useLiveQuery(
    () => db.bodyweightLogs.orderBy("date").reverse().toArray(),
    [seeded]
  ) ?? [];

  const checkins = useLiveQuery(
    () => db.dailyCheckins.orderBy("date").reverse().toArray(),
    [seeded]
  ) ?? [];

  const sessions = useLiveQuery(
    () => db.workoutSessions.orderBy("started_at").reverse().toArray(),
    [seeded]
  ) ?? [];

  const allLogs = useLiveQuery(
    () => db.exerciseLogs.toArray(),
    [seeded]
  ) ?? [];

  const exercises = useLiveQuery(
    () => db.exercises.toArray(),
    [seeded]
  ) ?? [];

  const exerciseMap = new Map(exercises.map((e) => [e.id, e.name]));

  // ── bodyweight trend ──────────────────────────

  const latestWeight = bodyweightLogs[0] ?? null;
  const weight7dAgo = bodyweightLogs.find((l) => l.date <= daysAgo(7)) ?? null;
  const weight30dAgo = bodyweightLogs.find((l) => l.date <= daysAgo(30)) ?? null;

  const weightChange7d = latestWeight && weight7dAgo
    ? latestWeight.weight_lbs - weight7dAgo.weight_lbs : null;
  const weightChange30d = latestWeight && weight30dAgo
    ? latestWeight.weight_lbs - weight30dAgo.weight_lbs : null;

  // ── workout consistency ───────────────────────

  const thisWeekStart = daysAgo(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
  const lastWeekStart = daysAgo((new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) + 7);

  const sessionsThisWeek = sessions.filter(
    (s) => s.started_at.slice(0, 10) >= thisWeekStart && s.completed_at
  );
  const sessionsLastWeek = sessions.filter(
    (s) =>
      s.started_at.slice(0, 10) >= lastWeekStart &&
      s.started_at.slice(0, 10) < thisWeekStart &&
      s.completed_at
  );

  // ── best lifts / PRs ──────────────────────────

  const prMap = new Map<string, { exercise_id: string; exercise_name: string; weight_lbs: number; reps: number; estimated_1rm: number; date: string }>();
  for (const log of allLogs) {
    if (!log.weight_lbs || log.is_warmup) continue;
    const name = exerciseMap.get(log.exercise_id) ?? "Unknown";
    const e1rm = estimatedOneRM(log.weight_lbs, log.reps);
    const existing = prMap.get(log.exercise_id);
    if (!existing || e1rm > existing.estimated_1rm) {
      prMap.set(log.exercise_id, {
        exercise_id: log.exercise_id,
        exercise_name: name,
        weight_lbs: log.weight_lbs,
        reps: log.reps,
        estimated_1rm: e1rm,
        date: log.created_at.slice(0, 10),
      });
    }
  }
  const topPRs = [...prMap.values()]
    .sort((a, b) => b.estimated_1rm - a.estimated_1rm)
    .slice(0, 10);

  // ── volume trend ──────────────────────────────

  const volumeThisWeek = allLogs.filter(
    (l) => l.created_at.slice(0, 10) >= thisWeekStart
  );
  const volumeLastWeek = allLogs.filter(
    (l) =>
      l.created_at.slice(0, 10) >= lastWeekStart &&
      l.created_at.slice(0, 10) < thisWeekStart
  );
  const setsThisWeek = volumeThisWeek.length;
  const repsThisWeek = volumeThisWeek.reduce((s, l) => s + l.reps, 0);
  const tonnageThisWeek = volumeThisWeek.reduce((s, l) => s + (l.weight_lbs ?? 0) * l.reps, 0);
  const setsLastWeek = volumeLastWeek.length;

  // ── readiness trend ───────────────────────────

  const recentCheckins = checkins.slice(0, 14);
  const avgReadiness = recentCheckins.length > 0
    ? Math.round(
        recentCheckins.reduce((s, c) => s + (c.readiness_score ?? 0), 0) /
          recentCheckins.length
      )
    : null;
  const readinessToday = checkins.find((c) => c.date === new Date().toISOString().split("T")[0]);
  const todayScore = readinessToday?.readiness_score ?? null;
  const todayInfo = todayScore != null ? readinessLabel(todayScore) : null;

  // ── weekly summary ────────────────────────────

  const completedThisWeek = sessionsThisWeek.length;
  const totalDurationThisWeek = sessionsThisWeek.reduce(
    (s, sess) => s + (sess.duration_sec ?? 0), 0
  );

  // ── chart series ──────────────────────────────
  const wu = weight_unit === "kg" ? "kg" : "lbs";

  // Bodyweight: oldest → newest, last 90 days.
  const weightSeries = [...bodyweightLogs]
    .filter((l) => l.date >= daysAgo(90))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((l) => ({
      label: formatDateShort(l.date).replace(/^\w+,?\s*/, ""),
      value: displayWeight(l.weight_lbs, weight_unit) ?? l.weight_lbs,
    }));

  // Readiness: oldest → newest, last 30 days.
  const readinessSeries = [...checkins]
    .filter((c) => c.date >= daysAgo(30) && c.readiness_score != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((c) => ({
      label: formatDateShort(c.date).replace(/^\w+,?\s*/, ""),
      value: Math.round(c.readiness_score ?? 0),
    }));

  // Weekly training volume (sets) over the last 8 weeks.
  const volumeByWeek: { label: string; value: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = getMonday(new Date(Date.now() - w * 7 * 86400000));
    const end = getMonday(new Date(Date.now() - (w - 1) * 7 * 86400000));
    const sets = allLogs.filter((l) => {
      const d = l.created_at.slice(0, 10);
      return d >= start && (w === 0 ? true : d < end) && !l.is_warmup;
    }).length;
    volumeByWeek.push({ label: start.slice(5), value: sets });
  }
  const avgWeeklySets =
    volumeByWeek.length > 0
      ? Math.round(volumeByWeek.reduce((s, v) => s + v.value, 0) / volumeByWeek.length)
      : 0;

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-20">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Progress</h1>
        </div>

        {/* Weekly Summary */}
        <Card className="bg-[#121316] border-[#24262C]">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3">
              {weekLabel(0)}
            </p>
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold tabular-nums">{completedThisWeek}</p>
                <p className="text-xs text-[#5A5F66] mt-1">workouts</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold tabular-nums">{setsThisWeek}</p>
                <p className="text-xs text-[#5A5F66] mt-1">sets</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold tabular-nums">
                  {formatDuration(totalDurationThisWeek)}
                </p>
                <p className="text-xs text-[#5A5F66] mt-1">time</p>
              </div>
            </div>
            {completedThisWeek === 0 && (
              <p className="text-xs text-[#5A5F66] mt-3 text-center">
                No workouts logged this week yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Readiness */}
        <div className="flex gap-3">
          <MetricCard
            label="Today"
            value={todayScore ?? "—"}
            unit={todayInfo?.label}
            color={todayInfo?.color}
          />
          <MetricCard
            label="Avg (14d)"
            value={avgReadiness ?? "—"}
            unit="score"
            color={
              avgReadiness != null ? readinessLabel(avgReadiness).color : undefined
            }
          />
        </div>

        {/* Bodyweight Trend */}
        <div>
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3 px-1">
            Bodyweight
          </p>
          <div className="bg-[#121316] border border-[#24262C] rounded-xl p-3 mb-3">
            <LineTrend data={weightSeries} unit={wu} color="#C7F23E" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">7-day</p>
              <div className="flex items-center gap-2">
                <TrendIcon value={weightChange7d} />
                <span className="text-lg font-bold tabular-nums">
                  {weightChange7d != null
                    ? `${weightChange7d > 0 ? "+" : ""}${(displayWeight(Math.abs(weightChange7d), weight_unit)! * Math.sign(weightChange7d)).toFixed(1)}`
                    : "—"}
                </span>
              </div>
              <p className="text-[10px] text-[#3A3D45] mt-1">{wu}</p>
            </div>
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">30-day</p>
              <div className="flex items-center gap-2">
                <TrendIcon value={weightChange30d} />
                <span className="text-lg font-bold tabular-nums">
                  {weightChange30d != null
                    ? `${weightChange30d > 0 ? "+" : ""}${(displayWeight(Math.abs(weightChange30d), weight_unit)! * Math.sign(weightChange30d)).toFixed(1)}`
                    : "—"}
                </span>
              </div>
              <p className="text-[10px] text-[#3A3D45] mt-1">{wu}</p>
            </div>
          </div>
        </div>

        {/* Volume */}
        <div>
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3 px-1">
            Volume
          </p>
          <div className="bg-[#121316] border border-[#24262C] rounded-xl p-3 mb-3">
            <BarTrend data={volumeByWeek} unit="sets" color="#A78BFA" average={avgWeeklySets} />
            <p className="text-[10px] text-[#5A5F66] text-center mt-1">
              Sets per week (last 8 weeks) · dashed line = average
            </p>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">This week</p>
              <p className="text-lg font-bold tabular-nums">{setsThisWeek}</p>
              <p className="text-[10px] text-[#3A3D45] mt-1">sets</p>
            </div>
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">This week</p>
              <p className="text-lg font-bold tabular-nums">{repsThisWeek}</p>
              <p className="text-[10px] text-[#3A3D45] mt-1">reps</p>
            </div>
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">This week</p>
              <p className="text-lg font-bold tabular-nums">
                {((displayWeight(tonnageThisWeek, weight_unit) ?? tonnageThisWeek) / 1000).toFixed(1)}k
              </p>
              <p className="text-[10px] text-[#3A3D45] mt-1">{wu}</p>
            </div>
          </div>
          {setsLastWeek > 0 && (
            <div className="flex items-center gap-1 mt-2 px-1">
              <TrendIcon value={setsThisWeek - setsLastWeek} />
              <span className="text-xs text-[#9BA0A6]">
                {setsThisWeek > setsLastWeek ? "+" : ""}
                {setsThisWeek - setsLastWeek} sets vs last week
              </span>
            </div>
          )}
        </div>

        {/* Workout Consistency */}
        <div>
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3 px-1">
            Consistency
          </p>
          <div className="flex gap-3">
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">This week</p>
              <p className="text-lg font-bold tabular-nums">
                {completedThisWeek}
              </p>
              <p className="text-[10px] text-[#3A3D45] mt-1">workouts</p>
            </div>
            <div className="flex-1 bg-[#121316] border border-[#24262C] rounded-xl p-3">
              <p className="text-xs text-[#5A5F66] mb-1">Last week</p>
              <p className="text-lg font-bold tabular-nums">
                {sessionsLastWeek.length}
              </p>
              <p className="text-[10px] text-[#3A3D45] mt-1">workouts</p>
            </div>
          </div>
        </div>

        {/* Best Lifts */}
        {topPRs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3 px-1">
              Best Lifts (PRs)
            </p>
            <div className="flex flex-col gap-1">
              {topPRs.map((pr) => (
                <div
                  key={pr.exercise_id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#121316] border border-[#24262C]"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {pr.exercise_name}
                    </p>
                    <p className="text-xs text-[#5A5F66]">
                      {formatDateShort(pr.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums">
                      {displayWeight(pr.weight_lbs, weight_unit)}
                      <span className="text-sm text-[#9BA0A6] font-medium ml-1">
                        {wu}
                      </span>
                    </p>
                    <p className="text-xs text-[#C7F23E]">
                      &times;{pr.reps} &middot; e1RM {displayWeight(pr.estimated_1rm, weight_unit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Check-ins */}
        {recentCheckins.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-3 px-1">
              Readiness History
            </p>
            {readinessSeries.length >= 2 && (
              <div className="bg-[#121316] border border-[#24262C] rounded-xl p-3 mb-3">
                <LineTrend data={readinessSeries} unit="score" color="#36D399" domainPad={5} />
              </div>
            )}
            <div className="flex flex-col gap-1">
              {recentCheckins.slice(0, 7).map((ci) => {
                const si = readinessLabel(ci.readiness_score ?? 0);
                return (
                  <div
                    key={ci.id}
                    className="flex items-center justify-between px-4 py-2 rounded-lg bg-[#121316] border border-[#24262C]"
                  >
                    <span className="text-sm">{formatDateShort(ci.date)}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#9BA0A6]">
                        {`\uD83D\uDE34 ${ci.sleep_hours}h \u00B7 \u26A1 ${ci.energy}/5`}
                      </span>
                      <span
                        className="text-sm font-bold tabular-nums"
                        style={{ color: si.color }}
                      >
                        {ci.readiness_score}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {bodyweightLogs.length === 0 &&
          sessions.length === 0 &&
          checkins.length === 0 && (
            <div className="text-center py-12">
              <BarChart3 className="w-10 h-10 text-[#24262C] mx-auto mb-3" />
              <p className="text-[#5A5F66] text-sm">No data yet</p>
              <p className="text-[#3A3D45] text-xs mt-1 max-w-xs mx-auto">
                Log your first workout, check-in, or bodyweight entry to see
                progress here
              </p>
            </div>
          )}
      </div>
    </main>
  );
}
