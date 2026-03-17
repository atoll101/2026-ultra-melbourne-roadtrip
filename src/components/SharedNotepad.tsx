'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAutosave } from '@/hooks/useAutosave';
import { POLL_INTERVAL } from '@/lib/constants';
import type { NotepadData } from '@/lib/types';

export default function SharedNotepad({ userName }: { userName: string }) {
  const [content, setContent] = useState('');
  const [lastEditedBy, setLastEditedBy] = useState('');
  const [lastEditedAt, setLastEditedAt] = useState('');
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotepad = useCallback(async () => {
    try {
      const res = await fetch('/api/notepad');
      if (!res.ok) return;
      const data: NotepadData = await res.json();
      if (!isTypingRef.current) setContent(data.content ?? '');
      setLastEditedBy(data.lastEditedBy ?? '');
      setLastEditedAt(data.lastEditedAt ?? '');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchNotepad(); }, [fetchNotepad]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => { timer = setInterval(() => { if (document.visibilityState === 'visible') fetchNotepad(); }, POLL_INTERVAL); };
    const handleVis = () => { clearInterval(timer); if (document.visibilityState === 'visible') { fetchNotepad(); start(); } };
    start();
    document.addEventListener('visibilitychange', handleVis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', handleVis); };
  }, [fetchNotepad]);

  const saveContent = useCallback(async () => {
    try {
      await fetch('/api/notepad', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, lastEditedBy: userName }),
      });
      setLastEditedBy(userName);
      setLastEditedAt(new Date().toISOString());
    } catch { /* ignore */ }
    isTypingRef.current = false;
  }, [content, userName]);

  const trigger = useAutosave(saveContent);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    isTypingRef.current = true;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { isTypingRef.current = false; }, 5000);
    trigger();
  };

  const time = lastEditedAt ? new Date(lastEditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <section id="notepad" className="py-10 px-4 md:px-6 max-w-2xl mx-auto">
      <h2 className="font-display text-lg font-bold text-text-primary mb-1">Notepad</h2>
      <p className="text-text-muted text-sm mb-4">Shared space — everyone can see and edit.</p>

      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Jot down anything — ideas, links, reminders..."
        className="w-full bg-white border border-border rounded-lg p-4 min-h-[180px] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 resize-y shadow-sm"
      />
      {lastEditedBy && (
        <p className="text-xs text-text-muted mt-2">
          edited by {lastEditedBy}{time ? ` at ${time}` : ''}
        </p>
      )}
    </section>
  );
}
