import type { APIRoute } from "astro";
import { exchangeCode, fetchUser, isAllowed } from "@/lib/github/auth";
import { setSession, takeState } from "@/lib/session";

export const prerender = false;

const deny = (ctx: Parameters<APIRoute>[0], reason: string) =>
  ctx.redirect(`/login?error=${encodeURIComponent(reason)}`, 302);

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get("code");
  const returned = ctx.url.searchParams.get("state");
  const stored = takeState(ctx);

  // CSRF: the state we minted must come back unchanged. Checked before the
  // code is spent, so a forged callback never reaches GitHub.
  if (!code || !returned || !stored || returned !== stored) {
    return deny(ctx, "Invalid or expired sign-in attempt. Try again.");
  }

  let token: string;
  try {
    const redirectUri = new URL("/api/auth/callback", ctx.url).href;
    const res = await exchangeCode(code, redirectUri);
    token = res.access_token;
  } catch {
    return deny(ctx, "GitHub would not complete the sign-in.");
  }

  let user;
  try {
    user = await fetchUser(token);
  } catch {
    return deny(ctx, "Could not read your GitHub account.");
  }

  // The gate. A valid GitHub login is not authorisation. This panel has
  // exactly one user. No session is created for anyone else.
  if (!isAllowed(user)) {
    return deny(ctx, "That account is not allowed to use this panel.");
  }

  await setSession(ctx, {
    login: user.login,
    userId: user.id,
    token,
    expiresAt: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
  });

  // Only same-origin paths, so ?next= cannot be used as an open redirect.
  const next = ctx.url.searchParams.get("next");
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return ctx.redirect(safe, 302);
};
