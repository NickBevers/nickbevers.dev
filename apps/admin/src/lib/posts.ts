/**
 * Post operations, shared by the routes.
 *
 * The content path is derived once here rather than repeated: every write
 * lands under src/content/entries and nowhere else, so a bug in a route
 * cannot commit to an arbitrary path in the repo.
 */
import { listDir, readFile, writeFile } from "./github/contents";
import { commitFiles, headCommit as ghHeadCommit } from "./github/trees";
import { ConflictError } from "./github/client";

/** Preview short-circuits before any network call. */
export const headCommit = (token: string, branch = "main") =>
  PREVIEW ? Promise.resolve(previewHead()) : ghHeadCommit(token, branch);
import { parse, serialise, slugify, type Frontmatter } from "./frontmatter";
import { PREVIEW, previewList, previewLoad, previewSave, previewHead } from "./preview";

const DIR = "apps/site/src/content/entries";

/** Reject anything that is not a plain filename in the entries directory. */
export function entryPath(slug: string): string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) throw new Error(`Unsafe slug: ${slug}`);
  return `${DIR}/${slug}.mdx`;
}

export async function listPosts(token: string) {
  if (PREVIEW) return previewList();
  const files = await listDir(token, DIR);
  return files
    .filter((f) => /\.mdx?$/.test(f.path))
    .map((f) => ({
      slug: f.path.replace(/^.*\//, "").replace(/\.mdx?$/, ""),
      path: f.path,
      sha: f.sha,
    }));
}

export async function loadPost(token: string, slug: string) {
  if (PREVIEW) return previewLoad(slug);
  // Try .mdx then .md: existing posts use both.
  for (const ext of [".mdx", ".md"]) {
    const path = `${DIR}/${slug}${ext}`;
    const file = await readFile(token, path);
    if (file) {
      const { data, body } = parse(file.text);
      return { slug, path, sha: file.sha, data, body };
    }
  }
  return null;
}

export async function savePost(
  token: string,
  opts: { slug: string; path?: string; data: Partial<Frontmatter>; body: string; sha?: string },
) {
  const path = opts.path ?? entryPath(opts.slug);

  if (PREVIEW) {
    const res = previewSave(opts);
    if (res.conflict) throw new ConflictError();
    return { sha: res.sha, commit: res.commit };
  }

  const text = serialise(opts.data, opts.body);
  const verb = opts.sha ? "Update" : "Add";
  return writeFile(token, {
    path,
    text,
    sha: opts.sha,
    message: `${verb} ${opts.data.title ?? opts.slug}`,
  });
}

/**
 * Publish: clear the draft flag, stamp the date, and commit atomically.
 *
 * Uses Trees rather than Contents so that publishing can grow to touch more
 * than one file. A colocated image, an index: without ever leaving the
 * repository in a half-published state.
 */
export async function publishPost(
  token: string,
  opts: {
    slug: string;
    path: string;
    data: Partial<Frontmatter>;
    body: string;
    expectedHead?: string;
  },
) {
  const data: Partial<Frontmatter> = {
    ...opts.data,
    draft: false,
    placeholder: false,
    pubDate: opts.data.pubDate || new Date().toISOString().slice(0, 10),
  };
  if (PREVIEW) {
    previewSave({ slug: opts.slug, data, body: opts.body });
    return { commit: "preview-publish" };
  }

  return commitFiles(token, {
    files: [{ path: opts.path, text: serialise(data, opts.body) }],
    message: `Publish ${data.title ?? opts.slug}`,
    expectedHead: opts.expectedHead,
  });
}

export { slugify };
