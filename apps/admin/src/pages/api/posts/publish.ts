import type { APIRoute } from "astro";
import { publishPost, loadPost, headCommit } from "@/lib/posts";
import { ConflictError } from "@/lib/github/client";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (ctx) => {
  const session = ctx.locals.session;
  if (!session) return json({ error: "Not authenticated" }, 401);

  let payload: {
    slug: string;
    path: string;
    expectedHead?: string;
    data: Record<string, unknown>;
    body: string;
  };
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "Malformed request" }, 400);
  }
  if (!payload.slug || !payload.path) return json({ error: "slug and path are required" }, 400);

  try {
    const res = await publishPost(session.token, {
      slug: payload.slug,
      path: payload.path,
      data: payload.data,
      body: payload.body,
      expectedHead: payload.expectedHead,
    });
    return json({ ok: true, commit: res.commit });
  } catch (err) {
    if (err instanceof ConflictError) {
      const current = await loadPost(session.token, payload.slug).catch(() => null);
      return json(
        {
          error: "conflict",
          message: err.message,
          head: await headCommit(session.token).catch(() => undefined),
          current: current && { sha: current.sha, data: current.data, body: current.body },
        },
        409,
      );
    }
    return json({ error: (err as Error).message }, 502);
  }
};
