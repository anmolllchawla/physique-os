"use client";

import { Button } from "@/components/ui/button";
import { formatRestTimer } from "@/lib/utils";
import { Plus } from "lucide-react";

interface RestTimerProps {
  seconds: number;
  total: number;
  onSkip: () => void;
  onAdd?: () => void;
}

export function RestTimer({ seconds, total, onSkip, onAdd }: RestTimerProps) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(1, seconds / total) : 0;
  const dash = C * pct;

  return (
    <div className="flex flex-col items-center py-8 gap-5 rounded-2xl bg-[#121316] border border-[#24262C]">
      <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-[0.14em]">Rest</p>

      <div className="relative grid place-items-center">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#1B1D22" strokeWidth="8" />
          <circle
            cx="70"
            cy="70"
            r={R}
            fill="none"
            stroke="#C7F23E"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            style={{ transition: "stroke-dasharray 1s linear" }}
          />
        </svg>
        <span className="absolute text-4xl font-extrabold text-[#C7F23E] tabular-nums">
          {formatRestTimer(seconds)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {onAdd && (
          <Button variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> 30s
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip rest
        </Button>
      </div>
    </div>
  );
}
