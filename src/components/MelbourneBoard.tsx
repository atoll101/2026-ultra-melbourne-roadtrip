'use client';

import { useState, useEffect, useCallback } from 'react';
import { POLL_INTERVAL, MELBOURNE_CATEGORIES } from '@/lib/constants';
import type { MelbourneIdea } from '@/lib/types';

interface MelbourneBoardProps {
  userName: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Eat: '🍜',
  Drink: '🍸',
  Sights: '📸',
  'Friday Night': '🌙',
  Coffee: '☕',
};

export default function MelbourneBoard({ userName }: MelbourneBoardProps) {
  const [ideas, setIdeas] = useState<MelbourneIdea[]>([]);
  const [newTexts, setNewTexts] = useState<Record<string, string>>({});

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/ideas');
      if (!res.ok) return;
      const data: MelbourneIdea[] = await res.json();
      setIdeas(data);
    } catch {
      // ignore
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  // Poll with visibility pause
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchIdeas();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        fetchIdeas();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchIdeas]);

  const toggleUpvote = async (ideaId: string) => {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea;
        const hasUpvoted = idea.upvotedBy.includes(userName);
        return {
          ...idea,
          upvotedBy: hasUpvoted
            ? idea.upvotedBy.filter((u) => u !== userName)
            : [...idea.upvotedBy, userName],
        };
      })
    );

    try {
      const res = await fetch('/api/ideas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ideaId, userName }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // Revert on failure
      fetchIdeas();
    }
  };

  const addIdea = async (category: string) => {
    const text = (newTexts[category] ?? '').trim();
    if (!text) return;

    setNewTexts((prev) => ({ ...prev, [category]: '' }));

    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, text, author: userName }),
      });
      if (res.ok) {
        const newIdea: MelbourneIdea = await res.json();
        setIdeas((prev) => [...prev, newIdea]);
      }
    } catch {
      // ignore
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, category: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addIdea(category);
    }
  };

  const ideasByCategory = (category: string) =>
    ideas
      .filter((i) => i.category === category)
      .sort((a, b) => b.upvotedBy.length - a.upvotedBy.length);

  return (
    <section id="melbourne" className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-text-primary">Melbourne Hit List</h2>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {MELBOURNE_CATEGORIES.map((category) => (
          <div key={category} className="bg-surface rounded-xl border border-border p-4 space-y-3">
            <h3 className="font-display font-semibold text-text-primary flex items-center gap-2">
              <span>{CATEGORY_EMOJI[category]}</span>
              <span>{category}</span>
            </h3>

            <div className="space-y-2">
              {ideasByCategory(category).map((idea) => {
                const hasUpvoted = idea.upvotedBy.includes(userName);
                return (
                  <div
                    key={idea.id}
                    className="bg-surface-alt rounded-lg p-3 space-y-2"
                  >
                    <p className="text-sm text-text-primary">{idea.text}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">by {idea.author}</span>
                      <button
                        type="button"
                        onClick={() => toggleUpvote(idea.id)}
                        className={`flex items-center gap-1 text-sm transition-colors ${
                          hasUpvoted
                            ? 'text-accent-pink'
                            : 'text-text-muted hover:text-accent-pink'
                        }`}
                        aria-label={hasUpvoted ? 'Remove upvote' : 'Upvote'}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill={hasUpvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                          />
                        </svg>
                        <span>{idea.upvotedBy.length}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTexts[category] ?? ''}
                onChange={(e) => setNewTexts((prev) => ({ ...prev, [category]: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, category)}
                placeholder="Add idea..."
                className="flex-1 min-w-0 bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-pink"
              />
              <button
                type="button"
                onClick={() => addIdea(category)}
                className="text-accent-pink hover:text-accent-pink/80 transition-colors"
                aria-label={`Add idea to ${category}`}
              >
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
