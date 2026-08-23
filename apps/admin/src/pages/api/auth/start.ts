import type { APIRoute } from "astro";
import { authorizeUrl, randomState } from "@/lib/github/auth";
import { setState } from "@/lib/session";

export const prerender = false;

/** Kicks off the OAuth dance. Mints a state, stores it, redirects to GitHub. */
export const GET: APIRoute = (ctx) => {
  const state = randomState();
  setState(ctx, state);

  const redirectUri = new URL("/api/auth/callback", ctx.url).href;
  return ctx.redirect(authorizeUrl(state, redirectUri), 302);
};
