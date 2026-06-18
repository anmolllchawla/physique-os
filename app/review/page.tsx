"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  summarizeWeek,
  suggestNextWorkout,
  type WeekSummary,
} from "@/lib/agent";
import { useSettings } from "@/hooks/useSettings";
import { formatDateShort, formatDuration, displayWeight } from "@/lib/utils";
import { readinessLabel } from "@/lib/scoring";
import { PageHeader, Section, StatTile } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight } from "lucide-react";

function endOfWeekLabel(startISO: string): string {
  const d = new Date(startISO);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function WeeklyReviewPage() {
  const { weight_unit } = useSettings();
  const wu = weight_unit;
  const [offset, setOffset] = useState(0); // 0 = current week
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [prevWeek, setPrevWeek] = useState<WeekSummary | null>(null);
  const [next, setNext] = useState<Awaited<ReturnType<typeof suggestNextWorkout>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      summarizeWeek(offset),
      summarizeWeek(offset + 1),
      suggestNextWorkout(),
    ]).then(([w, p, n]) => {
      if (cancelled) return;
      setWeek(w);
      setPrevWeek(p);
      setNext(n);
    });
    return () => {
      cancelled = true;
    };
  }, [offset]);

  const delta = (cur: number, prev: number) => {
    const d = cur - prev;
    if (d === 0) return { txt: "same", color: "#5A5F66" };
    return {
      txt: `${d > 0 ? "+" : ""}${d}`,
      color: d > 0 ? "#36D399" : "#F2555A",
    };
  };

  const title =
    offset === 0 ? "This Week" : offset === 1 ? "Last Week" : `${offset} Weeks Ago`;

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader
        title="Weekly Review"
        back="/"
        subtitle={week ? `${formatDateShort(week.week_start)} – ${formatDateShort(endOfWeekLabel(week.week_start))}` : undefined}
      />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Week switcher */}
        <div className="flex items-center justify-between rounded-2xl bg-[#121316] border border-[#24262C] p-2">
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="grid place-items-center h-9 w-9 rounded-full text-[#9BA0A6] active:bg-[#1B1D22]"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold">{title}</span>
          <button
            onClick={() => setOffset((o) => Math.max(0, o - 1))}
            disabled={offset === 0}
            className="grid place-items-center h-9 w-9 rounded-full text-[#9BA0A6] active:bg-[#1B1D22] disabled:opacity-30"
            aria-label="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {!week ? (
          <p className="text-center text-[#5A5F66] py-10 animate-pulse">Crunching the week…</p>
        ) : week.workouts === 0 && week.checkins === 0 && week.total_sets === 0 ? (
          <div className="text-center py-12">
            <p className="text-[#9BA0A6]">Nothing logged this week.</p>
            <p className="text-xs text-[#3A3D45] mt-1">
              Train, check in, or log your weight and it&apos;ll show up here.
            </p>
          </div>
        ) : (
          <>
            {/* Headline grid */}
            <div className="flex gap-3">
              <StatTile
                label="Workouts"
                value={week.workouts}
                sub={
                  prevWeek && (
                    <span style={{ color: delta(week.workouts, prevWeek.workouts).color }}>
                      {delta(week.workouts, prevWeek.workouts).txt} vs prev
                    </span>
                  )
                }
              />
              <StatTile
                label="Sets"
                value={week.total_sets}
                accent="#A78BFA"
                sub={
                  prevWeek && (
                    <span style={{ color: delta(week.total_sets, prevWeek.total_sets).color }}>
                      {delta(week.total_sets, prevWeek.total_sets).txt} vs prev
                    </span>
                  )
                }
              />
            </div>

            <div className="flex gap-3">
              <StatTile
                label="Volume"
                value={`${((displayWeight(week.total_volume_lbs, wu) ?? week.total_volume_lbs) / 1000).toFixed(1)}k`}
                unit={wu}
                accent="#C7F23E"
              />
              <StatTile
                label="Time"
                value={week.duration_sec ? formatDuration(week.duration_sec) : "—"}
                accent="#36D399"
              />
            </div>

            {/* Readiness + weight */}
            <div className="flex gap-3">
              <StatTile
                label="Avg readiness"
                value={week.avg_readiness ?? "—"}
                unit={week.avg_readiness != null ? readinessLabel(week.avg_readiness).label : undefined}
                accent={week.avg_readiness != null ? readinessLabel(week.avg_readiness).color : undefined}
                sub={`${week.checkins} check-ins`}
              />
              <StatTile
                label="Weight Δ"
                value={
                  week.weight_change_lbs != null
                    ? `${week.weight_change_lbs > 0 ? "+" : ""}${(displayWeight(Math.abs(week.weight_change_lbs), wu)! * Math.sign(week.weight_change_lbs)).toFixed(1)}`
                    : "—"
                }
                unit={week.weight_change_lbs != null ? wu : undefined}
                accent="#9BA0A6"
              />
            </div>

            {/* Supplement adherence */}
            {week.supplement_adherence_pct != null && (
              <Section label="Supplements">
                <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[#9BA0A6]">Weekly adherence</span>
                    <span className="text-lg font-extrabold tnums text-[#C7F23E]">
                      {week.supplement_adherence_pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1B1D22] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#C7F23E] transition-all"
                      style={{ width: `${week.supplement_adherence_pct}%` }}
                    />
                  </div>
                </div>
              </Section>
            )}

            {/* Best session */}
            {week.best_session && (
              <Section label="Best session">
                <Link
                  href={`/history/${week.best_session.id}`}
                  className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex items-center justify-between active:bg-[#1B1D22] transition-colors"
                >
                  <div>
                    <p className="font-semibold">{week.best_session.name}</p>
                    <p className="text-xs text-[#5A5F66]">
                      {(displayWeight(week.best_session.volume, wu) ?? week.best_session.volume).toLocaleString()} {wu} volume
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#5A5F66]" />
                </Link>
              </Section>
            )}

            {/* Looking ahead (only on current week) */}
            {offset === 0 && next?.template_name && (
              <Section label="Up next">
                <Link
                  href="/workout"
                  className="rounded-2xl border border-[#C7F23E]/30 bg-[#C7F23E]/[0.06] p-4 flex items-center justify-between active:bg-[#C7F23E]/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-[#C7F23E]" />
                    <div>
                      <p className="font-semibold">{next.template_name}</p>
                      <p className="text-xs text-[#9BA0A6]">{next.reason}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#C7F23E]" />
                </Link>
              </Section>
            )}

            {/* Ask the coach */}
            <Link href="/coach">
              <Button variant="secondary" className="w-full">
                <Sparkles className="w-4 h-4 mr-2" /> Ask the coach about this week
              </Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
