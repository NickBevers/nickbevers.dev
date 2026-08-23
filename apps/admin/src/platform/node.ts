/**
 * Node implementation of the platform seam. The Coolify path.
 *
 * Identical to the Cloudflare one today, because everything the admin needs
 * is WebCrypto and the Fetch API, both of which modern Node provides. The
 * file exists so the divergence has somewhere to go, and so CI can prove the
 * Node build still compiles.
 *
 * Behind a reverse proxy Node sees http even when the client used https, so
 * the forwarded-proto header decides.
 */
import { createSessionStore } from "./crypto";
import type { Platform } from "./types";

export function createPlatform(secret: string): Platform {
  return {
    session: createSessionStore(secret),
    isSecureContext: (request) => {
      const proto = request.headers.get("x-forwarded-proto");
      if (proto) return proto.split(",")[0]?.trim() === "https";
      return new URL(request.url).protocol === "https:";
    },
  };
}
