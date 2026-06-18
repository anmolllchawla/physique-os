"use client";

import { useEffect, useState, useCallback } from "react";
import { Lock, Loader2 } from "lucide-react";
import {
  isVaultEnabled,
  isLocked,
  setSessionPassphrase,
  markActive,
  lockNow,
} from "@/lib/vault";
import { pullRawFromGitHub, restoreSnapshot, type Snapshot } from "@/lib/backup";
import { decryptData, isEncryptedBlob, WrongPassphraseError } from "@/lib/crypto";
import { db } from "@/lib/db";

export function AppGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<"checking" | "open" | "locked">("checking");

  const check = useCallback(async () => {
    const enabled = await isVaultEnabled();
    if (!enabled) {
      setPhase("open");
      return;
    }
    if (isLocked()) {
      setPhase("locked");
    } else {
      markActive();
      setPhase("open");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    const onActivity = () => {
      if (phase === "open") markActive();
    };
    const onVisible = async () => {
      if (document.visibilityState === "visible" && phase === "open") {
        if (await isVaultEnabled()) {
          if (isLocked()) {
            lockNow();
            setPhase("locked");
          }
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
  }, [phase]);

  if (phase === "checking") {
    return <div className="min-h-screen bg-[#08090A]" />;
  }
  if (phase === "locked") {
    return <PassphraseScreen onUnlock={() => setPhase("open")} />;
  }
  return <>{children}</>;
}

function PassphraseScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (busy || pass.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const raw = await pullRawFromGitHub();

      if (raw == null) {
        setSessionPassphrase(pass);
        onUnlock();
        return;
      }

      if (isEncryptedBlob(raw)) {
        let snap: Snapshot;
        try {
          snap = await decryptData<Snapshot>(raw, pass);
        } catch (e) {
          if (e instanceof WrongPassphraseError) {
            setError("Wrong passphrase. Try again.");
          } else {
            setError("Couldn't read the backup. Check your connection.");
          }
          return;
        }
        setSessionPassphrase(pass);
        const hasLocal =
          (await db.workoutSessions.count()) > 0 || (await db.dailyCheckins.count()) > 0;
        if (!hasLocal) {
          await restoreSnapshot(snap, "replace");
        }
        onUnlock();
      } else {
        setSessionPassphrase(pass);
        onUnlock();
      }
    } catch {
      setError("Couldn't reach your backup. Check your connection and retry.");
    } finally {
      setBusy(false);
    }
  }, [pass, busy, onUnlock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") submit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#08090A] flex flex-col items-center justify-center px-8">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-[#C7F23E]/10 border border-[#C7F23E]/30 mb-6">
        <Lock className="w-6 h-6 text-[#C7F23E]" />
      </div>
      <h1 className="text-lg font-bold">Unlock PhysiqueOS</h1>
      <p className="text-xs text-[#5A5F66] mt-1 mb-8 text-center max-w-xs">
        Enter your passphrase to decrypt your data on this device.
      </p>

      <input
        type="password"
        autoFocus
        value={pass}
        onChange={(e) => {
          setPass(e.target.value);
          setError(null);
        }}
        placeholder="Passphrase"
        className="w-full max-w-xs bg-[#121316] border border-[#24262C] rounded-xl px-4 py-3 text-base text-center outline-none focus:border-[#C7F23E]/50"
        style={{ fontSize: 16 }}
      />

      {error && <p className="text-sm text-[#F2555A] mt-3">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || pass.length === 0}
        className="w-full max-w-xs mt-5 h-12 rounded-xl bg-[#C7F23E] text-[#08090A] font-bold disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Unlock"}
      </button>

      <p className="text-[11px] text-[#5A5F66] mt-6 text-center max-w-xs leading-relaxed">
        There&apos;s no recovery. If you forget this passphrase, your encrypted data
        can&apos;t be restored.
      </p>
    </div>
  );
}
