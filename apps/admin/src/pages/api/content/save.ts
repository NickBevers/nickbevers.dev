import type { APIRoute } from "astro";
import { getCollection } from "@/lib/collections";
import { saveItem, loadItem, slugify } from "@/lib/content";
import { ConflictError } from "@/lib/github/client";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (ctx) => {
  const session = ctx.locals.session;
  if (!session) return json({ error: "Not authenticated" }, 401);

  let payload: {
    collection: string;
    slug?: string;
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

  const col = getCollection(payload.collection);
  if (!col) return json({ error: "Unknown collection" }, 400);
  if (typeof payload.body !== "string") return json({ error: "body is required" }, 400);

  const slug = payload.slug || slugify(String(payload.data?.[col.titleField] ?? ""));
  if (!slug) return json({ error: `${col.one} needs a ${col.titleField}` }, 400);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return json({ error: "A slug may only contain lowercase letters, numbers and hyphens." }, 400);
  }

  const data: Record<string, unknown> = {};
  for (const f of col.fields) {
    const v = payload.data?.[f.name];
    if (v === undefined || v === "") continue;
    if (f.type === "number") {
      const n = Number(v);
      if (Number.isNaN(n)) return json({ error: `${f.label} must be a number` }, 400);
      data[f.name] = n;
    } else if (f.type === "boolean") {
      data[f.name] = v === true || v === "true" || v === "on";
    } else {
      data[f.name] = String(v);
    }
  }

  for (const f of col.fields) {
    if (f.required && (data[f.name] === undefined || data[f.name] === "")) {
      return json({ error: `${f.label} is required` }, 400);
    }
  }

  try {
    const res = await saveItem(session.token, col, {
      slug,
      path: payload.path || undefined,
      data,
      body: payload.body,
      sha: payload.sha || undefined,
    });
    return json({ ok: true, slug, sha: res.sha, commit: res.commit });
  } catch (err) {
    if (err instanceof ConflictError) {
      const current = await loadItem(session.token, col, slug).catch(() => null);
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
