"use client";

import { useEffect, useState, useCallback } from "react";
import { Lock, Loader2, CloudOff, RefreshCw } from "lucide-react";
import { setSessionPassphrase, markActive, markVaultEnabled } from "@/lib/vault";
import {
  getCloudState,
  restoreSnapshot,
  pullPhotos,
  type Snapshot,
} from "@/lib/backup";
import { decryptData, WrongPassphraseError, type EncryptedBlob } from "@/lib/crypto";

type Phase =
  | { k: "checking" }
  | { k: "open" }
  | { k: "locked"; blob: EncryptedBlob }
  | { k: "error"; message: string };

export function AppGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ k: "checking" });

  const check = useCallback(async () => {
    setPhase({ k: "checking" });
    const state = await getCloudState();
    switch (state.kind) {
      case "encrypted":
        // Encrypted backup in the cloud → require the passphrase on EVERY
        // device, every load. This is the fix: encryption is a property of
        // the cloud backup, not a per-device toggle.
        setPhase({ k: "locked", blob: state.blob });
        break;
      case "error":
        // Online-only app: if we can't reach the cloud, don't expose the app.
        setPhase({ k: "error", message: state.message });
        break;
      case "empty":
      case "plaintext":
      case "unconfigured":
        // No encrypted vault yet → app is open; setup happens in Settings.
        markActive();
        setPhase({ k: "open" });
        break;
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (phase.k === "checking") {
    return (
      <div className="min-h-screen bg-[#08090A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#5A5F66] animate-spin" />
      </div>
    );
  }
  if (phase.k === "error") {
    return <ErrorScreen message={phase.message} onRetry={check} />;
  }
  if (phase.k === "locked") {
    return <PassphraseScreen blob={phase.blob} onUnlock={() => setPhase({ k: "open" })} />;
  }
  return <>{children}</>;
}

function PassphraseScreen({ blob, onUnlock }: { blob: EncryptedBlob; onUnlock: () => void }) {
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (busy || pass.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let snap: Snapshot;
      try {
        snap = await decryptData<Snapshot>(blob, pass);
      } catch (e) {
        setError(
          e instanceof WrongPassphraseError
            ? "Wrong passphrase. Try again."
            : "Couldn't read the backup."
        );
        return;
      }
      // Correct passphrase. Hold it for the session and load the data.
      setSessionPassphrase(pass);
      await markVaultEnabled();
      // Always load the decrypted cloud copy so every device shows current data.
      await restoreSnapshot(snap, "replace");
      // Full photo images live in separate files — fetch them after restore.
      await pullPhotos().catch(() => ({ pulled: 0 }));
      onUnlock();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }, [pass, busy, blob, onUnlock]);

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
        Enter your passphrase to decrypt your data.
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
        className="w-full max-w-xs bg-[#121316] border border-[#24262C] rounded-xl px-4 py-3 text-center outline-none focus:border-[#C7F23E]/50"
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

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-[#08090A] flex flex-col items-center justify-center px-8">
      <div className="grid place-items-center h-14 w-14 rounded-2xl bg-[#F2555A]/10 border border-[#F2555A]/30 mb-6">
        <CloudOff className="w-6 h-6 text-[#F2555A]" />
      </div>
      <h1 className="text-lg font-bold">Can&apos;t reach your data</h1>
      <p className="text-xs text-[#9BA0A6] mt-2 mb-1 text-center max-w-xs">
        PhysiqueOS needs a connection to load your encrypted data.
      </p>
      <p className="text-[11px] text-[#5A5F66] mb-8 text-center max-w-xs">{message}</p>
      <button
        onClick={onRetry}
        className="w-full max-w-xs h-12 rounded-xl bg-[#C7F23E] text-[#08090A] font-bold flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  );
}
