/**
 * Session and CSRF cookies.
 *
 * The session holds a GitHub token with write access to the content repo, so
 * it is httpOnly (an XSS in the editor must not be able to read it), Secure,
 * SameSite=Lax (Lax not Strict, or the OAuth redirect back from GitHub
 * arrives without the cookie), and `__Host-` prefixed, which pins it to this
 * exact origin and forbids a subdomain from setting it.
 */
import type { APIContext } from "astro";
import { platform, type SessionPayload } from "@/platform";

const SESSION = "__Host-nb_session";
const STATE = "__Host-nb_state";

/** 8 hours, matching the GitHub user token's own lifetime. */
const MAX_AGE = 8 * 60 * 60;

/** `__Host-` requires Secure, so plain-http localhost needs the plain name. */
function name(base: string, secure: boolean) {
  return secure ? base : base.replace("__Host-", "");
}

function options(secure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setSession(ctx: APIContext, payload: SessionPayload) {
  const p = platform();
  const secure = p.isSecureContext(ctx.request);
  ctx.cookies.set(name(SESSION, secure), await p.session.seal(payload), options(secure, MAX_AGE));
}

export async function readSession(ctx: APIContext): Promise<SessionPayload | null> {
  const p = platform();
  const secure = p.isSecureContext(ctx.request);
  const raw = ctx.cookies.get(name(SESSION, secure))?.value;
  if (!raw) return null;
  return p.session.unseal(raw);
}

export function clearSession(ctx: APIContext) {
  const secure = platform().isSecureContext(ctx.request);
  ctx.cookies.delete(name(SESSION, secure), { path: "/" });
}

/** The OAuth `state`, round-tripped in its own short-lived cookie. */
export function setState(ctx: APIContext, state: string) {
  const secure = platform().isSecureContext(ctx.request);
  ctx.cookies.set(name(STATE, secure), state, options(secure, 600));
}

export function takeState(ctx: APIContext): string | null {
  const secure = platform().isSecureContext(ctx.request);
  const key = name(STATE, secure);
  const value = ctx.cookies.get(key)?.value ?? null;
  // Single use: consumed whether or not it matches.
  ctx.cookies.delete(key, { path: "/" });
  return value;
}
