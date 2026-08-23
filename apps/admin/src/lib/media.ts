/**
 * Images in the content repository.
 *
 * Uploads go through the Contents API with base64, which is the only way to
 * commit a binary. GitHub's practical ceiling for that endpoint is around
 * 1MB before it starts refusing, and base64 inflates by a third, so anything
 * over ~700KB of source is rejected here with a clear message rather than
 * failing opaquely upstream.
 */
import { gh, repo } from "./github/client";
import { listDir } from "./github/contents";
import { PREVIEW } from "./preview";

const DIR = "apps/site/src/assets/uploads";

/** 700KB of source; base64 pushes that to roughly 950KB on the wire. */
export const MAX_BYTES = 700 * 1024;

export const ALLOWED = new Set(["png", "jpg", "jpeg", "webp", "avif", "svg", "gif"]);

const previewStore: { name: string; path: string; size: number }[] = [
  { name: "ardennes.jpg", path: `${DIR}/ardennes.jpg`, size: 184_320 },
  { name: "sourdough.webp", path: `${DIR}/sourdough.webp`, size: 96_100 },
];

export function safeName(input: string): string {
  const ext = (input.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error(`Unsupported file type: .${ext}`);
  const stem = input
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  if (!stem) throw new Error("That filename has no usable characters.");
  return `${stem}.${ext}`;
}

export async function listMedia(token: string) {
  if (PREVIEW) return previewStore;
  const files = await listDir(token, DIR);
  return files.map((f) => ({
    name: f.path.replace(/^.*\//, ""),
    path: f.path,
    size: (f as unknown as { size?: number }).size ?? 0,
  }));
}

export async function uploadMedia(
  token: string,
  opts: { name: string; base64: string; bytes: number },
) {
  const name = safeName(opts.name);
  if (opts.bytes > MAX_BYTES) {
    throw new Error(
      `That file is ${(opts.bytes / 1024).toFixed(0)}KB. The limit is ${MAX_BYTES / 1024}KB. Resize it first.`,
    );
  }

  const path = `${DIR}/${name}`;

  if (PREVIEW) {
    previewStore.push({ name, path, size: opts.bytes });
    return { path, name, commit: "preview" };
  }

  const { owner, name: repoName } = repo();
  const res = await gh<{ commit: { sha: string } }>(
    token,
    `/repos/${owner}/${repoName}/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({ message: `Add image ${name}`, content: opts.base64 }),
    },
  );
  return { path, name, commit: res.commit.sha };
}

export { DIR as MEDIA_DIR };
