import { NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { MelbourneIdea } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const p = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (p) return { lat: parseFloat(p[1]), lng: parseFloat(p[2]) };
  return null;
}

async function resolveUrl(url: string): Promise<string> {
  if (!url.includes('goo.gl')) return url;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.url || url;
  } catch {
    return url;
  }
}

async function geocodePlace(name: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const query = encodeURIComponent(`${name}, Melbourne, Australia`);
    const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1&bbox=144.5,-38.1,145.5,-37.5`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.features?.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST() {
  try {
    const kv = getKV();
    const ideas = await kv.get<MelbourneIdea[]>(KV_KEYS.ideas) ?? [];
    const missing = ideas.filter((i) => i.lat == null || i.lng == null);

    if (missing.length === 0) {
      return NextResponse.json({ message: 'All ideas already have coordinates', updated: 0 });
    }

    let updated = 0;
    for (const idea of missing) {
      // Try 1: resolve shortened URL and parse coords
      if (idea.mapsUrl) {
        const resolved = await resolveUrl(idea.mapsUrl);
        const coords = parseCoordsFromUrl(resolved);
        if (coords) {
          idea.lat = coords.lat;
          idea.lng = coords.lng;
          updated++;
          continue;
        }
      }
      // Try 2: geocode by place name
      const geoCoords = await geocodePlace(idea.text);
      if (geoCoords) {
        idea.lat = geoCoords.lat;
        idea.lng = geoCoords.lng;
        updated++;
      }
    }

    await kv.set(KV_KEYS.ideas, ideas);
    return NextResponse.json({ message: `Backfilled ${updated} of ${missing.length} ideas`, updated, total: missing.length });
  } catch (error) {
    console.error('POST /api/ideas/backfill-coords error:', error);
    return NextResponse.json({ error: 'Failed to backfill coordinates' }, { status: 500 });
  }
}
