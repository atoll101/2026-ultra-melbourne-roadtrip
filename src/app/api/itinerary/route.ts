import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { ItineraryNotes } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kv = getKV();
    const notes = await kv.get<ItineraryNotes>(KV_KEYS.itinerary) ?? {};
    return NextResponse.json(notes);
  } catch (error) {
    console.error('GET /api/itinerary error:', error);
    return NextResponse.json({ error: 'Failed to fetch itinerary notes' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const kv = getKV();
    const { dayId, content, lastEditedBy } = await req.json();

    const notes = await kv.get<ItineraryNotes>(KV_KEYS.itinerary) ?? {};
    notes[dayId] = {
      content,
      lastEditedBy,
      lastEditedAt: new Date().toISOString(),
    };
    await kv.set(KV_KEYS.itinerary, notes);

    return NextResponse.json(notes);
  } catch (error) {
    console.error('PUT /api/itinerary error:', error);
    return NextResponse.json({ error: 'Failed to update itinerary' }, { status: 500 });
  }
}
