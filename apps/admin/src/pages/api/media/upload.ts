import type { APIRoute } from "astro";
import { uploadMedia, MAX_BYTES } from "@/lib/media";

export const prerender = false;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async (ctx) => {
  const session = ctx.locals.session;
  if (!session) return json({ error: "Not authenticated" }, 401);

  let payload: { name: string; base64: string; bytes: number };
  try {
    payload = await ctx.request.json();
  } catch {
    return json({ error: "Malformed request" }, 400);
  }
  if (!payload.name || !payload.base64) return json({ error: "name and base64 are required" }, 400);
  if (payload.bytes > MAX_BYTES) {
    return json({ error: `Too large. The limit is ${MAX_BYTES / 1024}KB.` }, 413);
  }

  try {
    const res = await uploadMedia(session.token, payload);
    return json({ ok: true, ...res });
  } catch (err) {
    // A rejected filename or type is the caller's problem, not the upstream's.
    return json({ error: (err as Error).message }, 400);
  }
};
