"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { todayISO, displayWeight } from "@/lib/utils";
import { readinessLabel } from "@/lib/scoring";
import { useSettings } from "@/hooks/useSettings";
import { Section } from "@/components/Layout";
import { BottomNav } from "@/components/BottomNav";
import {
  Dumbbell,
  ClipboardList,
  Pill,
  CalendarRange,
  Settings as SettingsIcon,
  Scale,
  Moon,
  ChevronRight,
  Plus,
  Sparkles,
} from "lucide-react";

export default function DashboardPage() {
  const [seeded, setSeeded] = useState(false);
  const { weight_unit, name } = useSettings();

  useEffect(() => {
    seedIfNeeded().then(() => setSeeded(true));
  }, []);

  const today = todayISO();

  const checkin = useLiveQuery(
    () => db.dailyCheckins.where("date").equals(today).first(),
    [today, seeded]
  );
  const weightLogs = useLiveQuery(
    () => db.bodyweightLogs.orderBy("date").reverse().limit(2).toArray(),
    [seeded]
  );
  const activeSession = useLiveQuery(
    () => db.workoutSessions.filter((s) => s.completed_at === null).first(),
    [seeded]
  );
  const templates = useLiveQuery(() => db.workoutTemplates.toArray(), [seeded]);
  const activeSupps = useLiveQuery(
    () => db.supplements.filter((s) => s.is_active).toArray(),
    [seeded]
  );
  const suppLogsToday = useLiveQuery(
    () => db.supplementLogs.where("date").equals(today).toArray(),
    [today, seeded]
  );

  const latestWeight = weightLogs?.[0] ?? null;
  const previousWeight = weightLogs?.[1] ?? null;
  const weightDelta =
    latestWeight && previousWeight ? latestWeight.weight_lbs - previousWeight.weight_lbs : null;

  const score = checkin?.readiness_score ?? null;
  const scoreInfo = score != null ? readinessLabel(score) : null;

  const suppTaken = new Set((suppLogsToday ?? []).filter((l) => l.taken).map((l) => l.supplement_id));
  const suppDone = (activeSupps ?? []).filter((s) => suppTaken.has(s.id)).length;
  const suppTotal = activeSupps?.length ?? 0;

  const greeting = () => {
    const h = new Date().getHours();
    const base = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    return name ? `${base}, ${name}` : base;
  };
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <div className="max-w-lg mx-auto px-4 pt-[max(env(safe-area-inset-top),1.5rem)] flex flex-col gap-6 animate-fade-up">
        {/* Header */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C7F23E]">
              {dateLabel}
            </p>
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight mt-1">
              {greeting()}
            </h1>
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid place-items-center h-10 w-10 rounded-full bg-[#121316] border border-[#24262C] text-[#9BA0A6] active:bg-[#1B1D22]"
          >
            <SettingsIcon className="w-5 h-5" />
          </Link>
        </div>

        {/* Readiness hero */}
        <Link
          href="/checkin"
          className="relative rounded-2xl bg-[#121316] border border-[#24262C] p-5 overflow-hidden active:bg-[#1B1D22] transition-colors"
        >
          <div
            className="absolute top-0 left-0 h-[3px] w-full"
            style={{ background: scoreInfo?.color ?? "#24262C", opacity: scoreInfo ? 0.8 : 1 }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5A5F66]">
                Readiness
              </p>
              {score != null ? (
                <>
                  <p
                    className="text-5xl font-extrabold tnums leading-none mt-2"
                    style={{ color: scoreInfo!.color }}
                  >
                    {score}
                  </p>
                  <p className="text-sm font-bold uppercase tracking-wide mt-1" style={{ color: scoreInfo!.color }}>
                    {scoreInfo!.label}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold mt-2 text-[#9BA0A6]">Not checked in</p>
                  <p className="text-sm text-[#5A5F66] mt-1 flex items-center gap-1">
                    Tap to start today&apos;s check-in <ChevronRight className="w-4 h-4" />
                  </p>
                </>
              )}
            </div>
            <div className="grid place-items-center h-12 w-12 rounded-full bg-[#1B1D22]">
              <ClipboardList className="w-5 h-5 text-[#9BA0A6]" />
            </div>
          </div>
        </Link>

        {/* Quick metrics */}
        <div className="flex gap-3">
          <Link href="/body" className="flex-1">
            <div className="relative rounded-2xl bg-[#121316] border border-[#24262C] p-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9BA0A6]">
                  Weight
                </p>
                <Scale className="w-4 h-4 text-[#5A5F66]" />
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-[26px] leading-none font-extrabold tnums">
                  {displayWeight(latestWeight?.weight_lbs ?? null, weight_unit) ?? "—"}
                </span>
                <span className="text-xs text-[#5A5F66] font-semibold">{weight_unit}</span>
              </div>
              {weightDelta != null && Math.abs(weightDelta) > 0.0001 ? (
                <p
                  className="text-[11px] font-bold mt-1.5"
                  style={{ color: weightDelta > 0 ? "#F5B83D" : "#36D399" }}
                >
                  {weightDelta > 0 ? "▲" : "▼"}{" "}
                  {Math.abs(displayWeight(Math.abs(weightDelta), weight_unit)!).toFixed(1)} {weight_unit}
                </p>
              ) : (
                <p className="text-[11px] text-[#5A5F66] mt-1.5">Tap to log</p>
              )}
            </div>
          </Link>

          <Link href="/checkin" className="flex-1">
            <div className="relative rounded-2xl bg-[#121316] border border-[#24262C] p-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9BA0A6]">
                  Sleep
                </p>
                <Moon className="w-4 h-4 text-[#5A5F66]" />
              </div>
              <div className="flex items-baseline gap-1 mt-2">
                <span
                  className="text-[26px] leading-none font-extrabold tnums"
                  style={{ color: (checkin?.sleep_hours ?? 0) >= 7 ? "#36D399" : undefined }}
                >
                  {checkin?.sleep_hours ?? "—"}
                </span>
                <span className="text-xs text-[#5A5F66] font-semibold">hrs</span>
              </div>
              <p className="text-[11px] text-[#5A5F66] mt-1.5">
                {checkin?.sleep_hours != null
                  ? (checkin.sleep_hours >= 7 ? "Well rested" : "Light night")
                  : "Log in check-in"}
              </p>
            </div>
          </Link>
        </div>

        {/* Active workout OR quick start */}
        {activeSession ? (
          <Link href={`/workout/${activeSession.id}`}>
            <div className="rounded-2xl border border-[#C7F23E]/40 bg-[#C7F23E]/[0.07] p-4 flex items-center justify-between glow-accent">
              <div>
                <p className="text-[11px] font-bold text-[#C7F23E] uppercase tracking-[0.14em]">
                  In progress
                </p>
                <p className="text-lg font-bold mt-1">{activeSession.name}</p>
              </div>
              <div className="grid place-items-center h-11 w-11 rounded-full bg-[#C7F23E] text-[#08090A]">
                <Dumbbell className="w-5 h-5" />
              </div>
            </div>
          </Link>
        ) : (
          <Section label="Start a session">
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
              {(templates ?? []).slice(0, 6).map((t) => (
                <Link key={t.id} href="/workout" className="shrink-0">
                  <div className="rounded-xl bg-[#121316] border border-[#24262C] px-4 py-3 active:bg-[#1B1D22] transition-colors">
                    <p className="text-sm font-semibold whitespace-nowrap">{t.name}</p>
                  </div>
                </Link>
              ))}
              <Link href="/workout/templates" className="shrink-0">
                <div className="rounded-xl border border-dashed border-[#3A3D45] px-4 py-3 flex items-center gap-1.5 text-[#9BA0A6]">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-semibold whitespace-nowrap">New</span>
                </div>
              </Link>
            </div>
          </Section>
        )}

        {/* Supplements today */}
        {suppTotal > 0 && (
          <Link href="/supplements">
            <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex items-center justify-between active:bg-[#1B1D22] transition-colors">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center h-10 w-10 rounded-full bg-[#1B1D22]">
                  <Pill className="w-5 h-5 text-[#A78BFA]" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Supplements</p>
                  <p className="text-xs text-[#5A5F66]">
                    {suppDone} of {suppTotal} taken today
                  </p>
                </div>
              </div>
              <span className="text-lg font-extrabold tnums" style={{ color: suppDone === suppTotal ? "#36D399" : "#C7F23E" }}>
                {Math.round((suppDone / suppTotal) * 100)}%
              </span>
            </div>
          </Link>
        )}

        {/* Navigation grid */}
        <Section label="More">
          <div className="grid grid-cols-2 gap-3">
            <NavCard href="/review" icon={CalendarRange} title="Weekly review" sub="Your week at a glance" color="#C7F23E" />
            <NavCard href="/coach" icon={Sparkles} title="AI coach" sub="Ask about your data" color="#A78BFA" />
            <NavCard href="/progress" icon={Dumbbell} title="Progress" sub="PRs, trends & charts" color="#36D399" />
            {suppTotal === 0 && (
              <NavCard href="/supplements" icon={Pill} title="Supplements" sub="Track adherence" color="#F5B83D" />
            )}
          </div>
        </Section>
      </div>

      <BottomNav />
    </main>
  );
}

function NavCard({
  href,
  icon: Icon,
  title,
  sub,
  color,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 h-full active:bg-[#1B1D22] transition-colors">
        <div
          className="grid place-items-center h-9 w-9 rounded-full mb-3"
          style={{ backgroundColor: color + "1A" }}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <p className="font-semibold text-sm" style={{ color }}>
          {title}
        </p>
        <p className="text-[11px] text-[#5A5F66] mt-0.5">{sub}</p>
      </div>
    </Link>
  );
}
