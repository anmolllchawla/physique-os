"use client";

import { useState } from "react";
import {
  useTodayFuel,
  addFuel,
  updateTodayFuel,
  resetTodayFuel,
  PROTEIN_PRESETS,
  DEFAULT_FUEL_TARGETS,
} from "@/hooks/useFuel";
import { PageHeader, Section } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Droplet, Beef, Flame, RotateCcw, Pencil, Check } from "lucide-react";

function ProgressBar({
  value,
  target,
  color,
}: {
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div className="h-2.5 rounded-full bg-[#1B1D22] overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function FuelPage() {
  const fuel = useTodayFuel();
  const [editTargets, setEditTargets] = useState(false);
  const [manualProtein, setManualProtein] = useState("");
  const [manualCals, setManualCals] = useState("");
  const [notes, setNotes] = useState<string | null>(null);

  const protein = fuel?.protein_g ?? 0;
  const calories = fuel?.calories ?? 0;
  const water = fuel?.water_ml ?? 0;
  const pTarget = fuel?.protein_target_g ?? DEFAULT_FUEL_TARGETS.protein_target_g;
  const cTarget = fuel?.calories_target ?? DEFAULT_FUEL_TARGETS.calories_target;
  const wTarget = fuel?.water_target_ml ?? DEFAULT_FUEL_TARGETS.water_target_ml;

  const notesValue = notes ?? fuel?.notes ?? "";

  const addManual = async () => {
    const p = parseFloat(manualProtein) || 0;
    const c = parseFloat(manualCals) || 0;
    if (p === 0 && c === 0) return;
    await addFuel(p, c);
    setManualProtein("");
    setManualCals("");
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader
        title="Fuel"
        back="/"
        subtitle="Today's nutrition"
        right={
          <button
            onClick={() => setEditTargets((v) => !v)}
            className="flex items-center gap-1 text-sm font-semibold text-[#9BA0A6] active:text-[#C7F23E]"
          >
            <Pencil className="w-4 h-4" /> Targets
          </button>
        }
      />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Targets editor */}
        {editTargets && (
          <div className="rounded-2xl bg-[#121316] border border-[#C7F23E]/30 p-4 grid grid-cols-3 gap-3">
            {[
              { key: "protein_target_g", label: "Protein g", val: pTarget },
              { key: "calories_target", label: "Calories", val: cTarget },
              { key: "water_target_ml", label: "Water ml", val: wTarget },
            ].map((t) => (
              <div key={t.key}>
                <label className="text-[10px] text-[#5A5F66] uppercase font-bold">{t.label}</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  defaultValue={t.val}
                  onBlur={(e) =>
                    updateTodayFuel({ [t.key]: parseInt(e.target.value, 10) || t.val } as never)
                  }
                  className="bg-[#08090A] border-[#24262C] mt-1"
                />
              </div>
            ))}
          </div>
        )}

        {/* Progress */}
        <Section label="Today">
          <div className="flex flex-col gap-4 rounded-2xl bg-[#121316] border border-[#24262C] p-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Beef className="w-4 h-4 text-[#F2555A]" /> Protein
                </span>
                <span className="text-sm tnums">
                  <b style={{ color: protein >= pTarget ? "#36D399" : undefined }}>{protein}</b>
                  <span className="text-[#5A5F66]"> / {pTarget} g</span>
                </span>
              </div>
              <ProgressBar value={protein} target={pTarget} color="#F2555A" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Flame className="w-4 h-4 text-[#F5B83D]" /> Calories
                </span>
                <span className="text-sm tnums">
                  <b>{calories}</b>
                  <span className="text-[#5A5F66]"> / {cTarget}</span>
                </span>
              </div>
              <ProgressBar value={calories} target={cTarget} color="#F5B83D" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <Droplet className="w-4 h-4 text-[#9BCBF2]" /> Water
                </span>
                <span className="text-sm tnums">
                  <b style={{ color: water >= wTarget ? "#36D399" : undefined }}>{water}</b>
                  <span className="text-[#5A5F66]"> / {wTarget} ml</span>
                </span>
              </div>
              <ProgressBar value={water} target={wTarget} color="#9BCBF2" />
              <div className="flex gap-2 mt-2">
                {[250, 500, 750].map((ml) => (
                  <button
                    key={ml}
                    onClick={() => addFuel(0, 0, ml)}
                    className="flex-1 py-1.5 rounded-lg bg-[#1B1D22] text-xs font-bold text-[#9BCBF2] active:bg-[#23262C]"
                  >
                    +{ml}ml
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Quick-add presets */}
        <Section label="Quick add — protein">
          <div className="grid grid-cols-2 gap-2">
            {PROTEIN_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => addFuel(p.protein_g, p.calories)}
                className="flex items-center justify-between rounded-xl bg-[#121316] border border-[#24262C] px-3 py-2.5 active:bg-[#1B1D22] transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-[#5A5F66]">
                    {p.protein_g}g · {p.calories} kcal
                  </p>
                </div>
                <Plus className="w-4 h-4 text-[#C7F23E] shrink-0" />
              </button>
            ))}
          </div>
        </Section>

        {/* Manual add */}
        <Section label="Manual add">
          <div className="flex gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Protein g"
              value={manualProtein}
              onChange={(e) => setManualProtein(e.target.value)}
              className="bg-[#121316] border-[#24262C]"
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Calories"
              value={manualCals}
              onChange={(e) => setManualCals(e.target.value)}
              className="bg-[#121316] border-[#24262C]"
            />
            <Button onClick={addManual} className="shrink-0">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </Section>

        {/* Notes */}
        <Section label="Meal notes">
          <div className="flex gap-2">
            <Input
              placeholder="What did you eat?"
              value={notesValue}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#121316] border-[#24262C]"
            />
            <Button variant="secondary" onClick={() => updateTodayFuel({ notes: notesValue.trim() || null })} className="shrink-0">
              <Check className="w-4 h-4" />
            </Button>
          </div>
        </Section>

        <button
          onClick={() => resetTodayFuel()}
          className="flex items-center justify-center gap-1.5 text-sm text-[#5A5F66] py-2"
        >
          <RotateCcw className="w-4 h-4" /> Reset today
        </button>
      </div>
    </main>
  );
}
