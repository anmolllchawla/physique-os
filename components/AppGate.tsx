"use client";

import { useEffect, useState, useCallback } from "react";
import { Lock, Delete } from "lucide-react";
import {
  shouldLock,
  verifyPin,
  markUnlocked,
  markActive,
  lockNow,
} from "@/lib/lock";

// Wraps the app. While locked, renders the PIN pad instead of children.
export function AppGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [locked, setLocked] = useState(false);

  // Initial check on mount.
  useEffect(() => {
    let cancelled = false;
    shouldLock().then((l) => {
      if (cancelled) return;
      setLocked(l);
      setChecked(true);
      if (!l) markActive();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Track activity + re-lock when returning after being away too long.
  useEffect(() => {
    const onActivity = () => {
      if (!locked) markActive();
    };
    const onVisible = async () => {
      if (document.visibilityState === "visible" && !locked) {
        if (await shouldLock()) {
          lockNow();
          setLocked(true);
        }
      } else if (document.visibilityState === "hidden") {
        markActive();
      }
    };
    window.addEventListener("pointerdown", onActivity);
    window.addEventListener("keydown", onActivity);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [locked]);

  const handleUnlock = useCallback(() => {
    markUnlocked();
    setLocked(false);
  }, []);

  // Avoid a flash of content before the lock check resolves.
  if (!checked) {
    return <div className="min-h-screen bg-[#08090A]" />;
  }

  if (locked) {
    return <LockScreen onUnlock={handleUnlock} />;
  }

  return <>{children}</>;
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const submit = useCallback(
    async (code: string) => {
      const ok = await verifyPin(code);
      if (ok) {
        onUnlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setTimeout(() => {
          setPin("");
          setError(false);
        }, 600);
      }
    },
    [onUnlock]
  );

  const press = (d: string) => {
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    // Auto-submit at 6; user can also submit shorter PINs via the check key.
    if (next.length === 6) submit(next);
  };

  const back = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  // Allow hardware keyboard on desktop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter" && pin.length >= 4) submit(pin);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#08090A] flex flex-col items-center justify-center px-8">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-[#C7F23E]/10 border border-[#C7F23E]/30 mb-6">
        <Lock className="w-6 h-6 text-[#C7F23E]" />
      </div>
      <h1 className="text-lg font-bold">Enter PIN</h1>
      <p className="text-xs text-[#5A5F66] mt-1 mb-8">PhysiqueOS is locked</p>

      {/* dots */}
      <div className={`flex gap-3 mb-10 ${shake ? "animate-[shake_0.4s]" : ""}`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="h-3.5 w-3.5 rounded-full border-2 transition-colors"
            style={{
              borderColor: error ? "#F2555A" : i < pin.length ? "#C7F23E" : "#3A3D45",
              backgroundColor: i < pin.length ? (error ? "#F2555A" : "#C7F23E") : "transparent",
            }}
          />
        ))}
      </div>

      {/* keypad */}
      <div className="grid grid-cols-3 gap-4">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        {pin.length >= 4 ? (
          <Key onClick={() => submit(pin)}>
            <span className="text-[#C7F23E] text-sm font-bold">OK</span>
          </Key>
        ) : (
          <span />
        )}
        <Key onClick={() => press("0")}>0</Key>
        <Key onClick={back}>
          <Delete className="w-5 h-5 text-[#9BA0A6]" />
        </Key>
      </div>

      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}`}</style>
    </div>
  );
}

function Key({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="grid place-items-center h-16 w-16 rounded-full bg-[#121316] border border-[#24262C] text-2xl font-semibold tabular-nums active:bg-[#1B1D22] transition-colors"
    >
      {children}
    </button>
  );
}
