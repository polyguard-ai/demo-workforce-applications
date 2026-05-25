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
 * The path shape has changed twice during this demo's lifetime:
 *   - Historical: `/success/<link_uuid>`
 *   - Current:    `/success/by-app/<link_uuid>/<app_id>`
 *
 * Neither "first segment after /success/" nor "last path segment" works
 * across both. Instead, walk the path and return the first segment that
 * isn't a known structural word and isn't the configured app_id. That
 * lands on the link_uuid regardless of where in the path it sits.
 *
 * A skip-set of literal structural segments keeps this resilient to
 * future tail/middle reorderings; expand it if the SDK introduces new
 * ones.
 */
const STRUCTURAL_PATH_SEGMENTS = new Set([
  'success',
  'by-app',
  'verify',
  'v',
  'v1',
  'v2',
]);

export function extractLinkUuid(
  response: PolyguardVerifyResponse,
  appId: string = POLYGUARD_APP_ID,
): string | undefined {
  const redirect = response?.jwt?.redirect_url;
  if (!redirect || typeof redirect !== 'string') return undefined;
  let pathname = redirect;
  try {
    pathname = new URL(redirect, 'https://placeholder.invalid').pathname;
  } catch {
    pathname = redirect.split('?')[0]!.split('#')[0]!;
  }
  const segments = pathname.split('/').filter(Boolean);
  for (const seg of segments) {
    if (STRUCTURAL_PATH_SEGMENTS.has(seg)) continue;
    if (appId && seg === appId) continue;
    return seg;
  }
  return undefined;
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
