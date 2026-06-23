"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { buildSnapshot, pushToGitHub, githubStatus } from "@/lib/backup";

const DEBOUNCE_MS = 6000; // push ~6s after the last change

// Mounts invisibly. When any data table changes, it schedules a debounced
// backup to GitHub (only if GitHub sync is configured). Shows a tiny status
// pill while syncing so you know it's working.
export function AutoBackup() {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const dirtyWhileSaving = useRef(false);

  // Only run if GitHub sync is configured on the server.
  useEffect(() => {
    githubStatus()
      .then((s) => setEnabled(!!s.configured))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const doBackup = async () => {
      if (inFlight.current) {
        dirtyWhileSaving.current = true;
        return;
      }
      inFlight.current = true;
      setStatus("saving");
      try {
        const snap = await buildSnapshot();
        const res = await pushToGitHub(snap);
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      } finally {
        inFlight.current = false;
        if (dirtyWhileSaving.current) {
          dirtyWhileSaving.current = false;
          schedule();
        } else {
          setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2500);
        }
      }
    };

    const schedule = () => {
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(doBackup, DEBOUNCE_MS);
    };

    // Dexie fires a hook on every create/update/delete across all tables.
    const onChange = () => schedule();

    // Dexie fires CRUD hooks per record. We only care that *something*
    // changed, so each hook just triggers the debounced scheduler.
    // Signatures are cast loosely because we ignore the hook arguments.
    type AnyTable = {
      hook: (
        event: "creating" | "updating" | "deleting",
        fn: (...args: unknown[]) => void
      ) => void;
    };
    const tables = [
      db.workoutSessions,
      db.exerciseLogs,
      db.dailyCheckins,
      db.bodyweightLogs,
      db.measurements,
      db.progressPhotos,
      db.supplements,
      db.supplementLogs,
      db.workoutTemplates,
      db.templateExercises,
      db.exercises,
      db.fuelLogs,
      db.dailyProtocols,
      db.stackItems,
      db.stackLogs,
      db.stackCheckIns,
      db.labMarkers,
      db.biometrics,
    ] as unknown as AnyTable[];

    const handler = () => onChange();
    const events: ("creating" | "updating" | "deleting")[] = [
      "creating",
      "updating",
      "deleting",
    ];
    for (const t of tables) {
      for (const ev of events) t.hook(ev, handler);
    }
    const unsubAll = () => {
      for (const t of tables) {
        for (const ev of events) {
          const h = (t as unknown as {
            hook: (e: string) => { unsubscribe: (fn: unknown) => void };
          }).hook(ev);
          h.unsubscribe(handler);
        }
      }
    };

    // Flush a pending backup if the user leaves.
    const onHide = () => {
      if (document.visibilityState === "hidden" && status === "pending") {
        if (timer.current) clearTimeout(timer.current);
        void doBackup();
      }
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      unsubAll();
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled || status === "idle") return null;

  const label =
    status === "pending"
      ? "Changes pending…"
      : status === "saving"
        ? "Backing up…"
        : status === "saved"
          ? "Backed up"
          : "Backup failed";
  const color = status === "error" ? "#F2555A" : status === "saved" ? "#36D399" : "#9BA0A6";

  return (
    <div
      className="fixed top-[max(env(safe-area-inset-top),0.5rem)] left-1/2 -translate-x-1/2 z-[80] flex items-center gap-1.5 rounded-full bg-[#121316]/90 backdrop-blur border border-[#24262C] px-3 py-1 text-[11px] font-semibold pointer-events-none"
      style={{ color }}
    >
      {status === "saving" && (
        <span className="h-2.5 w-2.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {status === "saved" && <span>✓</span>}
      {label}
    </div>
  );
}
