'use client';

import { useState, useEffect, useCallback } from 'react';
import { POLL_INTERVAL } from '@/lib/constants';
import type { ChecklistItem } from '@/lib/types';

interface PackingChecklistProps {
  userName: string;
}

export default function PackingChecklist({ userName }: PackingChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newLabel, setNewLabel] = useState('');

  const fetchChecklist = useCallback(async () => {
    try {
      const res = await fetch('/api/checklist');
      if (!res.ok) return;
      const data: ChecklistItem[] = await res.json();
      setItems(data);
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  // Poll with visibility pause
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchChecklist();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        fetchChecklist();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchChecklist]);

  const saveChecklist = async (updated: ChecklistItem[]) => {
    try {
      await fetch('/api/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch {
      // ignore
    }
  };

  const toggleItem = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(updated);
    saveChecklist(updated);
  };

  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    const newItem: ChecklistItem = {
      id: crypto.randomUUID(),
      label,
      checked: false,
      addedBy: userName,
    };
    const updated = [...items, newItem];
    setItems(updated);
    setNewLabel('');
    saveChecklist(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  return (
    <section id="packing" className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-text-primary">Packing Checklist</h2>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 group">
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                item.checked
                  ? 'bg-accent-lime border-accent-lime'
                  : 'border-border bg-transparent hover:border-accent-lime/50'
              }`}
              aria-label={`Toggle ${item.label}`}
            >
              {item.checked && (
                <svg className="w-3 h-3 text-bg" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </button>
            <span className={`flex-1 ${item.checked ? 'line-through text-text-muted' : 'text-text-primary'}`}>
              {item.label}
            </span>
            <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
              added by {item.addedBy}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add an item..."
          className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-lime"
        />
        <button
          type="button"
          onClick={addItem}
          className="bg-surface-alt border border-border rounded-xl px-4 py-2 text-accent-lime hover:bg-accent-lime/10 transition-colors"
          aria-label="Add item"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
          </svg>
        </button>
      </div>
    </section>
  );
}
