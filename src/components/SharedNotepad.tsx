'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAutosave } from '@/hooks/useAutosave';
import { POLL_INTERVAL } from '@/lib/constants';
import type { NotepadData } from '@/lib/types';

interface SharedNotepadProps {
  userName: string;
}

export default function SharedNotepad({ userName }: SharedNotepadProps) {
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
      if (!isTypingRef.current) {
        setContent(data.content ?? '');
      }
      setLastEditedBy(data.lastEditedBy ?? '');
      setLastEditedAt(data.lastEditedAt ?? '');
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotepad();
  }, [fetchNotepad]);

  // Poll with visibility pause
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchNotepad();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        fetchNotepad();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchNotepad]);

  const saveContent = useCallback(async () => {
    try {
      await fetch('/api/notepad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, lastEditedBy: userName }),
      });
      setLastEditedBy(userName);
      setLastEditedAt(new Date().toISOString());
    } catch {
      // ignore
    }
    isTypingRef.current = false;
  }, [content, userName]);

  const trigger = useAutosave(saveContent);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    isTypingRef.current = true;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, 5000);
    trigger();
  };

  const formattedTime = lastEditedAt
    ? new Date(lastEditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <section id="notepad" className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-text-primary">Shared Notepad</h2>
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Jot down anything — ideas, links, reminders..."
        className="w-full bg-surface border border-border rounded-xl p-4 min-h-[200px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-violet resize-y"
      />
      {lastEditedBy && (
        <p className="text-sm text-text-muted">
          Last edited by {lastEditedBy} at {formattedTime}
        </p>
      )}
    </section>
  );
}
