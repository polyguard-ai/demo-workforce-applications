import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Receives the raw SDK verify() response when client-side extraction
 * fails, so we can inspect the actual bundle shape in Vercel logs. Lives
 * only as long as we're debugging — delete when the demo is stable.
 *
 * Logs only metadata about the response structure, NOT raw biometric
 * claims (no `verification.*` fields).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const sanitized = sanitize(body);
  console.log('[debug-bundle]', JSON.stringify(sanitized).slice(0, 2000));
  return NextResponse.json({ ok: true });
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limited]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    // Drop any nested verification claims so we don't log PII.
    if (k === 'verification' || k === 'jwts') {
      out[k] = '[redacted]';
      continue;
    }
    if (typeof v === 'string' && v.length > 600) {
      out[k] = `${v.slice(0, 80)}…[${v.length} chars]`;
      continue;
    }
    out[k] = sanitize(v, depth + 1);
  }
  return out;
}
