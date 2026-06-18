// PhysiqueOS — Encryption vault.
//
// Real at-rest encryption for the GitHub backup. The passphrase derives an
// AES-GCM key via PBKDF2 (200k iterations). The backup blob pushed to GitHub
// is ciphertext — unreadable without the passphrase, in the repo or in dev
// tools. There is NO recovery: forget the passphrase and the data is gone.
//
// Local IndexedDB stays plaintext for app speed; the encryption protects the
// synced/at-rest copy and gates loading data onto a new device.

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

// Stored (non-secret) verifier so we can tell "wrong passphrase" from
// "corrupt data" and confirm a passphrase without decrypting everything.
export interface EncryptedBlob {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Return a fresh ArrayBuffer-backed copy. The DOM crypto types require
// BufferSource backed by ArrayBuffer (not SharedArrayBuffer), and recent TS
// libs widen Uint8Array's buffer type — so we normalize here.
function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    buf(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: buf(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt an arbitrary JSON-serializable object into an EncryptedBlob.
export async function encryptData(data: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(iv) }, key, buf(plaintext));
  return {
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(cipher)),
  };
}

export class WrongPassphraseError extends Error {
  constructor() {
    super("Wrong passphrase");
    this.name = "WrongPassphraseError";
  }
}

// Decrypt an EncryptedBlob. Throws WrongPassphraseError if the passphrase is
// wrong (AES-GCM auth tag fails) — that's how we detect a bad passphrase.
export async function decryptData<T = unknown>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  if (!blob || blob.v !== 1) throw new Error("Unsupported backup format");
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const key = await deriveKey(passphrase, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buf(iv) },
      key,
      buf(fromB64(blob.ciphertext))
    );
  } catch {
    // AES-GCM throws on auth-tag mismatch → wrong passphrase (or corruption).
    throw new WrongPassphraseError();
  }
  const text = new TextDecoder().decode(plain);
  return JSON.parse(text) as T;
}

export function isEncryptedBlob(x: unknown): x is EncryptedBlob {
  return (
    !!x &&
    typeof x === "object" &&
    (x as { v?: unknown }).v === 1 &&
    typeof (x as { ciphertext?: unknown }).ciphertext === "string"
  );
}
