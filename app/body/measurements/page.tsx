"use client";

import { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { db, type MeasurementLog } from "@/lib/db";
import { generateId, todayISO, formatDateShort, inToCm, cmToIn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Ruler, Trash2, Plus, X } from "lucide-react";

const FIELDS: { key: keyof MeasurementLog; label: string }[] = [
  { key: "neck_in", label: "Neck" },
  { key: "shoulders_in", label: "Shoulders" },
  { key: "chest_in", label: "Chest" },
  { key: "waist_in", label: "Waist" },
  { key: "hips_in", label: "Hips" },
  { key: "left_arm_in", label: "Left Arm" },
  { key: "right_arm_in", label: "Right Arm" },
  { key: "left_thigh_in", label: "Left Thigh" },
  { key: "right_thigh_in", label: "Right Thigh" },
  { key: "left_calf_in", label: "Left Calf" },
  { key: "right_calf_in", label: "Right Calf" },
];

type FormState = Record<string, string>;

export default function MeasurementsPage() {
  const { measurement_unit } = useSettings();
  const mu = measurement_unit;
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [form, setForm] = useState<FormState>({});
  const [bodyFat, setBodyFat] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const logs = useLiveQuery(
    () => db.measurements.orderBy("date").reverse().toArray(),
    []
  );

  useEffect(() => {
    // Prefill from latest entry to make editing easy.
    if (showForm && logs && logs.length > 0) {
      const last = logs[0]!;
      const next: FormState = {};
      for (const f of FIELDS) {
        const v = last[f.key] as number | null;
        if (v != null) next[f.key] = String(mu === "cm" ? inToCm(v) : v);
      }
      setForm(next);
    }
  }, [showForm]); // eslint-disable-line react-hooks/exhaustive-deps

  const toIn = (v: string): number | null => {
    const n = parseFloat(v);
    if (isNaN(n) || n <= 0) return null;
    return mu === "cm" ? cmToIn(n) : Math.round(n * 10) / 10;
  };
  const fromIn = (v: number | null): string => {
    if (v == null) return "—";
    return String(mu === "cm" ? inToCm(v) : Math.round(v * 10) / 10);
  };

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      const existing = await db.measurements.where("date").equals(date).first();
      const record: MeasurementLog = {
        id: existing?.id ?? generateId(),
        date,
        neck_in: toIn(form.neck_in ?? ""),
        shoulders_in: toIn(form.shoulders_in ?? ""),
        chest_in: toIn(form.chest_in ?? ""),
        waist_in: toIn(form.waist_in ?? ""),
        hips_in: toIn(form.hips_in ?? ""),
        left_arm_in: toIn(form.left_arm_in ?? ""),
        right_arm_in: toIn(form.right_arm_in ?? ""),
        left_thigh_in: toIn(form.left_thigh_in ?? ""),
        right_thigh_in: toIn(form.right_thigh_in ?? ""),
        left_calf_in: toIn(form.left_calf_in ?? ""),
        right_calf_in: toIn(form.right_calf_in ?? ""),
        body_fat_pct: bodyFat ? Math.round(parseFloat(bodyFat) * 10) / 10 : null,
        notes: notes.trim() || null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      };
      await db.measurements.put(record);
      setForm({});
      setBodyFat("");
      setNotes("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }, [date, form, bodyFat, notes, mu]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: string) => {
    await db.measurements.delete(id);
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/body">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Measurements</h1>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            {showForm ? "Cancel" : "Add"}
          </Button>
        </div>

        {showForm && (
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div>
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
              <div className="grid grid-cols-2 gap-2">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="text-[11px] font-semibold text-[#9BA0A6] mb-1 block">
                      {f.label} ({mu})
                    </label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="—"
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="bg-[#08090A] border-[#24262C]"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-semibold text-[#9BA0A6] mb-1 block">
                    Body Fat (%)
                  </label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="—"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                    className="bg-[#08090A] border-[#24262C]"
                  />
                </div>
              </div>
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-[#08090A] border-[#24262C]"
              />
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                <Ruler className="w-4 h-4 mr-2" />
                {saving ? "Saving…" : "Save Measurements"}
              </Button>
            </CardContent>
          </Card>
        )}

        {logs && logs.length === 0 && (
          <div className="text-center py-12">
            <Ruler className="w-10 h-10 text-[#24262C] mx-auto mb-3" />
            <p className="text-[#5A5F66] text-sm">No measurements yet</p>
            <p className="text-[#3A3D45] text-xs mt-1">
              Track circumferences to see how your physique changes
            </p>
          </div>
        )}

        {logs && logs.length > 0 && (
          <div className="flex flex-col gap-3">
            {logs.map((m) => {
              const present = FIELDS.filter((f) => m[f.key] != null);
              return (
                <Card key={m.id} className="bg-[#121316] border-[#24262C]">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold">{formatDateShort(m.date)}</p>
                      <div className="flex items-center gap-3">
                        {m.body_fat_pct != null && (
                          <span className="text-xs font-bold text-[#A78BFA]">
                            {m.body_fat_pct}% BF
                          </span>
                        )}
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1 hover:bg-[#F2555A]/10 rounded-md transition-colors"
                          aria-label="Delete measurement"
                        >
                          <Trash2 className="w-4 h-4 text-[#5A5F66] hover:text-[#F2555A]" />
                        </button>
                      </div>
                    </div>
                    {present.length > 0 ? (
                      <div className="grid grid-cols-3 gap-y-2 gap-x-2">
                        {present.map((f) => (
                          <div key={f.key}>
                            <p className="text-[10px] text-[#5A5F66] uppercase">{f.label}</p>
                            <p className="text-sm font-bold tabular-nums">
                              {fromIn(m[f.key] as number | null)}
                              <span className="text-[10px] text-[#5A5F66] ml-0.5">{mu}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#5A5F66]">Body fat only</p>
                    )}
                    {m.notes && (
                      <p className="text-xs text-[#9BA0A6] mt-3 italic">{m.notes}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
