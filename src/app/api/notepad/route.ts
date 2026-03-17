import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS } from '@/lib/constants';
import type { NotepadData } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_NOTEPAD: NotepadData = {
  content: '',
  lastEditedBy: '',
  lastEditedAt: '',
};

export async function GET() {
  try {
    const kv = getKV();
    const notepad = await kv.get<NotepadData>(KV_KEYS.notepad) ?? DEFAULT_NOTEPAD;
    return NextResponse.json(notepad);
  } catch (error) {
    console.error('GET /api/notepad error:', error);
    return NextResponse.json({ error: 'Failed to fetch notepad' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const kv = getKV();
    const { content, lastEditedBy } = await req.json();

    const notepad: NotepadData = {
      content,
      lastEditedBy,
      lastEditedAt: new Date().toISOString(),
    };

    await kv.set(KV_KEYS.notepad, notepad);

    return NextResponse.json(notepad);
  } catch (error) {
    console.error('PUT /api/notepad error:', error);
    return NextResponse.json({ error: 'Failed to update notepad' }, { status: 500 });
  }
}
