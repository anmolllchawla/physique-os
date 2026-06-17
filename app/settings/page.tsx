"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useSettings, setSetting } from "@/hooks/useSettings";
import {
  buildSnapshot,
  restoreSnapshot,
  downloadSnapshot,
  githubStatus,
  pushToGitHub,
  pullFromGitHub,
  type Snapshot,
  type GitHubStatus,
} from "@/lib/backup";
import { formatDateShort } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Download,
  Upload,
  Cloud,
  CloudUpload,
  CloudDownload,
  Scale,
  Ruler,
  Trash2,
  Check,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { isPinSet, setPin as savePin, removePin } from "@/lib/lock";

type Status = { kind: "idle" | "ok" | "err" | "busy"; msg?: string };

export default function SettingsPage() {
  const { weight_unit, measurement_unit, name } = useSettings();
  const [gh, setGh] = useState<GitHubStatus | null>(null);
  const [sync, setSync] = useState<Status>({ kind: "idle" });
  const [io, setIo] = useState<Status>({ kind: "idle" });
  const [resetArmed, setResetArmed] = useState(false);
  const [pinOn, setPinOn] = useState(false);
  const [pinEntry, setPinEntry] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinMode, setPinMode] = useState<"idle" | "setting">("idle");
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  useEffect(() => {
    isPinSet().then(setPinOn);
  }, []);

  const handleSetPin = async () => {
    setPinMsg(null);
    if (!/^\d{4,6}$/.test(pinEntry)) {
      setPinMsg("PIN must be 4–6 digits.");
      return;
    }
    if (pinEntry !== pinConfirm) {
      setPinMsg("PINs don't match.");
      return;
    }
    await savePin(pinEntry);
    setPinOn(true);
    setPinMode("idle");
    setPinEntry("");
    setPinConfirm("");
    setPinMsg("PIN set. The app will lock when idle.");
  };

  const handleRemovePin = async () => {
    await removePin();
    setPinOn(false);
    setPinMsg("PIN removed.");
  };

  const counts = useLiveQuery(async () => ({
    sessions: await db.workoutSessions.count(),
    checkins: await db.dailyCheckins.count(),
    weights: await db.bodyweightLogs.count(),
    measurements: await db.measurements.count(),
    photos: await db.progressPhotos.count(),
  }));

  useEffect(() => {
    githubStatus().then(setGh).catch(() => setGh({ configured: false }));
  }, []);

  // ── Export / Import ──────────────────────────
  const handleExport = async () => {
    setIo({ kind: "busy", msg: "Building backup…" });
    try {
      const snap = await buildSnapshot();
      downloadSnapshot(snap);
      setIo({ kind: "ok", msg: "Backup downloaded." });
    } catch {
      setIo({ kind: "err", msg: "Export failed." });
    }
  };

  const handleImport = async (file: File) => {
    setIo({ kind: "busy", msg: "Restoring…" });
    try {
      const text = await file.text();
      const snap = JSON.parse(text) as Snapshot;
      await restoreSnapshot(snap, "replace");
      setIo({ kind: "ok", msg: "Backup restored. Data replaced." });
    } catch (e) {
      setIo({ kind: "err", msg: e instanceof Error ? e.message : "Import failed." });
    }
  };

  // ── GitHub sync ──────────────────────────────
  const handlePush = async () => {
    setSync({ kind: "busy", msg: "Pushing to GitHub…" });
    try {
      const snap = await buildSnapshot();
      const res = await pushToGitHub(snap);
      if (res.ok) {
        setSync({ kind: "ok", msg: "Synced to GitHub." });
        githubStatus().then(setGh);
      } else {
        setSync({ kind: "err", msg: res.error ?? "Push failed." });
      }
    } catch (e) {
      setSync({ kind: "err", msg: e instanceof Error ? e.message : "Push failed." });
    }
  };

  const handlePull = async () => {
    setSync({ kind: "busy", msg: "Pulling from GitHub…" });
    try {
      const snap = await pullFromGitHub();
      if (!snap) {
        setSync({ kind: "err", msg: "No backup found in repo yet." });
        return;
      }
      await restoreSnapshot(snap, "replace");
      setSync({ kind: "ok", msg: "Restored from GitHub." });
    } catch (e) {
      setSync({ kind: "err", msg: e instanceof Error ? e.message : "Pull failed." });
    }
  };

  // ── Reset ────────────────────────────────────
  const handleReset = async () => {
    await db.delete();
    location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[#08090A] text-[#F2F4F3] pb-24">
      <div className="max-w-lg mx-auto px-4 pt-8 flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>

        {/* Profile */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1">
            Profile
          </p>
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4">
              <label className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider mb-1 block">
                Name (for greeting)
              </label>
              <Input
                placeholder="Your name"
                defaultValue={name}
                onBlur={(e) => setSetting("name", e.target.value.trim())}
                className="bg-[#08090A] border-[#24262C]"
              />
            </CardContent>
          </Card>
        </section>

        {/* Security */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1">
            Security
          </p>
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#9BA0A6]" />
                  <span className="text-sm font-medium">App lock (PIN)</span>
                </div>
                {pinOn ? (
                  <span className="text-xs font-bold text-[#36D399]">On</span>
                ) : (
                  <span className="text-xs font-bold text-[#5A5F66]">Off</span>
                )}
              </div>

              {pinMode === "setting" ? (
                <div className="flex flex-col gap-2">
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="New PIN (4–6 digits)"
                    value={pinEntry}
                    onChange={(e) => setPinEntry(e.target.value.replace(/\D/g, ""))}
                    className="bg-[#08090A] border-[#24262C]"
                  />
                  <Input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Confirm PIN"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                    className="bg-[#08090A] border-[#24262C]"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleSetPin}>
                      Save PIN
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setPinMode("idle");
                        setPinEntry("");
                        setPinConfirm("");
                        setPinMsg(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setPinMode("setting");
                      setPinMsg(null);
                    }}
                  >
                    {pinOn ? "Change PIN" : "Set a PIN"}
                  </Button>
                  {pinOn && (
                    <Button variant="ghost" className="flex-1" onClick={handleRemovePin}>
                      Remove
                    </Button>
                  )}
                </div>
              )}

              {pinMsg && <p className="text-xs text-[#9BA0A6]">{pinMsg}</p>}
              <p className="text-[11px] text-[#5A5F66]">
                Locks the app after ~5 minutes idle. This gates access on this
                device; your private data repo protects the backup itself.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Units */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1">
            Units
          </p>
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-[#9BA0A6]" />
                  <span className="text-sm font-medium">Weight</span>
                </div>
                <Toggle
                  options={["lbs", "kg"]}
                  value={weight_unit}
                  onChange={(v) => setSetting("weight_unit", v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Ruler className="w-4 h-4 text-[#9BA0A6]" />
                  <span className="text-sm font-medium">Measurements</span>
                </div>
                <Toggle
                  options={["in", "cm"]}
                  value={measurement_unit}
                  onChange={(v) => setSetting("measurement_unit", v)}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* GitHub Sync */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1">
            GitHub Sync
          </p>
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#9BA0A6]" />
                {gh?.configured ? (
                  <span className="text-sm">
                    Connected to <span className="font-mono text-[#C7F23E]">{gh.repo}</span>
                  </span>
                ) : (
                  <span className="text-sm text-[#9BA0A6]">Not configured</span>
                )}
              </div>

              {gh?.configured ? (
                <>
                  {gh.last_commit && (
                    <p className="text-xs text-[#5A5F66]">
                      Last sync: {formatDateShort(gh.last_commit)} ·{" "}
                      {new Date(gh.last_commit).toLocaleTimeString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={handlePush}
                      disabled={sync.kind === "busy"}
                    >
                      <CloudUpload className="w-4 h-4 mr-1.5" />
                      Backup now
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={handlePull}
                      disabled={sync.kind === "busy"}
                    >
                      <CloudDownload className="w-4 h-4 mr-1.5" />
                      Restore
                    </Button>
                  </div>
                  <StatusLine status={sync} />
                </>
              ) : (
                <div className="text-xs text-[#9BA0A6] leading-relaxed bg-[#08090A] rounded-lg p-3 border border-[#24262C]">
                  To enable cloud backup, add these environment variables in Vercel
                  (Project → Settings → Environment Variables), then redeploy:
                  <ul className="mt-2 font-mono text-[#C7F23E] space-y-0.5">
                    <li>GITHUB_TOKEN</li>
                    <li>GITHUB_REPO</li>
                  </ul>
                  <p className="mt-2 text-[#5A5F66]">
                    Use a private data repo and a fine-grained token with
                    Contents: read &amp; write. Your photos and body stats are
                    in this backup — keep the repo private.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Local backup */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#9BA0A6] uppercase tracking-wider px-1">
            Local Backup
          </p>
          <Card className="bg-[#121316] border-[#24262C]">
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex gap-2">
                <Button className="flex-1" variant="secondary" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Export JSON
                </Button>
                <label className="flex-1">
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImport(f);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center justify-center w-full h-9 rounded-lg bg-[#1B1D22] hover:bg-[#23262C] text-sm font-medium cursor-pointer transition-colors">
                    <Upload className="w-4 h-4 mr-1.5" />
                    Import JSON
                  </span>
                </label>
              </div>
              <StatusLine status={io} />
              <p className="text-[11px] text-[#5A5F66]">
                Import replaces all current data with the file&apos;s contents.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Stored data summary */}
        {counts && (
          <p className="text-xs text-[#5A5F66] text-center px-2">
            {counts.sessions} workouts · {counts.checkins} check-ins ·{" "}
            {counts.weights} weigh-ins · {counts.measurements} measurements ·{" "}
            {counts.photos} photos stored on this device
          </p>
        )}

        {/* Danger zone */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#F2555A] uppercase tracking-wider px-1">
            Danger Zone
          </p>
          <Card className="bg-[#F2555A]/5 border-[#F2555A]/30">
            <CardContent className="p-4 flex flex-col gap-3">
              {!resetArmed ? (
                <Button variant="destructive" onClick={() => setResetArmed(true)}>
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Erase all data
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[#F2555A] text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    This deletes everything on this device. Export or sync first.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="destructive" className="flex-1" onClick={handleReset}>
                      Yes, erase everything
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setResetArmed(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <p className="text-center text-[11px] text-[#3A3D45] pt-2">
          PhysiqueOS · local-first · v0.2
        </p>
      </div>
    </main>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, T];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-[#08090A] border border-[#24262C] p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors ${
            value === opt ? "bg-[#C7F23E] text-white" : "text-[#5A5F66] hover:text-[#9BA0A6]"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle") return null;
  const color =
    status.kind === "ok" ? "#36D399" : status.kind === "err" ? "#F2555A" : "#9BA0A6";
  return (
    <div className="flex items-center gap-1.5 text-xs" style={{ color }}>
      {status.kind === "ok" && <Check className="w-3.5 h-3.5" />}
      {status.kind === "err" && <AlertTriangle className="w-3.5 h-3.5" />}
      {status.kind === "busy" && (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      <span>{status.msg}</span>
    </div>
  );
}
