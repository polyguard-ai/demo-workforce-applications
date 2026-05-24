/**
 * Polyguard browser SDK ships as `@polyguard/sdk` on npm. We bundle it via
 * a dynamic `import()` (see `lib/load-polyguard.ts`) so it lands in a
 * client chunk rather than the initial bundle, and to keep its `window`
 * references away from SSR.
 */
export const POLYGUARD_APP_ID =
  process.env.NEXT_PUBLIC_POLYGUARD_APP_ID || 'demo-workforce-applications';
export const POLYGUARD_API_SERVER =
  process.env.NEXT_PUBLIC_POLYGUARD_API_SERVER || 'api.polyguard.ai';

/**
 * Shape of the resolved value from `client.verify(target, rawJwt = true)`.
 *
 * The SDK resolves with `{ jwt: <WebSocket message body> }`. That body is
 * an OBJECT — not a JWT string — even though the field is named `jwt`. It
 * contains the decoded verification bundle plus the actual signed JWT in
 * `raw_jwt`.
 *
 * `link_uuid` is NOT a top-level field. It is the last path segment of
 * `redirect_url` (`/success/{link_uuid}`).
 */
export type PolyguardJwtBundle = {
  status?: 'success' | 'failure';
  reason?: string | null;
  redirect_url?: string;
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  pg_jwt_type?: string;
  presence?: { score: string | number; [k: string]: unknown };
  verification?: Record<string, unknown>;
  jwts?: Record<string, unknown>;
  raw_jwt?: string;
  [k: string]: unknown;
};

export type PolyguardVerifyResponse = {
  jwt?: PolyguardJwtBundle;
  presence?: { score: string | number };
  [k: string]: unknown;
};

export function extractLinkUuid(response: PolyguardVerifyResponse): string | undefined {
  const redirect = response?.jwt?.redirect_url;
  if (!redirect || typeof redirect !== 'string') return undefined;
  const m = redirect.match(/\/success\/([^/?#]+)/);
  return m?.[1];
}

export type PolyguardClientConstructor = new (config: {
  appId: string;
  apiServer: string;
  requiredProofs?: string[];
  scanType?: 'single' | 'multi';
  [k: string]: unknown;
}) => {
  verify(target?: string, rawJwt?: boolean): Promise<string | PolyguardVerifyResponse>;
  require(
    expectedProofs: Record<string, string>,
    target?: string,
  ): Promise<boolean>;
};

declare global {
  interface Window {
    Polyguard?: { Client: PolyguardClientConstructor };
  }
}

/**
 * Proof set for a job application: authentic identity (name), live
 * on-device presence, attested hardware, and administrative region. This
 * is the bar that prevents an attacker from completing the application
 * with stolen documents, a re-streamed face, or a spoofed location.
 */
export const REQUIRED_PROOFS_FOR_APPLICATION = [
  'name',
  'pg_presence',
  'pg_attestation_key_id',
  'pg_region',
];
