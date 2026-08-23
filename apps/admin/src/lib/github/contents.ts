/**
 * Single-file reads and writes through the Contents API.
 *
 * One file, one commit, and the blob `sha` gives optimistic concurrency for
 * free: send the sha you loaded, and GitHub refuses the write if anyone has
 * touched the file since. That refusal is the whole reason to use this
 * endpoint for saving rather than the Trees API.
 */
import { gh, repo, encode, decode, type GitHubError } from "./client";

export interface FileContent {
  path: string;
  text: string;
  /** Blob sha. Pass it back on the next save. */
  sha: string;
}

interface ContentsResponse {
  content: string;
  sha: string;
  path: string;
  type: string;
}

export async function readFile(token: string, path: string): Promise<FileContent | null> {
  const { owner, name } = repo();
  try {
    const res = await gh<ContentsResponse>(
      token,
      `/repos/${owner}/${name}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    );
    if (res.type !== "file") return null;
    return { path: res.path, text: decode(res.content), sha: res.sha };
  } catch (err) {
    if ((err as GitHubError).status === 404) return null;
    throw err;
  }
}

export async function listDir(token: string, path: string) {
  const { owner, name } = repo();
  try {
    const res = await gh<ContentsResponse[]>(
      token,
      `/repos/${owner}/${name}/contents/${encodeURIComponent(path).replace(/%2F/g, "/")}`,
    );
    return res.filter((f) => f.type === "file");
  } catch (err) {
    if ((err as GitHubError).status === 404) return [];
    throw err;
  }
}

/**
 * Write one file. Omit `sha` to create, pass it to update.
 *
 * Throws ConflictError when the sha is stale. The caller must show the user
 * what changed rather than retrying, because retrying is how you silently
 * discard someone's work.
 */
export async function writeFile(
  token: string,
  opts: { path: string; text: string; message: string; sha?: string },
): Promise<{ sha: string; commit: string }> {
  const { owner, name } = repo();
  const res = await gh<{ content: { sha: string }; commit: { sha: string } }>(
    token,
    `/repos/${owner}/${name}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, "/")}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: opts.message,
        content: encode(opts.text),
        ...(opts.sha ? { sha: opts.sha } : {}),
      }),
    },
  );
  return { sha: res.content.sha, commit: res.commit.sha };
}

export async function deleteFile(
  token: string,
  opts: { path: string; sha: string; message: string },
) {
  const { owner, name } = repo();
  await gh(
    token,
    `/repos/${owner}/${name}/contents/${encodeURIComponent(opts.path).replace(/%2F/g, "/")}`,
    { method: "DELETE", body: JSON.stringify({ message: opts.message, sha: opts.sha }) },
  );
}
