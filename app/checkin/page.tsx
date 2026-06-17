"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { generateId, todayISO, formatDateShort } from "@/lib/utils";
import {
  calculateReadinessScore,
  readinessLabel,
} from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RatingSlider } from "@/components/RatingSlider";
import { ArrowLeft, ClipboardList, Trash2, Plus } from "lucide-react";

const METRICS = [
  { key: "sleep_quality" as const, label: "Sleep Quality", labels: ["Poor", "Great"] },
  { key: "energy" as const, label: "Energy", labels: ["Exhausted", "Energized"] },
  { key: "stress" as const, label: "Stress", labels: ["Calm", "Stressed"] },
  { key: "motivation" as const, label: "Motivation", labels: ["None", "Fired Up"] },
  { key: "soreness" as const, label: "Soreness", labels: ["Fresh", "Very Sore"] },
  { key: "appetite" as const, label: "Appetite", labels: ["None", "Ravenous"] },
] as const;

type MetricKey = (typeof METRICS)[number]["key"];

export default function CheckInPage() {
  const [seeded, setSeeded] = useState(false);
  const [sleepHours, setSleepHours] = useState("");
  const [ratings, setRatings] = useState<Record<MetricKey, number>>({
    sleep_quality: 3,
    energy: 3,
    stress: 3,
    motivation: 3,
    soreness: 3,
    appetite: 3,
  });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    seedIfNeeded().then(() => setSeeded(true));
  }, []);

  const today = todayISO();

  const todayCheckin = useLiveQuery(
    () => db.dailyCheckins.where("date").equals(today).first(),
    [today, seeded]
  );

  const allCheckins = useLiveQuery(
    () => db.dailyCheckins.orderBy("date").reverse().toArray(),
    [seeded]
  );

  const handleSubmit = useCallback(async () => {
    const sh = parseFloat(sleepHours);
    if (isNaN(sh) || sh < 0 || sh > 24) {
      setError("Enter valid sleep hours (0–24)");
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const metrics = {
        sleep_hours: sh,
        sleep_quality: ratings.sleep_quality,
        energy: ratings.energy,
        stress: ratings.stress,
        motivation: ratings.motivation,
        soreness: ratings.soreness,
        appetite: ratings.appetite,
      };
      const score = calculateReadinessScore(metrics);

      // Upsert by date: reuse today's existing record id so re-saving
      // overwrites rather than creating a duplicate row for the same day.
      const existing = await db.dailyCheckins.where("date").equals(today).first();
      await db.dailyCheckins.put({
        id: existing?.id ?? generateId(),
        date: today,
        ...metrics,
        readiness_score: score,
        notes: notes.trim() || null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      });
      // Reset form
      setSleepHours("");
      setRatings({
        sleep_quality: 3,
        energy: 3,
        stress: 3,
        motivation: 3,
        soreness: 3,
        appetite: 3,
      });
      setNotes("");
    } catch (e) {
      console.error("Failed to save check-in:", e);
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }, [sleepHours, ratings, notes, today]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await db.dailyCheckins.delete(id);
    } catch (e) {
      console.error("Failed to delete check-in:", e);
    }
  }, []);

  const setRating = useCallback((key: MetricKey, value: number) => {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const score = todayCheckin?.readiness_score ?? null;
  const scoreInfo = score != null ? readinessLabel(score) : null;

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
          <h1 className="text-xl font-bold">Daily Check-In</h1>
        </div>

        {/* Today's Check-In Result */}
        {todayCheckin && scoreInfo && (
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-5 flex items-center gap-5">
              <div
                className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0"
                style={{ backgroundColor: scoreInfo.color + "20" }}
              >
                <span
                  className="text-3xl font-extrabold tabular-nums"
                  style={{ color: scoreInfo.color }}
                >
                  {score}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                  style={{ color: scoreInfo.color }}
                >
                  {scoreInfo.label}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">Today&apos;s Readiness</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[#9BA0A6]">
                  <span>😴 {todayCheckin.sleep_hours}h</span>
                  <span>⚡ {todayCheckin.energy}/5</span>
                  <span>🔥 {todayCheckin.motivation}/5</span>
                  <span>😤 {todayCheckin.stress}/5</span>
                </div>
                {todayCheckin.notes && (
                  <p className="text-xs text-[#5A5F66] mt-1 italic">
                    &ldquo;{todayCheckin.notes}&rdquo;
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check-In Form */}
        {!todayCheckin && (
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-4">
              <p className="text-sm font-semibold text-[#D6D9D6]">
                How are you feeling today?
              </p>

              {/* Sleep Hours */}
              <div>
                <label className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1 block">
                  Sleep Hours
                </label>
                <Input
                  type="number"
                  inputMode="decimal"
                  placeholder="7.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  autoFocus
                  className="bg-[#08090A] border-[#24262C] text-lg"
                />
              </div>

              {/* Rating Sliders */}
              {METRICS.map(({ key, label, labels: rangeLabels }) => (
                <RatingSlider
                  key={key}
                  label={label}
                  value={ratings[key]}
                  onChange={(v) => setRating(key, v)}
                  labels={rangeLabels}
                />
              ))}

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1 block">
                  Notes (optional)
                </label>
                <Input
                  type="text"
                  placeholder="How are you feeling?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-[#08090A] border-[#24262C]"
                />
              </div>

              {error && (
                <p className="text-xs text-[#F2555A] font-medium">{error}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={saving || !sleepHours}
                className="w-full"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Check-In"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Re-Check Button */}
        {todayCheckin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Simulate re-check by clearing today's existing so form re-shows.
              // We don't actually delete — form replaces on put().
              setSleepHours(String(todayCheckin.sleep_hours ?? ""));
              setRatings({
                sleep_quality: todayCheckin.sleep_quality ?? 3,
                energy: todayCheckin.energy,
                stress: todayCheckin.stress,
                motivation: todayCheckin.motivation,
                soreness: todayCheckin.soreness ?? 3,
                appetite: todayCheckin.appetite ?? 3,
              });
              setNotes(todayCheckin.notes ?? "");
              // Delete the old one so the form shows
              handleDelete(todayCheckin.id);
            }}
            className="self-start"
          >
            <Plus className="w-4 h-4 mr-1" />
            Update Check-In
          </Button>
        )}

        {/* History */}
        {allCheckins && allCheckins.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1 mb-2">
              History
            </p>
            {allCheckins.map((ci) => {
              const si = readinessLabel(ci.readiness_score ?? 0);
              return (
                <div
                  key={ci.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#121316] border border-[#24262C]"
                >
                  <div>
                    <p className="text-sm text-[#D6D9D6]">
                      {formatDateShort(ci.date)}
                    </p>
                    <p className="text-xs text-[#9BA0A6]">
                      😴 {ci.sleep_hours}h · ⚡ {ci.energy}/5 · 🔥 {ci.motivation}/5 · 😤 {ci.stress}/5
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: si.color }}
                    >
                      {ci.readiness_score}
                    </span>
                    <button
                      onClick={() => handleDelete(ci.id)}
                      className="p-1 hover:bg-[#F2555A]/10 rounded-md transition-colors"
                      aria-label={`Delete check-in from ${ci.date}`}
                    >
                      <Trash2 className="w-4 h-4 text-[#5A5F66] hover:text-[#F2555A]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {allCheckins && allCheckins.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="w-10 h-10 text-[#24262C] mx-auto mb-3" />
            <p className="text-[#5A5F66] text-sm">No check-ins yet</p>
            <p className="text-[#3A3D45] text-xs mt-1">
              Your first check-in will appear above
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
