import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { ItineraryData } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kv = getKV();
    const data = await kv.get<ItineraryData>(KV_KEYS.itinerary) ?? {};
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/itinerary error:', error);
    return NextResponse.json({ error: 'Failed to fetch itinerary' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const kv = getKV();
    const body = await req.json();
    const { dayId, lastEditedBy } = body;

    const data = await kv.get<ItineraryData>(KV_KEYS.itinerary) ?? {};
    const existing = data[dayId] ?? { notes: '', spots: [], spotTimes: {}, lastEditedBy: '', lastEditedAt: '' };

    // Support updating notes, spots, spotTimes, or any combination
    if ('notes' in body) existing.notes = body.notes;
    if ('spots' in body) existing.spots = body.spots;
    if ('spotTimes' in body) existing.spotTimes = body.spotTimes;
    existing.lastEditedBy = lastEditedBy;
    existing.lastEditedAt = new Date().toISOString();

    data[dayId] = existing;
    await kv.set(KV_KEYS.itinerary, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('PUT /api/itinerary error:', error);
    return NextResponse.json({ error: 'Failed to update itinerary' }, { status: 500 });
  }
}
