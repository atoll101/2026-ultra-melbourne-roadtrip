import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Eat', 'Drink', 'Sights', 'Friday Night', 'Coffee'];

// Resolve short URLs (maps.app.goo.gl) to full Google Maps URLs
async function resolveUrl(url: string): Promise<string> {
  if (!url.includes('goo.gl')) return url;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return res.url || url;
  } catch {
    return url;
  }
}

// Extract lat/lng from a Google Maps URL using regex patterns
function parseCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const p = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (p) return { lat: parseFloat(p[1]), lng: parseFloat(p[2]) };
  return null;
}

// Geocode a place name using Mapbox to get coordinates
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const { url: rawUrl } = await req.json();
    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Resolve short URL to full URL
    const url = await resolveUrl(rawUrl);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Extract place information from this Google Maps URL. Return ONLY valid JSON, no markdown.

URL: ${url}

Return this exact JSON structure:
{
  "name": "the place name",
  "description": "one short sentence about what this place is",
  "category": "one of: ${CATEGORIES.join(', ')}",
  "lat": number or null,
  "lng": number or null
}

Rules:
- "name" should be the actual business/place name, cleaned up (decode URL encoding like + to spaces)
- "description" should be brief and useful for trip planning (e.g. "Popular brunch spot in Fitzroy" or "Rooftop bar with city views")
- "category" must be exactly one of the listed options. Use "Eat" for restaurants/cafes that are primarily food, "Coffee" for coffee shops, "Drink" for bars/pubs, "Sights" for attractions/activities, "Friday Night" for nightlife/clubs
- For lat/lng: extract from the URL if present (look for @lat,lng or !3d...!4d... patterns). Return as numbers, not strings. Set to null if not found.
- If you recognise this as a known business, use your knowledge to provide an accurate description and category`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'Sights';
    }

    // Fallback: if Gemini didn't return coords, try parsing from the resolved URL
    if (parsed.lat == null || parsed.lng == null) {
      const urlCoords = parseCoordsFromUrl(url);
      if (urlCoords) {
        parsed.lat = urlCoords.lat;
        parsed.lng = urlCoords.lng;
      }
    }

    // Final fallback: geocode by place name using Mapbox
    if (parsed.lat == null || parsed.lng == null) {
      const geoCoords = await geocodePlace(parsed.name || '');
      if (geoCoords) {
        parsed.lat = geoCoords.lat;
        parsed.lng = geoCoords.lng;
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('POST /api/extract-place error:', error);
    return NextResponse.json({ error: 'Failed to extract place info' }, { status: 500 });
  }
}
