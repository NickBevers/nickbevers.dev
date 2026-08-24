// Auth gate on every route
import { defineMiddleware } from "astro:middleware";
import { readSession } from "@/lib/session";
import { PREVIEW, previewSession } from "@/lib/preview";

const PUBLIC = new Set(["/login", "/login/", "/api/auth/start", "/api/auth/callback"]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // UI preview: hand every route a fake session and skip GitHub entirely
  if (PREVIEW) {
    context.locals.session = previewSession;
    if (pathname === "/login" || pathname === "/login/") {
      return context.redirect("/", 302);
    }
    return next();
  }

  if (PUBLIC.has(pathname)) return next();

  const session = await readSession(context);
  if (!session) {
    // API routes get a status; pages get sent to the login screen.
    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    const to = new URL("/login", context.url);
    if (pathname !== "/") to.searchParams.set("next", pathname);
    return context.redirect(to.pathname + to.search, 302);
  }

  context.locals.session = session;
  return next();
});
