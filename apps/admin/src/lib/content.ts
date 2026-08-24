// Generic content operations, driven by a CollectionDef
import { listDir, readFile, writeFile } from "./github/contents";
import { parse, serialiseFields, slugify } from "./frontmatter";
import type { CollectionDef } from "./collections";
import { PREVIEW, previewListItems, previewLoadItem, previewSaveItem } from "./preview";
import { ConflictError } from "./github/client";

type Data = Record<string, unknown>;

function typed(col: CollectionDef, data: Data): Data {
  const out: Data = { ...data };
  for (const f of col.fields) {
    const v = out[f.name];
    if (v === undefined || v === "") continue;
    if (f.type === "number") out[f.name] = Number(v);
    if (f.type === "boolean") out[f.name] = v === true || v === "true";
  }
  return out;
}

/** Reject anything that is not a plain filename in the collection directory. */
export function contentPath(col: CollectionDef, slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Unsafe slug: ${slug}`);
  return `${col.dir}/${slug}${col.ext}`;
}

export async function listItems(token: string, col: CollectionDef) {
  if (PREVIEW) return previewListItems(col.key);
  const files = await listDir(token, col.dir);
  return files
    .filter((f) => /\.mdx?$/.test(f.path))
    .map((f) => ({
      slug: f.path.replace(/^.*\//, "").replace(/\.mdx?$/, ""),
      path: f.path,
      sha: f.sha,
    }));
}

export async function loadItem(token: string, col: CollectionDef, slug: string) {
  if (PREVIEW) {
    const f = previewLoadItem(col.key, slug);
    return f && { slug: f.slug, path: f.path, sha: f.sha, data: typed(col, f.data), body: f.body };
  }
  for (const ext of [".md", ".mdx"]) {
    const path = `${col.dir}/${slug}${ext}`;
    const file = await readFile(token, path);
    if (file) {
      const { data, body } = parse(file.text);
      return { slug, path, sha: file.sha, data: typed(col, data as Data), body };
    }
  }
  return null;
}

export async function saveItem(
  token: string,
  col: CollectionDef,
  opts: { slug: string; path?: string; data: Data; body: string; sha?: string },
) {
  const path = opts.path ?? contentPath(col, opts.slug);
  const title = String(opts.data[col.titleField] ?? opts.slug);
  const verb = opts.sha ? "Update" : "Add";

  if (PREVIEW) {
    const res = previewSaveItem(col.key, { ...opts, dir: col.dir, ext: col.ext });
    if (res.conflict) throw new ConflictError();
    return { sha: res.sha, commit: res.commit };
  }
  return writeFile(token, {
    path,
    text: serialiseFields(
      opts.data,
      col.fields.map((f) => f.name),
      opts.body,
    ),
    sha: opts.sha,
    message: `${verb} ${title}`,
  });
}

export { slugify };
