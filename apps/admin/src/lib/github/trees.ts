// Multi-file atomic commits through the Git Data API
import { gh, repo, encode, ConflictError } from "./client";

export interface FileChange {
  path: string;
  /** UTF-8 text. Binary is not supported here; images go via Contents. */
  text: string;
}

export async function headCommit(token: string, branch = "main") {
  const { owner, name } = repo();
  const ref = await gh<{ object: { sha: string } }>(
    token,
    `/repos/${owner}/${name}/git/ref/heads/${branch}`,
  );
  return ref.object.sha;
}

// Commit several files at once
export async function commitFiles(
  token: string,
  opts: {
    files: FileChange[];
    message: string;
    branch?: string;
    expectedHead?: string;
  },
): Promise<{ commit: string }> {
  const { owner, name } = repo();
  const branch = opts.branch ?? "main";
  const base = `/repos/${owner}/${name}`;

  const head = await headCommit(token, branch);
  if (opts.expectedHead && opts.expectedHead !== head) {
    throw new ConflictError("Someone pushed to the repository while you were editing.");
  }

  const commit = await gh<{ tree: { sha: string } }>(token, `${base}/git/commits/${head}`);

  // 1. a blob per file
  const blobs = await Promise.all(
    opts.files.map((f) =>
      gh<{ sha: string }>(token, `${base}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({ content: encode(f.text), encoding: "base64" }),
      }).then((b) => ({ path: f.path, sha: b.sha })),
    ),
  );

  // 2. a tree built on the current one
  const tree = await gh<{ sha: string }>(token, `${base}/git/trees`, {
    method: "POST",
    body: JSON.stringify({
      base_tree: commit.tree.sha,
      tree: blobs.map((b) => ({ path: b.path, mode: "100644", type: "blob", sha: b.sha })),
    }),
  });

  // 3. the commit
  const made = await gh<{ sha: string }>(token, `${base}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: opts.message, tree: tree.sha, parents: [head] }),
  });

  // 4
  await gh(token, `${base}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: made.sha, force: false }),
  });

  return { commit: made.sha };
}
