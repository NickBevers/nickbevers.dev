// The platform seam

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
