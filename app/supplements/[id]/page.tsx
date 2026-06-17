"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSupplementLogs, deleteSupplement, updateSupplement, toggleSupplementTaken } from "@/hooks/useSupplements";
import { todayISO, formatDateShort } from "@/lib/utils";
import { PageHeader, Section, StatTile, Pill } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { Trash2, Archive } from "lucide-react";

const CAT_COLOR: Record<string, string> = {
  supplement: "#36D399",
  peptide: "#A78BFA",
  medication: "#F5B83D",
  other: "#9BA0A6",
};

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export default function SupplementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const supp = useLiveQuery(() => db.supplements.get(id), [id]);
  const logs = useSupplementLogs(id);
  const takenDates = new Set(logs.filter((l) => l.taken).map((l) => l.date));

  if (supp === undefined) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center">
        <p className="text-[#9BA0A6] animate-pulse">Loading…</p>
      </main>
    );
  }
  if (supp === null) {
    return (
      <main className="min-h-screen bg-[#08090A] grid place-items-center px-4 text-center gap-3">
        <p className="text-[#9BA0A6]">This item no longer exists.</p>
        <Button onClick={() => router.push("/supplements")}>Back to Supplements</Button>
      </main>
    );
  }

  const days90 = lastNDates(90);
  const days30 = lastNDates(30);
  const taken30 = days30.filter((d) => takenDates.has(d)).length;
  const taken7 = lastNDates(7).filter((d) => takenDates.has(d)).length;

  // Current streak (consecutive days up to today marked taken).
  let streak = 0;
  for (const d of [...days90].reverse()) {
    if (takenDates.has(d)) streak++;
    else break;
  }

  const color = CAT_COLOR[supp.category] ?? "#9BA0A6";

  const handleDelete = async () => {
    await deleteSupplement(id);
    router.push("/supplements");
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-28">
      <PageHeader title={supp.name} back="/supplements" subtitle={supp.schedule ?? undefined} />

      <div className="max-w-lg mx-auto px-4 pt-5 flex flex-col gap-6 animate-fade-up">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <Pill color={color}>{supp.category}</Pill>
          {supp.dose && <Pill color="#9BA0A6">{supp.dose}</Pill>}
          {supp.is_active ? (
            <Pill color="#36D399">Active</Pill>
          ) : (
            <Pill color="#5A5F66">Archived</Pill>
          )}
        </div>

        {supp.notes && (
          <p className="text-sm text-[#9BA0A6] bg-[#121316] border border-[#24262C] rounded-xl p-3">
            {supp.notes}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-3">
          <StatTile label="Streak" value={streak} unit="days" accent="#C7F23E" />
          <StatTile label="7-day" value={`${taken7}/7`} accent="#36D399" />
          <StatTile label="30-day" value={`${Math.round((taken30 / 30) * 100)}%`} accent="#A78BFA" />
        </div>

        {/* Adherence heatmap (90 days) */}
        <Section label="Adherence · last 90 days">
          <div className="rounded-2xl bg-[#121316] border border-[#24262C] p-4">
            <div className="grid grid-flow-col grid-rows-7 gap-1 justify-start auto-cols-min">
              {days90.map((d) => {
                const on = takenDates.has(d);
                const isToday = d === todayISO();
                return (
                  <button
                    key={d}
                    onClick={() => toggleSupplementTaken(id, d, !on)}
                    title={`${formatDateShort(d)}${on ? " · taken" : ""}`}
                    className="h-4 w-4 rounded-[4px] transition-colors"
                    style={{
                      backgroundColor: on ? color : "#1B1D22",
                      outline: isToday ? `1.5px solid ${color}` : "none",
                      outlineOffset: "1px",
                    }}
                  />
                );
              })}
            </div>
            <p className="text-[11px] text-[#5A5F66] mt-3">
              Tap any square to toggle. Top-left is oldest, bottom-right is today.
            </p>
          </div>
        </Section>

        {/* Actions */}
        <Section label="Manage">
          <div className="flex flex-col gap-2">
            {supp.is_active ? (
              <Button
                variant="secondary"
                onClick={() => updateSupplement(id, { is_active: false, end_date: todayISO() })}
              >
                <Archive className="w-4 h-4 mr-2" /> Archive (stop tracking)
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => updateSupplement(id, { is_active: true, end_date: null })}
              >
                Resume tracking
              </Button>
            )}

            {!confirmDelete ? (
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete permanently
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={handleDelete}>
                  Yes, delete everything
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Section>
      </div>

      <BottomNav />
    </main>
  );
}
