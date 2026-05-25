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

/**
 * Returns the link_uuid embedded in the SDK's resolved `redirect_url`.
 *
 * The historical shape was `/success/<link_uuid>`. The current SDK emits
 * a longer path (e.g. `/success/by-app/<app_id>/<link_uuid>`), so we
 * extract the *last* non-empty path segment rather than the first segment
 * after `/success/`. That's robust to further path-shape changes as long
 * as the uuid stays at the tail.
 */
export function extractLinkUuid(response: PolyguardVerifyResponse): string | undefined {
  const redirect = response?.jwt?.redirect_url;
  if (!redirect || typeof redirect !== 'string') return undefined;
  let pathname = redirect;
  try {
    pathname = new URL(redirect, 'https://placeholder.invalid').pathname;
  } catch {
    // Not a URL — fall through and treat the string as a bare path.
    pathname = redirect.split('?')[0]!.split('#')[0]!;
  }
  const segments = pathname.split('/').filter(Boolean);
  return segments[segments.length - 1];
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
 * Proof set Polyguard Mobile must satisfy before the application is
 * accepted. Defaults to `pg_presence` only — the universally-available
 * "real person, real device" proof — so the demo works against any
 * enrolled mobile account. Set `NEXT_PUBLIC_POLYGUARD_REQUIRED_PROOFS`
 * (comma-separated) to raise the bar — e.g.
 * `name,pg_presence,pg_attestation_key_id,pg_region` for a full
 * production-grade workforce check.
 */
export const REQUIRED_PROOFS_FOR_APPLICATION = (
  process.env.NEXT_PUBLIC_POLYGUARD_REQUIRED_PROOFS || 'pg_presence'
)
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);
