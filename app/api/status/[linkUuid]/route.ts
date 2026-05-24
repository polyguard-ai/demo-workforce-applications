import { NextResponse } from 'next/server';
import { getPayload } from '@/lib/webhook-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ linkUuid: string }> },
) {
  const { linkUuid } = await params;
  if (!linkUuid || linkUuid.length > 128) {
    return NextResponse.json({ error: 'bad link_uuid' }, { status: 400 });
  }
  const payload = await getPayload(linkUuid);
  if (!payload) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(payload);
}
