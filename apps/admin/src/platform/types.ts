/**
 * The platform seam.
 *
 * Everything the admin needs from its host is declared here as an interface.
 * The Cloudflare and Node implementations sit beside this file, and NOTHING
 * else in the app may import a runtime API directly: oxlint enforces that.
 *
 * Without this the "swap the adapter" promise is fiction: one
 * `locals.runtime.env` in a route and the Node build stops working.
 */

/** Session storage. Both implementations are stateless-cookie-backed today. */
export interface SessionStore {
  /** Sign and encode a payload for a cookie. */
  seal(payload: SessionPayload): Promise<string>;
  /** Verify and decode. Returns null for tampered, expired or malformed input. */
  unseal(token: string): Promise<SessionPayload | null>;
}

export interface SessionPayload {
  /** GitHub login, kept for display. */
  login: string;
  /** Numeric GitHub id. The value actually checked on the allowlist. */
  userId: number;
  /** The user-to-server token. Never leaves the server. */
  token: string;
  /** Unix seconds. */
  expiresAt: number;
}

/** Runtime facts that differ per host. */
export interface Platform {
  session: SessionStore;
  /** Cookie `Secure` must be off on plain-http localhost or nothing persists. */
  isSecureContext(request: Request): boolean;
}
