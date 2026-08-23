/**
 * Cloudflare Workers implementation of the platform seam.
 *
 * Deliberately thin. Everything portable lives in crypto.ts; this file exists
 * so that if Workers ever needs something workerd-specific (KV for refresh
 * tokens, say), it lands here and nowhere else.
 */
import { createSessionStore } from "./crypto";
import type { Platform } from "./types";

export function createPlatform(secret: string): Platform {
  return {
    session: createSessionStore(secret),
    // Workers is always behind TLS in production. The one exception is
    // `wrangler dev` on localhost, where a Secure cookie would be dropped.
    isSecureContext: (request) => new URL(request.url).protocol === "https:",
  };
}
