import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { PitStop } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kv = getKV();
    const stops = await kv.get<PitStop[]>(KV_KEYS.stops) ?? [];
    return NextResponse.json(stops);
  } catch (error) {
    console.error('GET /api/stops error:', error);
    return NextResponse.json({ error: 'Failed to fetch stops' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const kv = getKV();
    const { name, description, lng, lat, addedBy } = await req.json();

    const newStop: PitStop = {
      id: crypto.randomUUID(),
      name,
      description,
      lng,
      lat,
      addedBy,
      addedAt: new Date().toISOString(),
    };

    const stops = await kv.get<PitStop[]>(KV_KEYS.stops) ?? [];
    stops.push(newStop);
    await kv.set(KV_KEYS.stops, stops);

    return NextResponse.json(newStop);
  } catch (error) {
    console.error('POST /api/stops error:', error);
    return NextResponse.json({ error: 'Failed to add stop' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const kv = getKV();
    const { id } = await req.json();

    const stops = await kv.get<PitStop[]>(KV_KEYS.stops) ?? [];
    const filtered = stops.filter((s) => s.id !== id);
    await kv.set(KV_KEYS.stops, filtered);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/stops error:', error);
    return NextResponse.json({ error: 'Failed to delete stop' }, { status: 500 });
  }
}
