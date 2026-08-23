import type { APIRoute } from "astro";
import { savePost, loadPost } from "@/lib/posts";
import { ConflictError } from "@/lib/github/client";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (ctx) => {
  const session = ctx.locals.session;
  if (!session) return json({ error: "Not authenticated" }, 401);

  let payload: {
    slug: string;
    path?: string;
    sha?: string;
    data: Record<string, unknown>;
    body: string;
  };
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "Malformed request" }, 400);
  }

  if (!payload.slug || typeof payload.body !== "string") {
    return json({ error: "slug and body are required" }, 400);
  }
  /* Validate before touching GitHub. entryPath() also rejects this, but that
     surfaces as a 502. A caller sending a bad slug should get a 400, not be
     told the upstream failed. */
  if (!/^[a-z0-9][a-z0-9-]*$/.test(payload.slug)) {
    return json({ error: "A slug may only contain lowercase letters, numbers and hyphens." }, 400);
  }

  try {
    const res = await savePost(session.token, {
      slug: payload.slug,
      path: payload.path,
      data: payload.data,
      body: payload.body,
      sha: payload.sha,
    });
    return json({ ok: true, sha: res.sha, commit: res.commit });
  } catch (err) {
    if (err instanceof ConflictError) {
      /* Do NOT retry and do NOT overwrite. Hand back what is on disk so the
         editor can show the difference and let the user decide. A silent
         retry here is how someone's work disappears. */
      const current = await loadPost(session.token, payload.slug).catch(() => null);
      return json(
        {
          error: "conflict",
          message: err.message,
          current: current && { sha: current.sha, data: current.data, body: current.body },
        },
        409,
      );
    }
    return json({ error: (err as Error).message }, 502);
  }
};
