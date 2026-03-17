'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAutosave } from '@/hooks/useAutosave';
import { POLL_INTERVAL, TRIP_DATES, ACCOMMODATION } from '@/lib/constants';

const DayMap = dynamic(() => import('@/components/DayMap'), { ssr: false });
import type { ItineraryData, DayPlan, MelbourneIdea } from '@/lib/types';

const EMPTY_DAY: DayPlan = { notes: '', spots: [], lastEditedBy: '', lastEditedAt: '' };

export default function Itinerary({ userName }: { userName: string }) {
  const [data, setData] = useState<ItineraryData>({});
  const [ideas, setIdeas] = useState<MelbourneIdea[]>([]);
  const [expandedDay, setExpandedDay] = useState<string>(TRIP_DATES.days[0].id);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [itinRes, ideasRes] = await Promise.all([
        fetch('/api/itinerary'),
        fetch('/api/ideas'),
      ]);
      if (itinRes.ok) {
        const itinData: ItineraryData = await itinRes.json();
        setData((prev) => {
          const merged = { ...itinData };
          if (editingDayId && prev[editingDayId]) merged[editingDayId] = prev[editingDayId];
          return merged;
        });
      }
      if (ideasRes.ok) setIdeas(await ideasRes.json());
    } catch { /* ignore */ }
  }, [editingDayId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => { timer = setInterval(() => { if (document.visibilityState === 'visible') fetchData(); }, POLL_INTERVAL); };
    const vis = () => { clearInterval(timer); if (document.visibilityState === 'visible') { fetchData(); start(); } };
    start();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis); };
  }, [fetchData]);

  const saveDay = useCallback(async (dayId: string) => {
    const day = data[dayId];
    if (!day) return;
    try {
      await fetch('/api/itinerary', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayId, notes: day.notes, spots: day.spots, lastEditedBy: userName }),
      });
    } catch { /* ignore */ }
    setEditingDayId(null);
  }, [data, userName]);

  const trigger = useAutosave(
    useCallback(() => editingDayId ? saveDay(editingDayId) : Promise.resolve(), [editingDayId, saveDay])
  );

  const handleNotesChange = (dayId: string, notes: string) => {
    setEditingDayId(dayId);
    setData((prev) => ({
      ...prev,
      [dayId]: { ...(prev[dayId] ?? EMPTY_DAY), notes, lastEditedBy: userName, lastEditedAt: new Date().toISOString() },
    }));
    trigger();
  };

  // Drop handler — assign a spot to a day
  const handleDrop = async (e: React.DragEvent, dayId: string) => {
    e.preventDefault();
    setDragOverDay(null);
    const ideaId = e.dataTransfer.getData('text/plain');
    if (!ideaId) return;

    // Optimistic: update ideas list
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, assignedDay: dayId } : i));

    // Update the day's spots list
    const day = data[dayId] ?? EMPTY_DAY;
    const spots = [...day.spots.filter((s) => s !== ideaId), ideaId];
    setData((prev) => ({
      ...prev,
      [dayId]: { ...day, spots, lastEditedBy: userName, lastEditedAt: new Date().toISOString() },
    }));

    // Persist both
    try {
      await Promise.all([
        fetch('/api/ideas', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ideaId, userName, assignedDay: dayId }),
        }),
        fetch('/api/itinerary', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayId, spots, lastEditedBy: userName }),
        }),
      ]);
    } catch { fetchData(); }
  };

  const removeSpotFromDay = async (ideaId: string, dayId: string) => {
    // Optimistic
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, assignedDay: undefined } : i));
    const day = data[dayId] ?? EMPTY_DAY;
    const spots = day.spots.filter((s) => s !== ideaId);
    setData((prev) => ({
      ...prev,
      [dayId]: { ...day, spots, lastEditedBy: userName, lastEditedAt: new Date().toISOString() },
    }));

    try {
      await Promise.all([
        fetch('/api/ideas', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ideaId, userName, assignedDay: '' }),
        }),
        fetch('/api/itinerary', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayId, spots, lastEditedBy: userName }),
        }),
      ]);
    } catch { fetchData(); }
  };

  const getIdea = (id: string) => ideas.find((i) => i.id === id);

  return (
    <section id="itinerary" className="py-10 px-6 max-w-2xl mx-auto">
      <h2 className="font-display text-lg font-bold text-text-primary mb-1">Itinerary</h2>
      <p className="text-text-muted text-sm mb-6">Drag spots from above into each day. Click to expand and add notes.</p>

      <div className="space-y-1">
        {TRIP_DATES.days.map((day) => {
          const dayPlan = data[day.id] ?? EMPTY_DAY;
          const isExpanded = expandedDay === day.id;
          const isDragOver = dragOverDay === day.id;
          const time = dayPlan.lastEditedAt ? new Date(dayPlan.lastEditedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          const assignedSpots = dayPlan.spots.map(getIdea).filter(Boolean) as MelbourneIdea[];

          return (
            <div
              key={day.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.id); }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => handleDrop(e, day.id)}
              className={`rounded-lg border transition-colors ${
                isDragOver ? 'border-accent bg-accent-light/50' :
                isExpanded ? 'border-border bg-white' : 'border-transparent hover:bg-surface-alt'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedDay(isExpanded ? '' : day.id)}
                className="w-full text-left flex items-center gap-2 px-4 py-3"
              >
                <svg className={`w-3 h-3 text-text-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-text-primary">{day.label}</span>
                {assignedSpots.length > 0 && !isExpanded && (
                  <span className="text-xs text-accent ml-auto">{assignedSpots.length} spot{assignedSpots.length !== 1 ? 's' : ''}</span>
                )}
                {!assignedSpots.length && dayPlan.notes && !isExpanded && (
                  <span className="text-xs text-text-muted ml-auto">has notes</span>
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Accommodation */}
                  {day.stay && ACCOMMODATION[day.stay] && (
                    <div className="flex items-start gap-2 bg-accent-light/50 rounded-lg px-3 py-2 text-xs">
                      <span className="text-accent mt-px">🏠</span>
                      <div>
                        <span className="font-medium text-text-primary">{ACCOMMODATION[day.stay].name}</span>
                        <span className="text-text-muted block">{ACCOMMODATION[day.stay].address}</span>
                      </div>
                    </div>
                  )}

                  {/* Assigned spots */}
                  {assignedSpots.length > 0 && (
                    <div className="space-y-1">
                      {assignedSpots.map((spot) => (
                        <div key={spot.id} className="flex items-center justify-between gap-2 bg-surface-alt rounded-lg px-3 py-2 group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                            <span className="text-sm text-text-primary truncate">{spot.text}</span>
                            {spot.mapsUrl && (
                              <a href={spot.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-70 flex-shrink-0">
                                <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                              </a>
                            )}
                          </div>
                          <button
                            onClick={() => removeSpotFromDay(spot.id, day.id)}
                            className="text-text-muted hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove from this day"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Day map */}
                  {assignedSpots.some((s) => s.lng != null && s.lat != null) && (
                    <DayMap spots={assignedSpots} />
                  )}

                  {/* Drop zone hint */}
                  {assignedSpots.length === 0 && (
                    <div className="border border-dashed border-border rounded-lg py-3 text-center text-xs text-text-muted">
                      Drag spots here from Melbourne Spots above
                    </div>
                  )}

                  {/* Notes */}
                  <textarea
                    value={dayPlan.notes}
                    onChange={(e) => handleNotesChange(day.id, e.target.value)}
                    placeholder="Additional notes..."
                    className="w-full bg-surface-alt border border-border rounded-lg p-3 min-h-[80px] text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/30 resize-y"
                  />
                  {dayPlan.lastEditedBy && (
                    <p className="text-xs text-text-muted">
                      edited by {dayPlan.lastEditedBy}{time ? ` at ${time}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
