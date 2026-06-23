"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { startSessionFromTemplate } from "@/hooks/useWorkout";
import { useStackSafety } from "@/hooks/useStack";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { todayISO, displayWeight } from "@/lib/utils";
import { readinessLabel } from "@/lib/scoring";
import { useTodayBiometrics, useRecentBiometrics } from "@/hooks/useHealth";
import { computeReadiness } from "@/lib/readiness";
import { computeLifestyleScore, type LifestyleInputs } from "@/lib/lifestyleScore";
import { toggleProtocolTask } from "@/lib/protocol";
import { useSettings } from "@/hooks/useSettings";
import { Section } from "@/components/Layout";
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
  Beef,
  Flame,
  Droplet,
  Check,
} from "lucide-react";

export default function DashboardPage() {
  const [seeded, setSeeded] = useState(false);
  const { weight_unit, name } = useSettings();

  useEffect(() => {
    seedIfNeeded().then(() => setSeeded(true));
  }, []);

  const router = useRouter();
  const store = useWorkoutStore();
  const [startingId, setStartingId] = useState<string | null>(null);

  const handleStartSession = async (templateId: string) => {
    if (startingId) return;
    setStartingId(templateId);
    try {
      const result = await startSessionFromTemplate(templateId);
      if (!result) {
        setStartingId(null);
        return;
      }
      store.startWorkout(result.active);
      router.push(`/workout/${result.sessionId}`);
    } catch {
      setStartingId(null);
    }
  };

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
  const stackItems = useLiveQuery(
    () => db.stackItems.filter((s) => s.active).toArray(),
    [seeded]
  );
  const stackLogsToday = useLiveQuery(
    () => db.stackLogs.where("date").equals(today).toArray(),
    [today, seeded]
  );
  const fuel = useLiveQuery(() => db.fuelLogs.where("date").equals(today).first(), [today, seeded]);
  const protocol = useLiveQuery(
    () => db.dailyProtocols.where("date").equals(today).first(),
    [today, seeded]
  );
  const todaySession = useLiveQuery(
    () =>
      db.workoutSessions
        .filter((s) => s.completed_at !== null && s.started_at.slice(0, 10) === today)
        .first(),
    [today, seeded]
  );
  const stackSafety = useStackSafety();

  const latestWeight = weightLogs?.[0] ?? null;
  const previousWeight = weightLogs?.[1] ?? null;
  const weightDelta =
    latestWeight && previousWeight ? latestWeight.weight_lbs - previousWeight.weight_lbs : null;

  const score = checkin?.readiness_score ?? null;
  const checkinScoreInfo = score != null ? readinessLabel(score) : null;

  // If Google Health biometrics exist for today, prefer the data-driven
  // readiness over the self-reported check-in score.
  const todayBio = useTodayBiometrics();
  const recentBio = useRecentBiometrics(30);
  const bioReadiness =
    todayBio && (todayBio.hrv_ms != null || todayBio.resting_hr != null || todayBio.sleep_minutes != null)
      ? computeReadiness(
          todayBio,
          recentBio.filter((b) => b.date < todayBio.date)
        )
      : null;

  const scoreInfo = bioReadiness
    ? { color: bioReadiness.color, label: bioReadiness.label, score: bioReadiness.score }
    : checkinScoreInfo
    ? { color: checkinScoreInfo.color, label: checkinScoreInfo.label, score: score! }
    : null;

  const stackTakenToday = (stackLogsToday ?? []).filter((l) => l.taken).length;
  const suppTotal = stackItems?.length ?? 0;
  const suppDone = stackTakenToday;

  // ── Lifestyle Score (computed from today's data, graceful with gaps) ──
  const proteinHit = !!fuel && fuel.protein_g >= fuel.protein_target_g;
  const caloriesHit = !!fuel && fuel.calories >= fuel.calories_target * 0.9;
  const waterHit = !!fuel && fuel.water_ml >= fuel.water_target_ml;
  // Progress ratios so the score rises as you log each glass/meal.
  const proteinProgress = fuel && fuel.protein_target_g > 0 ? fuel.protein_g / fuel.protein_target_g : 0;
  const caloriesProgress = fuel && fuel.calories_target > 0 ? fuel.calories / fuel.calories_target : 0;
  const waterProgress = fuel && fuel.water_target_ml > 0 ? fuel.water_ml / fuel.water_target_ml : 0;
  const presenceDone = (protocol?.tasks ?? []).some((t) => t.pillar === "presence" && t.completed);
  const careerDone = (protocol?.tasks ?? []).some((t) => t.pillar === "career" && t.completed);
  const mindsetDone = (protocol?.tasks ?? []).some((t) => t.pillar === "mindset" && t.completed);

  const lifestyleInputs: LifestyleInputs = {
    proteinProgress,
    caloriesProgress,
    waterProgress,
    proteinTargetHit: proteinHit,
    caloriesTargetHit: caloriesHit,
    waterTargetHit: waterHit,
    fuelLogged: !!fuel && (fuel.protein_g > 0 || fuel.calories > 0 || fuel.water_ml > 0),
    workoutCompleted: !!todaySession,
    movementDone: !!todaySession,
    sleepHours: checkin?.sleep_hours ?? null,
    checkinCompleted: !!checkin,
    sorenessStressManaged:
      !!checkin && (checkin.soreness ?? 5) <= 6 && checkin.stress <= 6,
    habitsDone: suppTotal > 0 ? suppDone === suppTotal : !!checkin,
    mindsetDone,
    supplementsLogged: suppTotal > 0 && suppDone > 0,
    presenceDone,
    careerDone,
  };
  const lifestyle = computeLifestyleScore(lifestyleInputs);

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

        {/* Lifestyle Score — the daily command center headline */}
        <div className="relative rounded-2xl bg-[#121316] border border-[#24262C] p-5 overflow-hidden">
          <div
            className="absolute top-0 left-0 h-[3px] w-full"
            style={{ background: lifestyle.color, opacity: 0.85 }}
          />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5A5F66]">
                Today&apos;s Lifestyle Score
              </p>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className="text-[52px] leading-none font-extrabold tnums"
                  style={{ color: lifestyle.color }}
                >
                  {lifestyle.score}
                </span>
                <span className="text-sm text-[#5A5F66] font-bold">/100</span>
              </div>
              <p
                className="text-sm font-bold uppercase tracking-wide mt-1"
                style={{ color: lifestyle.color }}
              >
                {lifestyle.label}
              </p>
            </div>
          </div>
          <p className="text-sm text-[#9BA0A6] mt-3 leading-snug">{lifestyle.feedback}</p>

          {/* Pillar chips */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {lifestyle.pillars
              .filter((p) => p.max > 0)
              .map((p) => (
                <span
                  key={p.key}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    color: p.complete ? "#08090A" : "#5A5F66",
                    backgroundColor: p.complete ? "#C7F23E" : "#1B1D22",
                  }}
                >
                  {p.complete && <Check className="w-3 h-3" />}
                  {p.label}
                </span>
              ))}
          </div>
        </div>

        {/* Today's saved protocol */}
        {protocol && protocol.tasks.length > 0 && (
          <Section
            label="Today's Protocol"
            action={
              <Link href="/coach" className="text-[11px] font-semibold text-[#C7F23E]">
                Regenerate
              </Link>
            }
          >
            <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-2">
              {protocol.tasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleProtocolTask(today, t.id)}
                  className="w-full flex items-start gap-3 px-2 py-2.5 rounded-xl active:bg-[#1B1D22] text-left transition-colors"
                >
                  <span
                    className="grid place-items-center h-5 w-5 rounded-md border-2 shrink-0 mt-0.5"
                    style={{
                      borderColor: t.completed ? "#36D399" : "#3A3D45",
                      backgroundColor: t.completed ? "#36D39922" : "transparent",
                    }}
                  >
                    {t.completed && <Check className="w-3.5 h-3.5 text-[#36D399]" />}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`text-sm ${t.completed ? "line-through text-[#5A5F66]" : ""}`}
                    >
                      {t.title}
                    </span>
                    <span className="block text-[9px] font-bold uppercase tracking-wide text-[#5A5F66] mt-0.5">
                      {t.pillar}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {!protocol && (
          <Link
            href="/coach"
            className="flex items-center gap-3 rounded-2xl border border-[#C7F23E]/30 bg-[#C7F23E]/[0.06] p-4 active:bg-[#C7F23E]/10 transition-colors"
          >
            <div className="grid place-items-center h-10 w-10 rounded-full bg-[#C7F23E]/15">
              <ClipboardList className="w-5 h-5 text-[#C7F23E]" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Generate today&apos;s protocol</p>
              <p className="text-xs text-[#9BA0A6]">Your plan for training, fuel, recovery & more</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#5A5F66]" />
          </Link>
        )}

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
              {scoreInfo != null ? (
                <>
                  <p
                    className="text-5xl font-extrabold tnums leading-none mt-2"
                    style={{ color: scoreInfo.color }}
                  >
                    {scoreInfo.score}
                  </p>
                  <p className="text-sm font-bold uppercase tracking-wide mt-1" style={{ color: scoreInfo.color }}>
                    {scoreInfo.label}
                  </p>
                  <p className="text-[10px] text-[#5A5F66] mt-1">
                    {bioReadiness ? "From Fitbit data" : "From check-in"}
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

        {/* Fuel — daily nutrition command center card */}
        <Section
          label="Fuel"
          action={
            <Link href="/fuel" className="text-[11px] font-semibold text-[#C7F23E]">
              Open Fuel
            </Link>
          }
        >
          <Link href="/fuel">
            <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4 flex flex-col gap-3 active:bg-[#1B1D22] transition-colors">
              <FuelStat
                icon={<Beef className="w-4 h-4 text-[#F2555A]" />}
                label="Protein"
                value={fuel?.protein_g ?? 0}
                target={fuel?.protein_target_g ?? 160}
                unit="g"
                color="#F2555A"
              />
              <FuelStat
                icon={<Flame className="w-4 h-4 text-[#F5B83D]" />}
                label="Calories"
                value={fuel?.calories ?? 0}
                target={fuel?.calories_target ?? 2400}
                unit=""
                color="#F5B83D"
              />
              <FuelStat
                icon={<Droplet className="w-4 h-4 text-[#9BCBF2]" />}
                label="Water"
                value={fuel?.water_ml ?? 0}
                target={fuel?.water_target_ml ?? 3000}
                unit="ml"
                color="#9BCBF2"
              />
            </div>
          </Link>
        </Section>

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
                <button
                  key={t.id}
                  onClick={() => handleStartSession(t.id)}
                  disabled={startingId !== null}
                  className="shrink-0 disabled:opacity-50"
                >
                  <div className="rounded-xl bg-[#121316] border border-[#24262C] px-4 py-3 active:bg-[#1B1D22] transition-colors">
                    <p className="text-sm font-semibold whitespace-nowrap">
                      {startingId === t.id ? "Starting…" : t.name}
                    </p>
                  </div>
                </button>
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

        {/* Stack Monitor */}
        <Link href="/stack">
          <div
            className="rounded-2xl bg-[#121316] border p-4 flex items-center justify-between active:bg-[#1B1D22] transition-colors"
            style={{ borderColor: stackSafety?.hasRedFlag ? "#F2555A" : "#24262C" }}
          >
            <div className="flex items-center gap-3">
              <div className="grid place-items-center h-10 w-10 rounded-full bg-[#1B1D22]">
                <Pill className="w-5 h-5 text-[#A78BFA]" />
              </div>
              <div>
                <p className="font-semibold text-sm">Stack Monitor</p>
                <p className="text-xs text-[#5A5F66]">
                  {stackTakenToday} logged today
                </p>
              </div>
            </div>
            {stackSafety && (
              <span
                className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                style={{ color: stackSafety.color, backgroundColor: stackSafety.color + "1A" }}
              >
                {stackSafety.state}
              </span>
            )}
          </div>
        </Link>

        {/* Navigation grid */}
        <Section label="More">
          <div className="grid grid-cols-2 gap-3">
            <NavCard href="/review" icon={CalendarRange} title="Weekly review" sub="Your week at a glance" color="#C7F23E" />
            <NavCard href="/coach" icon={Sparkles} title="AI coach" sub="Ask about your data" color="#A78BFA" />
            <NavCard href="/progress" icon={Dumbbell} title="Progress" sub="PRs, trends & charts" color="#36D399" />
          </div>
        </Section>
      </div>
    </main>
  );
}

function FuelStat({
  icon,
  label,
  value,
  target,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  const hit = value >= target;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#9BA0A6]">
          {icon} {label}
        </span>
        <span className="text-xs tnums">
          <b style={{ color: hit ? "#36D399" : undefined }}>{value}</b>
          <span className="text-[#5A5F66]">
            {" "}
            / {target}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1B1D22] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
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
