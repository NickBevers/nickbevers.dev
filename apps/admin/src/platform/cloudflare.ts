// Cloudflare Workers implementation of the platform seam
import { createSessionStore } from "./crypto";
import type { Platform } from "./types";

export function createPlatform(secret: string): Platform {
  return {
    session: createSessionStore(secret),
    // Workers is always behind TLS in production
    isSecureContext: (request) => new URL(request.url).protocol === "https:",
  };
}
