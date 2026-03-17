import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

const CATEGORIES = ['Eat', 'Drink', 'Sights', 'Friday Night', 'Coffee'];

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 });
    }

    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Extract place information from this Google Maps URL. Return ONLY valid JSON, no markdown.

URL: ${url}

Return this exact JSON structure:
{
  "name": "the place name",
  "description": "one short sentence about what this place is",
  "category": "one of: ${CATEGORIES.join(', ')}",
  "lat": null,
  "lng": null
}

Rules:
- "name" should be the actual business/place name, cleaned up
- "description" should be brief and useful for trip planning (e.g. "Popular brunch spot in Fitzroy" or "Rooftop bar with city views")
- "category" must be exactly one of the listed options. Use "Sights" for attractions/activities, "Friday Night" for bars/nightlife/clubs
- For lat/lng: extract from the URL if present (look for @lat,lng or !3d...!4d... patterns). Set to null if not found.
- If you can't determine the place, make your best guess from the URL structure`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = text.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(jsonStr);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'Sights';
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('POST /api/extract-place error:', error);
    return NextResponse.json({ error: 'Failed to extract place info' }, { status: 500 });
  }
}
