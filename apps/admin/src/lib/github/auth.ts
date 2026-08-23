/**
 * GitHub App user-to-server OAuth.
 *
 * A GitHub App, not an OAuth App: the classic `repo` scope grants write to
 * every repository the user can reach, which is an indefensible blast radius
 * for a panel on the public internet. A GitHub App's installation is scoped
 * to one repository with `contents: write`, and its user tokens expire in 8
 * hours rather than living forever.
 */
import {
  ALLOWED_LOGIN,
  ALLOWED_USER_ID,
  GITHUB_APP_CLIENT_ID,
  GITHUB_APP_CLIENT_SECRET,
} from "astro:env/server";

const AUTHORIZE = "https://github.com/login/oauth/authorize";
const TOKEN = "https://github.com/login/oauth/access_token";
const USER = "https://api.github.com/user";

export interface TokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type: string;
}

export interface GitHubUser {
  login: string;
  id: number;
  name: string | null;
  avatar_url: string;
}

/** Random, URL-safe, and long enough that guessing it is not a strategy. */
export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function authorizeUrl(state: string, redirectUri: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", GITHUB_APP_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.href;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: GITHUB_APP_CLIENT_ID,
      client_secret: GITHUB_APP_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);

  // GitHub answers 200 with an `error` field rather than a 4xx.
  const data = (await res.json()) as TokenResponse & { error?: string; error_description?: string };
  if (data.error) throw new Error(`Token exchange failed: ${data.error_description ?? data.error}`);
  if (!data.access_token) throw new Error("Token exchange returned no access_token");
  return data;
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  const res = await fetch(USER, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "nickbevers-admin",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`Could not read the authenticated user: ${res.status}`);
  return (await res.json()) as GitHubUser;
}

/**
 * The gate. Checks the numeric id AND the login.
 *
 * The id is the real check: logins can be renamed and re-registered, so a
 * login-only allowlist can be defeated by someone claiming an abandoned
 * username. The login is checked too so a mismatch is caught rather than
 * silently trusted.
 */
export function isAllowed(user: GitHubUser): boolean {
  return user.id === ALLOWED_USER_ID && user.login.toLowerCase() === ALLOWED_LOGIN.toLowerCase();
}
