/* Token-at-rest encryption for Connect (invariant §6-3: tokens server-only).
 * AES-256-GCM with a server-held key (CONNECT_TOKEN_KEY, 32 bytes as hex or
 * base64). Stored form: base64(iv).base64(tag).base64(ciphertext).
 * If the key is absent, Connect OAuth is treated as not-configured (the routes
 * env-gate to 503, same posture as the Google provider). */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer | null {
  const raw = process.env.CONNECT_TOKEN_KEY;
  if (!raw) return null;
  // accept hex (64 chars) or base64
  const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return buf.length === 32 ? buf : null;
}

/** True when a valid 32-byte key is configured — gate OAuth routes on this. */
export function connectConfigured(): boolean {
  return key() !== null;
}

export function encryptToken(plain: string): string | null {
  const k = key();
  if (!k || !plain) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${ct.toString("base64")}`;
}

export function decryptToken(stored: string | null | undefined): string | null {
  const k = key();
  if (!k || !stored) return null;
  const parts = stored.split(".");
  if (parts.length !== 3) return null;
  try {
    const [ivB, tagB, ctB] = parts;
    const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB, "base64"));
    decipher.setAuthTag(Buffer.from(tagB, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
