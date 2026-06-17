"use client";

import { Button } from "@/components/ui/button";
import { formatRestTimer } from "@/lib/utils";

interface RestTimerProps {
  seconds: number;
  onSkip: () => void;
}

export function RestTimer({ seconds, onSkip }: RestTimerProps) {
  return (
    <div className="flex flex-col items-center py-12 gap-4">
      <p className="text-xs font-bold text-[#5A5F66] uppercase tracking-wider">
        Rest
      </p>
      <p className="text-[72px] font-extrabold text-[#C7F23E] tabular-nums leading-none">
        {formatRestTimer(seconds)}
      </p>
      <Button variant="ghost" size="sm" onClick={onSkip}>
        Skip
      </Button>
    </div>
  );
}
