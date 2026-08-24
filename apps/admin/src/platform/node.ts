// Node implementation of the platform seam
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
