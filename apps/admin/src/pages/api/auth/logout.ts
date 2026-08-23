import type { APIRoute } from "astro";
import { clearSession } from "@/lib/session";

export const prerender = false;

/** POST only: a GET logout can be triggered by any image tag on any page. */
export const POST: APIRoute = (ctx) => {
  clearSession(ctx);
  return ctx.redirect("/login", 302);
};

/**
 * Explicit 405 rather than letting the route 404.
 *
 * The middleware already blocks an unauthenticated GET here, and Astro's own
 * CSRF check blocks a cross-origin POST. Stating the method contract means
 * the refusal does not depend on either of those happening to fire first.
 */
export const GET: APIRoute = () =>
  new Response("Use POST to sign out.", { status: 405, headers: { allow: "POST" } });
