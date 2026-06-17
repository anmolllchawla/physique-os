// PhysiqueOS — App lock (PIN gate).
//
// A 4–6 digit PIN gates access to the app. This is an ACCESS gate, not data
// encryption: the data in IndexedDB and the private GitHub backup remain as-is.
// The PIN itself is never stored in plaintext — only a salted SHA-256 hash —
// so it can't be read off the device.
//
// Lock behavior: the app locks when it has been backgrounded/closed for longer
// than LOCK_AFTER_MS. A fresh load always requires the PIN if one is set.

import { db } from "./db";

const PIN_HASH_KEY = "pin_hash";
const PIN_SALT_KEY = "pin_salt";
const LAST_ACTIVE_KEY = "pin_last_active"; // sessionStorage timestamp
export const LOCK_AFTER_MS = 5 * 60 * 1000; // 5 minutes

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function isPinSet(): Promise<boolean> {
  const h = await db.settings.get(PIN_HASH_KEY);
  return !!h?.value;
}

export async function setPin(pin: string): Promise<void> {
  const salt = randomSalt();
  const hash = await sha256Hex(salt + pin);
  await db.settings.put({ key: PIN_SALT_KEY, value: salt });
  await db.settings.put({ key: PIN_HASH_KEY, value: hash });
}

export async function removePin(): Promise<void> {
  await db.settings.delete(PIN_HASH_KEY);
  await db.settings.delete(PIN_SALT_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const [saltRow, hashRow] = await Promise.all([
    db.settings.get(PIN_SALT_KEY),
    db.settings.get(PIN_HASH_KEY),
  ]);
  if (!saltRow?.value || !hashRow?.value) return false;
  const hash = await sha256Hex(saltRow.value + pin);
  return hash === hashRow.value;
}

// ── Session / lock-timing (sessionStorage so it resets on a fresh load) ──

export function markActive(): void {
  try {
    sessionStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

// Mark that the user has unlocked this session.
const UNLOCKED_KEY = "pin_unlocked";
export function markUnlocked(): void {
  try {
    sessionStorage.setItem(UNLOCKED_KEY, "1");
    markActive();
  } catch {
    /* ignore */
  }
}

// Should the lock screen be shown right now?
// - If no PIN set → never lock.
// - Fresh load (no unlocked flag this session) → lock.
// - Returned after being away longer than LOCK_AFTER_MS → lock.
export async function shouldLock(): Promise<boolean> {
  if (!(await isPinSet())) return false;
  let unlocked = false;
  let last = 0;
  try {
    unlocked = sessionStorage.getItem(UNLOCKED_KEY) === "1";
    last = Number(sessionStorage.getItem(LAST_ACTIVE_KEY) || 0);
  } catch {
    /* ignore */
  }
  if (!unlocked) return true;
  if (last && Date.now() - last > LOCK_AFTER_MS) return true;
  return false;
}

export function lockNow(): void {
  try {
    sessionStorage.removeItem(UNLOCKED_KEY);
  } catch {
    /* ignore */
  }
}
