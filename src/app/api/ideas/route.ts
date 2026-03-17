import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { MelbourneIdea } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kv = getKV();
    const ideas = await kv.get<MelbourneIdea[]>(KV_KEYS.ideas) ?? [];
    return NextResponse.json(ideas);
  } catch (error) {
    console.error('GET /api/ideas error:', error);
    return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const kv = getKV();
    const { category, text, author } = await req.json();

    const newIdea: MelbourneIdea = {
      id: crypto.randomUUID(),
      category,
      text,
      author,
      upvotedBy: [],
      createdAt: new Date().toISOString(),
    };

    const ideas = await kv.get<MelbourneIdea[]>(KV_KEYS.ideas) ?? [];
    ideas.push(newIdea);
    await kv.set(KV_KEYS.ideas, ideas);

    return NextResponse.json(newIdea);
  } catch (error) {
    console.error('POST /api/ideas error:', error);
    return NextResponse.json({ error: 'Failed to add idea' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const kv = getKV();
    const { id, userName } = await req.json();

    const ideas = await kv.get<MelbourneIdea[]>(KV_KEYS.ideas) ?? [];
    const idea = ideas.find((i) => i.id === id);

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    const idx = idea.upvotedBy.indexOf(userName);
    if (idx >= 0) {
      idea.upvotedBy.splice(idx, 1);
    } else {
      idea.upvotedBy.push(userName);
    }

    await kv.set(KV_KEYS.ideas, ideas);

    return NextResponse.json(idea);
  } catch (error) {
    console.error('PUT /api/ideas error:', error);
    return NextResponse.json({ error: 'Failed to toggle upvote' }, { status: 500 });
  }
}
