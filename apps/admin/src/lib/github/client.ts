/**
 * Shared GitHub REST plumbing.
 *
 * Every call goes through here so the auth header, the API version pin and
 * the error shape are declared once. A 409 is surfaced as a typed error
 * rather than a generic failure, because that is the one status the editor
 * must handle differently from every other.
 */
import { CONTENT_REPO } from "astro:env/server";

/* Overridable so the write path can be tested against a mock that can
   produce a stale sha and a moved branch on demand. Those are the cases that
   matter here and they cannot be conjured against the real API: nor should
   a test suite be writing to a real repository. */
const API = process.env.GITHUB_API_BASE || "https://api.github.com";

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

/** A save whose base blob has moved on. The editor must not overwrite. */
export class ConflictError extends GitHubError {
  constructor(message = "The file changed on GitHub since you loaded it.") {
    super(message, 409);
    this.name = "ConflictError";
  }
}

export const repo = () => {
  const [owner, name] = CONTENT_REPO.split("/");
  if (!owner || !name) throw new Error(`CONTENT_REPO must be "owner/repo", got "${CONTENT_REPO}"`);
  return { owner, name };
};

export async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "nickbevers-admin",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 409) throw new ConflictError();

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    const msg = (body as { message?: string })?.message ?? res.statusText;
    // 422 on a contents PUT is also a stale-sha conflict, just reported
    // differently from 409. Treat it the same so the editor has one path.
    if (res.status === 422 && /sha/i.test(msg)) throw new ConflictError();
    throw new GitHubError(`GitHub ${res.status}: ${msg}`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* base64 that survives non-ASCII. GitHub wants base64 of the UTF-8 bytes,
   and btoa() on a string with an em dash or an accent throws. */
export const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

export const decode = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
