/**
 * Shared security helpers.
 */

import crypto from "crypto";

/**
 * Cryptographically-secure random ID generator. Replaces unsafe
 * `Math.random()` patterns used for request/task/session/correlation IDs.
 */
export function secureRandomId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Whitelisting helper for safe partial updates. Pass a record and the keys
 * you allow to be assigned, get back a new object containing only those keys.
 * Prevents mass-assignment vulnerabilities on `Object.assign(model, req.body)`.
 */
export function pickAllowedFields<T extends Record<string, any>>(
  source: T | undefined | null,
  allowed: ReadonlyArray<keyof T>,
): Partial<T> {
  const out: Partial<T> = {};
  if (!source) return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = source[key];
    }
  }
  return out;
}

/**
 * AES-256-GCM encryption for at-rest secrets (OAuth access/refresh tokens, etc.).
 * Output format: base64(iv || authTag || ciphertext).
 *
 * Caller must provide a 32-byte key (typically derived from an env secret).
 */
export function encryptAes256Gcm(plaintext: string, keyBytes: Buffer): string {
  if (keyBytes.length !== 32) {
    throw new Error("encryptAes256Gcm requires a 32-byte key");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decryptAes256Gcm(payload: string, keyBytes: Buffer): string {
  if (keyBytes.length !== 32) {
    throw new Error("decryptAes256Gcm requires a 32-byte key");
  }
  const buf = Buffer.from(payload, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("decryptAes256Gcm payload too short");
  }
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBytes, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/**
 * Resolve a 32-byte encryption key from an env-supplied secret. Accepts
 * either a 64-char hex string or any string ≥32 chars (hashed via SHA-256
 * to a fixed 32-byte key). Throws if the env var is missing — callers should
 * fail-fast at boot rather than silently using a fallback.
 */
export function deriveAesKeyFromSecret(secret: string | undefined, label: string): Buffer {
  if (!secret || secret.length < 16) {
    throw new Error(
      `[security] ${label} env var is missing or too short. Set a 32+ character random secret.`,
    );
  }
  // If it looks like 64 hex chars, treat as raw key.
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, "hex");
  }
  // Otherwise derive a stable 32-byte key via SHA-256 of the input.
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Constant-time string comparison wrapper that returns false for mismatched
 * lengths instead of throwing. Useful for token comparisons.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) {
    // Still run a comparison to dampen length-based timing leaks.
    crypto.timingSafeEqual(Buffer.from(a.padEnd(b.length, "\0")), Buffer.from(b.padEnd(a.length, "\0")));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
