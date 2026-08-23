/**
 * HMAC-signed session tokens over WebCrypto.
 *
 * WebCrypto is the one primitive both workerd and modern Node expose the same
 * way, so this file is shared by both platform implementations rather than
 * duplicated. No node:crypto import, which would break the Workers build.
 *
 * The payload is signed, not encrypted: it is opaque to the browser only in
 * the sense that it cannot be forged. It still holds a GitHub token, so the
 * cookie is httpOnly and Secure and must never be read by client JS.
 */
import type { SessionPayload, SessionStore } from "./types";

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const unb64url = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Constant-time compare, so a bad signature cannot be probed byte by byte. */
function sameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function createSessionStore(secret: string): SessionStore {
  return {
    async seal(payload) {
      const body = b64url(enc.encode(JSON.stringify(payload)));
      const sig = new Uint8Array(
        await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)),
      );
      return `${body}.${b64url(sig)}`;
    },

    async unseal(token) {
      const [body, sig] = token.split(".");
      if (!body || !sig) return null;

      const expected = new Uint8Array(
        await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body)),
      );
      if (!sameBytes(unb64url(sig), expected)) return null;

      let payload: SessionPayload;
      try {
        payload = JSON.parse(dec.decode(unb64url(body))) as SessionPayload;
      } catch {
        return null;
      }

      // A valid signature over an expired payload is still expired.
      if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now() / 1000) {
        return null;
      }
      return payload;
    },
  };
}
