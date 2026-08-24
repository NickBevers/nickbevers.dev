// The only module the rest of the admin may import for platform access
import { SESSION_SECRET } from "astro:env/server";
import { createPlatform as cloudflare } from "./cloudflare";
import { createPlatform as node } from "./node";
import type { Platform } from "./types";

const useNode = import.meta.env.DEPLOY_TARGET === "node";

let cached: Platform | undefined;

export function platform(): Platform {
  cached ??= (useNode ? node : cloudflare)(SESSION_SECRET);
  return cached;
}

export type { Platform, SessionPayload, SessionStore } from "./types";
