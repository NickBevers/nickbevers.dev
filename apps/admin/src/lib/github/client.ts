// Shared GitHub REST plumbing
import { CONTENT_REPO } from "astro:env/server";

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
    if (res.status === 422 && /sha/i.test(msg)) throw new ConflictError();
    throw new GitHubError(`GitHub ${res.status}: ${msg}`, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// base64 that survives non-ASCII
export const encode = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)));

export const decode = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
