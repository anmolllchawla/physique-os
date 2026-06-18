// PhysiqueOS — Vault session.
//
// Holds the passphrase in memory for the active session (never persisted to
// disk). The app is "unlocked" once a valid passphrase is set. Re-locks on a
// fresh load and after idle timeout. Replaces the old PIN gate.

import { db } from "./db";

const LAST_ACTIVE_KEY = "vault_last_active";
const UNLOCKED_FLAG = "vault_unlocked";
export const LOCK_AFTER_MS = 5 * 60 * 1000;

// Whether the user has set up encryption at all (stored marker, non-secret).
const VAULT_ENABLED_KEY = "vault_enabled";

// In-memory only. Lost on refresh — by design.
let sessionPassphrase: string | null = null;

export function setSessionPassphrase(passphrase: string): void {
  sessionPassphrase = passphrase;
  try {
    sessionStorage.setItem(UNLOCKED_FLAG, "1");
    markActive();
  } catch {
    /* ignore */
  }
}

export function getSessionPassphrase(): string | null {
  return sessionPassphrase;
}

export function clearSession(): void {
  sessionPassphrase = null;
  try {
    sessionStorage.removeItem(UNLOCKED_FLAG);
  } catch {
    /* ignore */
  }
}

export async function isVaultEnabled(): Promise<boolean> {
  const row = await db.settings.get(VAULT_ENABLED_KEY);
  return row?.value === "true";
}

export async function markVaultEnabled(): Promise<void> {
  await db.settings.put({ key: VAULT_ENABLED_KEY, value: "true" });
}

export async function disableVault(): Promise<void> {
  await db.settings.delete(VAULT_ENABLED_KEY);
  clearSession();
}

export function markActive(): void {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Should we be showing the passphrase screen right now?
export function isLocked(): boolean {
  let unlocked = false;
  let last = 0;
  try {
    unlocked = sessionStorage.getItem(UNLOCKED_FLAG) === "1";
    last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || 0);
  } catch {
    /* ignore */
  }
  if (!unlocked || !sessionPassphrase) return true;
  if (last && Date.now() - last > LOCK_AFTER_MS) return true;
  return false;
}

export function lockNow(): void {
  clearSession();
}
