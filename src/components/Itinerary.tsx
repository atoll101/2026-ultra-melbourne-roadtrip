'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAutosave } from '@/hooks/useAutosave';
import { POLL_INTERVAL, TRIP_DATES } from '@/lib/constants';
import type { ItineraryNotes, DayNote } from '@/lib/types';

interface ItineraryProps {
  userName: string;
}

const EMPTY_DAY: DayNote = { content: '', lastEditedBy: '', lastEditedAt: '' };

export default function Itinerary({ userName }: ItineraryProps) {
  const [notes, setNotes] = useState<ItineraryNotes>({});
  const [expandedDay, setExpandedDay] = useState<string>(TRIP_DATES.days[0].id);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);

  const fetchItinerary = useCallback(async () => {
    try {
      const res = await fetch('/api/itinerary');
      if (!res.ok) return;
      const data: ItineraryNotes = await res.json();
      setNotes((prev) => {
        // Preserve local edits for the day being edited
        const merged = { ...data };
        if (editingDayId && prev[editingDayId]) {
          merged[editingDayId] = prev[editingDayId];
        }
        return merged;
      });
    } catch {
      // ignore
    }
  }, [editingDayId]);

  // Fetch on mount
  useEffect(() => {
    fetchItinerary();
  }, [fetchItinerary]);

  // Poll with visibility pause
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchItinerary();
        }
      }, POLL_INTERVAL);
    };

    const handleVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === 'visible') {
        fetchItinerary();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchItinerary]);

  const saveDay = useCallback(
    async (dayId: string) => {
      const dayNote = notes[dayId];
      if (!dayNote) return;
      try {
        await fetch('/api/itinerary', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayId, content: dayNote.content, lastEditedBy: userName }),
        });
      } catch {
        // ignore
      }
      setEditingDayId(null);
    },
    [notes, userName]
  );

  // Create an autosave trigger for each day — we track which day is active
  const trigger = useAutosave(
    useCallback(() => {
      if (editingDayId) return saveDay(editingDayId);
      return Promise.resolve();
    }, [editingDayId, saveDay])
  );

  const handleDayChange = (dayId: string, content: string) => {
    setEditingDayId(dayId);
    setNotes((prev) => ({
      ...prev,
      [dayId]: {
        content,
        lastEditedBy: userName,
        lastEditedAt: new Date().toISOString(),
      },
    }));
    trigger();
  };

  const toggleDay = (dayId: string) => {
    setExpandedDay((prev) => (prev === dayId ? '' : dayId));
  };

  return (
    <section id="itinerary" className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-text-primary">The Itinerary</h2>
      <div className="relative ml-4">
        {/* Vertical timeline line */}
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent-violet" />

        <div className="space-y-4 pl-8">
          {TRIP_DATES.days.map((day) => {
            const dayNote = notes[day.id] ?? EMPTY_DAY;
            const isExpanded = expandedDay === day.id;
            const formattedTime = dayNote.lastEditedAt
              ? new Date(dayNote.lastEditedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div key={day.id} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-8 top-3 w-3 h-3 rounded-full bg-accent-violet border-2 border-bg -translate-x-[5px]" />

                <button
                  type="button"
                  onClick={() => toggleDay(day.id)}
                  className="w-full text-left flex items-center gap-2 py-2 group"
                >
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="font-display font-semibold text-text-primary group-hover:text-accent-violet transition-colors">
                    {day.label}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={dayNote.content}
                      onChange={(e) => handleDayChange(day.id, e.target.value)}
                      placeholder="Add notes for this day..."
                      className="w-full bg-surface border border-border rounded-xl p-4 min-h-[120px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent-violet resize-y"
                    />
                    {dayNote.lastEditedBy && (
                      <p className="text-xs text-text-muted">
                        last edited by {dayNote.lastEditedBy}
                        {formattedTime ? ` at ${formattedTime}` : ''}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
