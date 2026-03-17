import { NextRequest, NextResponse } from 'next/server';
import { getKV } from '@/lib/kv';
import { KV_KEYS, SEED_CHECKLIST } from '@/lib/constants';
import type { ChecklistItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const kv = getKV();
    let checklist = await kv.get<ChecklistItem[]>(KV_KEYS.checklist);

    if (!checklist || checklist.length === 0) {
      checklist = SEED_CHECKLIST.map((item) => ({
        id: crypto.randomUUID(),
        label: item.label,
        checked: false,
        addedBy: item.addedBy,
      }));
      await kv.set(KV_KEYS.checklist, checklist);
    }

    return NextResponse.json(checklist);
  } catch (error) {
    console.error('GET /api/checklist error:', error);
    return NextResponse.json({ error: 'Failed to fetch checklist' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const kv = getKV();
    const checklist: ChecklistItem[] = await req.json();

    await kv.set(KV_KEYS.checklist, checklist);

    return NextResponse.json(checklist);
  } catch (error) {
    console.error('PUT /api/checklist error:', error);
    return NextResponse.json({ error: 'Failed to update checklist' }, { status: 500 });
  }
}
