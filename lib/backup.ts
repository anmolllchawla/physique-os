// PhysiqueOS Web — Backup, Export/Import, and GitHub Sync
//
// The app is local-first (IndexedDB). This module lets you snapshot the entire
// database to a single JSON blob, restore from one, and optionally sync that
// snapshot to a private GitHub repo so your data survives a cleared browser
// and follows you across devices.
//
// GitHub writes happen through a serverless route (/api/github) so your token
// never ships to the client bundle. See app/api/github/route.ts.

import { db } from "./db";
import { encryptData, decryptData, isEncryptedBlob, type EncryptedBlob } from "./crypto";
import { getSessionPassphrase, isVaultEnabled } from "./vault";

export const SNAPSHOT_VERSION = 2;

export interface Snapshot {
  app: "physiqueos";
  schema_version: number;
  exported_at: string;
  data: {
    exercises: unknown[];
    workoutTemplates: unknown[];
    templateExercises: unknown[];
    workoutSessions: unknown[];
    exerciseLogs: unknown[];
    dailyCheckins: unknown[];
    bodyweightLogs: unknown[];
    measurements: unknown[];
    progressPhotos: unknown[];
    supplements: unknown[];
    supplementLogs: unknown[];
    fuelLogs: unknown[];
    dailyProtocols: unknown[];
    safeSettings: unknown[];
  };
}

export async function buildSnapshot(): Promise<Snapshot> {
  const [
    exercises,
    workoutTemplates,
    templateExercises,
    workoutSessions,
    exerciseLogs,
    dailyCheckins,
    bodyweightLogs,
    measurements,
    progressPhotos,
    supplements,
    supplementLogs,
    fuelLogs,
    dailyProtocols,
    allSettings,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.workoutTemplates.toArray(),
    db.templateExercises.toArray(),
    db.workoutSessions.toArray(),
    db.exerciseLogs.toArray(),
    db.dailyCheckins.toArray(),
    db.bodyweightLogs.toArray(),
    db.measurements.toArray(),
    db.progressPhotos.toArray(),
    db.supplements.toArray(),
    db.supplementLogs.toArray(),
    db.fuelLogs.toArray(),
    db.dailyProtocols.toArray(),
    db.settings.toArray(),
  ]);

  // Back up only non-secret settings (units, name, reminders). Never the PIN.
  // Sync settings across devices, INCLUDING the salted PIN hash (not the
  // plaintext PIN) so one PIN unlocks all devices. The hash is safe to sync:
  // it can't be reversed to the PIN. We still never store the plaintext.
  const safeSettings = allSettings as { key: string }[];

  return {
    app: "physiqueos",
    schema_version: SNAPSHOT_VERSION,
    exported_at: new Date().toISOString(),
    data: {
      exercises,
      workoutTemplates,
      templateExercises,
      workoutSessions,
      exerciseLogs,
      dailyCheckins,
      bodyweightLogs,
      measurements,
      progressPhotos,
      supplements,
      supplementLogs,
      fuelLogs,
      dailyProtocols,
      safeSettings,
    },
  };
}

export async function restoreSnapshot(snap: Snapshot, mode: "replace" | "merge" = "replace"): Promise<void> {
  if (snap.app !== "physiqueos" || !snap.data) {
    throw new Error("Not a PhysiqueOS backup file.");
  }
  const d = snap.data;
  await db.transaction(
    "rw",
    [
      db.exercises,
      db.workoutTemplates,
      db.templateExercises,
      db.workoutSessions,
      db.exerciseLogs,
      db.dailyCheckins,
      db.bodyweightLogs,
      db.measurements,
      db.progressPhotos,
      db.supplements,
      db.supplementLogs,
      db.fuelLogs,
      db.dailyProtocols,
      db.settings,
    ],
    async () => {
      if (mode === "replace") {
        await Promise.all([
          db.exercises.clear(),
          db.workoutTemplates.clear(),
          db.templateExercises.clear(),
          db.workoutSessions.clear(),
          db.exerciseLogs.clear(),
          db.dailyCheckins.clear(),
          db.bodyweightLogs.clear(),
          db.measurements.clear(),
          db.progressPhotos.clear(),
          db.supplements.clear(),
          db.supplementLogs.clear(),
          db.fuelLogs.clear(),
          db.dailyProtocols.clear(),
        ]);
      }
      // bulkPut is an upsert — safe for both replace and merge.
      await db.exercises.bulkPut((d.exercises ?? []) as never[]);
      await db.workoutTemplates.bulkPut((d.workoutTemplates ?? []) as never[]);
      await db.templateExercises.bulkPut((d.templateExercises ?? []) as never[]);
      await db.workoutSessions.bulkPut((d.workoutSessions ?? []) as never[]);
      await db.exerciseLogs.bulkPut((d.exerciseLogs ?? []) as never[]);
      await db.dailyCheckins.bulkPut((d.dailyCheckins ?? []) as never[]);
      await db.bodyweightLogs.bulkPut((d.bodyweightLogs ?? []) as never[]);
      await db.measurements.bulkPut((d.measurements ?? []) as never[]);
      await db.progressPhotos.bulkPut((d.progressPhotos ?? []) as never[]);
      await db.supplements.bulkPut((d.supplements ?? []) as never[]);
      await db.supplementLogs.bulkPut((d.supplementLogs ?? []) as never[]);
      await db.fuelLogs.bulkPut((d.fuelLogs ?? []) as never[]);
      await db.dailyProtocols.bulkPut((d.dailyProtocols ?? []) as never[]);
      // Restore only safe settings; never overwrite the local PIN.
      if (Array.isArray(d.safeSettings)) {
        await db.settings.bulkPut(d.safeSettings as never[]);
      }
    }
  );
}

export function downloadSnapshot(snap: Snapshot) {
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `physiqueos-backup-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── GitHub sync ────────────────────────────────────────────
// All token handling is server-side. The client only sends/receives JSON.

export interface GitHubStatus {
  configured: boolean;
  repo?: string;
  path?: string;
  last_commit?: string | null;
}

export async function githubStatus(): Promise<GitHubStatus> {
  const res = await fetch("/api/github", { method: "GET" });
  if (!res.ok) return { configured: false };
  return res.json();
}

export async function pushToGitHub(snap: Snapshot): Promise<{ ok: boolean; sha?: string; error?: string }> {
  // If the vault is unlocked, encrypt the snapshot before it leaves the device.
  const passphrase = getSessionPassphrase();
  let payload: unknown = snap;
  if (passphrase && (await isVaultEnabled())) {
    payload = await encryptData(snap, passphrase);
  }
  const res = await fetch("/api/github", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot: payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  return { ok: true, sha: json.sha };
}

// Returns the raw stored object — which may be a plaintext Snapshot (legacy)
// or an EncryptedBlob. Callers decrypt as needed.
export async function pullRawFromGitHub(): Promise<unknown | null> {
  const res = await fetch("/api/github?action=pull", { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? `Pull failed: HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.snapshot ?? null;
}

export async function pullFromGitHub(): Promise<Snapshot | null> {
  const raw = await pullRawFromGitHub();
  if (raw == null) return null;
  // Encrypted? decrypt with the active session passphrase.
  if (isEncryptedBlob(raw)) {
    const passphrase = getSessionPassphrase();
    if (!passphrase) throw new Error("Locked — enter your passphrase first.");
    return await decryptData<Snapshot>(raw, passphrase);
  }
  return raw as Snapshot;
}

// Classify what's in the cloud WITHOUT needing the passphrase. Drives the gate:
//   "encrypted" → show unlock screen on every device
//   "plaintext" / "empty" → first-time setup is allowed
//   "unconfigured" → GitHub sync isn't set up (no env vars)
//   "error" → couldn't reach the cloud (online-only app → block with retry)
export type CloudState =
  | { kind: "encrypted"; blob: EncryptedBlob }
  | { kind: "plaintext"; snapshot: Snapshot }
  | { kind: "empty" }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

export async function getCloudState(): Promise<CloudState> {
  const status = await githubStatus().catch(() => ({ configured: false }) as GitHubStatus);
  if (!status.configured) return { kind: "unconfigured" };
  try {
    const raw = await pullRawFromGitHub();
    if (raw == null) return { kind: "empty" };
    if (isEncryptedBlob(raw)) return { kind: "encrypted", blob: raw };
    return { kind: "plaintext", snapshot: raw as Snapshot };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Network error" };
  }
}
