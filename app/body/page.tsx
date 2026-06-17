"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import { generateId, todayISO, formatDateShort, displayWeight, toLbs } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { LineTrend } from "@/components/Chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Scale, Trash2, Plus, X, Ruler, Camera } from "lucide-react";

export default function BodyweightPage() {
  const [seeded, setSeeded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { weight_unit } = useSettings();
  const wu = weight_unit;

  useEffect(() => {
    seedIfNeeded().then(() => setSeeded(true));
  }, []);

  const logs = useLiveQuery(
    () => db.bodyweightLogs.orderBy("date").reverse().toArray(),
    [seeded]
  );

  const handleSubmit = useCallback(async () => {
    const raw = parseFloat(weight);
    if (isNaN(raw) || raw <= 0) {
      setError("Enter a valid weight");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const lbs = Math.round(toLbs(raw, wu) * 10) / 10;
      const existing = await db.bodyweightLogs.where("date").equals(date).first();
      await db.bodyweightLogs.put({
        id: existing?.id ?? generateId(),
        date,
        weight_lbs: lbs,
        source: "manual",
        created_at: existing?.created_at ?? new Date().toISOString(),
      });
      setWeight("");
      setDate(todayISO());
      setShowForm(false);
    } catch (e) {
      console.error("Failed to save bodyweight:", e);
      setError("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  }, [weight, date, wu]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await db.bodyweightLogs.delete(id);
    } catch (e) {
      console.error("Failed to delete bodyweight entry:", e);
    }
  }, []);

  const getDelta = (idx: number): number | null => {
    if (!logs || idx >= logs.length - 1) return null;
    return logs[idx]!.weight_lbs - logs[idx + 1]!.weight_lbs;
  };

  const chartData = (logs ?? [])
    .slice(0, 60)
    .reverse()
    .map((l) => ({
      label: formatDateShort(l.date).replace(/^\w+,?\s*/, ""),
      value: displayWeight(l.weight_lbs, wu) ?? l.weight_lbs,
    }));

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Body</h1>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowForm(!showForm);
              setError(null);
            }}
          >
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? "Cancel" : "Add"}
          </Button>
        </div>

        {/* Sub-nav to measurements + photos */}
        <div className="flex gap-2">
          <span className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#C7F23E]/15 text-[#C7F23E] text-sm font-semibold">
            <Scale className="w-4 h-4" /> Weight
          </span>
          <Link href="/body/measurements" className="flex-1">
            <span className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#121316] border border-[#24262C] text-[#9BA0A6] text-sm font-medium hover:bg-[#1B1D22] transition-colors">
              <Ruler className="w-4 h-4" /> Measure
            </span>
          </Link>
          <Link href="/body/photos" className="flex-1">
            <span className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#121316] border border-[#24262C] text-[#9BA0A6] text-sm font-medium hover:bg-[#1B1D22] transition-colors">
              <Camera className="w-4 h-4" /> Photos
            </span>
          </Link>
        </div>

        {/* Add Form */}
        {showForm && (
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1 block">
                    Weight ({wu})
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder={wu === "kg" ? "84.0" : "185.0"}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    autoFocus
                    className="bg-[#08090A] border-[#24262C] text-lg"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1 block">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={date}
                    max={todayISO()}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-[#08090A] border-[#24262C]"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-[#F2555A] font-medium">{error}</p>}
              <Button onClick={handleSubmit} disabled={saving || !weight} className="w-full">
                <Scale className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Log Weight"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Latest + chart */}
        {logs && logs.length > 0 && (
          <div className="bg-[#121316] border border-[#24262C] rounded-xl p-4">
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1">
              Current
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {displayWeight(logs[0]!.weight_lbs, wu)}
              </span>
              <span className="text-sm text-[#9BA0A6]">{wu}</span>
            </div>
            <p className="text-xs text-[#5A5F66] mt-1">{formatDateShort(logs[0]!.date)}</p>
            {chartData.length >= 2 && (
              <div className="mt-4">
                <LineTrend data={chartData} unit={wu} color="#C7F23E" />
              </div>
            )}
          </div>
        )}

        {/* Empty */}
        {logs && logs.length === 0 && (
          <div className="text-center py-12">
            <Scale className="w-10 h-10 text-[#24262C] mx-auto mb-3" />
            <p className="text-[#5A5F66] text-sm">No entries yet</p>
            <p className="text-[#3A3D45] text-xs mt-1">Tap Add to log your first weight</p>
          </div>
        )}

        {/* History */}
        {logs && logs.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1 mb-2">
              History
            </p>
            {logs.map((entry, idx) => {
              const delta = getDelta(idx);
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#121316] border border-[#24262C]"
                >
                  <p className="text-sm text-[#9BA0A6]">{formatDateShort(entry.date)}</p>
                  <div className="flex items-center gap-3">
                    {delta != null && Math.abs(delta) > 0.0001 && (
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          delta > 0 ? "text-[#F2555A]" : "text-[#36D399]"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {(displayWeight(Math.abs(delta), wu)! * Math.sign(delta)).toFixed(1)} {wu}
                      </span>
                    )}
                    <span className="text-lg font-bold tabular-nums">
                      {displayWeight(entry.weight_lbs, wu)}
                    </span>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-1 hover:bg-[#F2555A]/10 rounded-md transition-colors"
                      aria-label={`Delete entry from ${entry.date}`}
                    >
                      <Trash2 className="w-4 h-4 text-[#5A5F66] hover:text-[#F2555A]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
