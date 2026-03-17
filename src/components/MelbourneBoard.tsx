'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { POLL_INTERVAL, MELBOURNE_CATEGORIES, TRIP_DATES } from '@/lib/constants';
import type { MelbourneIdea, ExtractedPlace } from '@/lib/types';

const CATEGORY_EMOJI: Record<string, string> = {
  'Eat': '\u{1F37D}\uFE0F',
  'Drink': '\u{1F37A}',
  'Sights': '\u{1F4CD}',
  'Friday Night': '\u{1F31F}',
  'Coffee': '\u2615',
};

function parseMapsUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const p = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (p) return { lat: parseFloat(p[1]), lng: parseFloat(p[2]) };
  return null;
}

function isGoogleMapsUrl(text: string): boolean {
  return /google\.\w+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(text);
}

export default function MelbourneBoard({ userName }: { userName: string }) {
  const [ideas, setIdeas] = useState<MelbourneIdea[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(MELBOURNE_CATEGORIES[0]);
  const [inputText, setInputText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/ideas');
      if (res.ok) setIdeas(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    const start = () => { timer = setInterval(() => { if (document.visibilityState === 'visible') fetchIdeas(); }, POLL_INTERVAL); };
    const vis = () => { clearInterval(timer); if (document.visibilityState === 'visible') { fetchIdeas(); start(); } };
    start();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', vis); };
  }, [fetchIdeas]);

  // Mini map
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;
    const withCoords = ideas.filter((i) => i.lng != null && i.lat != null);
    if (withCoords.length === 0) {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      return;
    }
    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
      if (!mapRef.current && mapContainerRef.current) {
        mapRef.current = new mapboxgl.Map({ container: mapContainerRef.current, style: 'mapbox://styles/mapbox/light-v11', center: [144.9631, -37.8136], zoom: 12 });
      }
      const map = mapRef.current;
      if (!map) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const bounds = new mapboxgl.LngLatBounds();
      withCoords.forEach((idea) => {
        const el = document.createElement('div');
        Object.assign(el.style, { width: '10px', height: '10px', borderRadius: '50%', background: '#7C3AED', border: '2px solid white', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' });
        const popup = new mapboxgl.Popup({ offset: 8, maxWidth: '200px' }).setHTML(`
          <div style="font-size:12px;font-family:system-ui;"><div style="font-weight:600;">${esc(idea.text)}</div>
          ${idea.description ? `<div style="color:#888;font-size:11px;margin-top:2px;">${esc(idea.description)}</div>` : ''}
          <div style="color:#888;font-size:11px;margin-top:2px;">${CATEGORY_EMOJI[idea.category] ?? ''} ${esc(idea.category)}</div>
          ${idea.mapsUrl ? `<a href="${esc(idea.mapsUrl)}" target="_blank" rel="noopener" style="color:#7C3AED;font-size:11px;">Open in Maps</a>` : ''}</div>`);
        const marker = new mapboxgl.Marker({ element: el }).setLngLat([idea.lng!, idea.lat!]).setPopup(popup).addTo(map);
        markersRef.current.push(marker);
        bounds.extend([idea.lng!, idea.lat!]);
      });
      if (withCoords.length > 1) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
      else { map.setCenter([withCoords[0].lng!, withCoords[0].lat!]); map.setZoom(14); }
    };
    init();
  }, [ideas]);

  const toggleUpvote = async (ideaId: string) => {
    setIdeas((prev) => prev.map((idea) => {
      if (idea.id !== ideaId) return idea;
      const has = idea.upvotedBy.includes(userName);
      return { ...idea, upvotedBy: has ? idea.upvotedBy.filter((u) => u !== userName) : [...idea.upvotedBy, userName] };
    }));
    try {
      const res = await fetch('/api/ideas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ideaId, userName }) });
      if (!res.ok) throw new Error();
    } catch { fetchIdeas(); }
  };

  const addIdea = async () => {
    const text = inputText.trim();
    if (!text) return;

    // If it's a Google Maps URL, use Gemini to extract info
    if (isGoogleMapsUrl(text)) {
      setExtracting(true);
      setInputText('');
      try {
        // Try Gemini extraction
        const extractRes = await fetch('/api/extract-place', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: text }),
        });

        let name = text;
        let description = '';
        let category = activeCategory;
        let lng: number | undefined;
        let lat: number | undefined;

        if (extractRes.ok) {
          const place: ExtractedPlace = await extractRes.json();
          name = place.name || text;
          description = place.description || '';
          category = MELBOURNE_CATEGORIES.includes(place.category as typeof MELBOURNE_CATEGORIES[number]) ? place.category : activeCategory;
          if (place.lat && place.lng) { lat = place.lat; lng = place.lng; }
        }

        // Fallback: extract coords from URL directly
        if (lat == null || lng == null) {
          const coords = parseMapsUrl(text);
          if (coords) { lat = coords.lat; lng = coords.lng; }
        }

        const res = await fetch('/api/ideas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, text: name, author: userName, mapsUrl: text, lng, lat, description }),
        });
        if (res.ok) {
          const newIdea: MelbourneIdea = await res.json();
          setIdeas((prev) => [...prev, newIdea]);
        }
      } catch { /* ignore */ }
      setExtracting(false);
      return;
    }

    // Plain text — just add it
    setInputText('');
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeCategory, text, author: userName }),
      });
      if (res.ok) {
        const newIdea: MelbourneIdea = await res.json();
        setIdeas((prev) => [...prev, newIdea]);
      }
    } catch { /* ignore */ }
  };

  const deleteIdea = async (ideaId: string) => {
    setIdeas((prev) => prev.filter((i) => i.id !== ideaId));
    try {
      await fetch('/api/ideas', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ideaId }) });
    } catch { fetchIdeas(); }
  };

  const assignToDay = async (ideaId: string, dayId: string) => {
    setAssigningId(null);
    setIdeas((prev) => prev.map((i) => i.id === ideaId ? { ...i, assignedDay: dayId } : i));
    try {
      await Promise.all([
        fetch('/api/ideas', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ideaId, userName, assignedDay: dayId }) }),
        fetch('/api/itinerary', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dayId, spots: [ideaId], lastEditedBy: userName }) }),
      ]);
    } catch { fetchIdeas(); }
  };

  const handleDragStart = (e: React.DragEvent, ideaId: string) => {
    e.dataTransfer.setData('text/plain', ideaId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const categoryIdeas = ideas.filter((i) => i.category === activeCategory && !i.assignedDay).sort((a, b) => b.upvotedBy.length - a.upvotedBy.length);
  const withCoords = ideas.filter((i) => i.lng != null && i.lat != null);

  return (
    <section id="melbourne">
      <h2 className="font-display text-lg font-bold text-text-primary mb-1">Melbourne Spots</h2>
      <p className="text-text-muted text-sm mb-6">
        Paste a Google Maps link and AI will extract the details. Vote on spots, then drag them into the itinerary.
      </p>

      {/* Mini map */}
      {withCoords.length > 0 && (
        <div ref={mapContainerRef} className="w-full h-[200px] md:h-[240px] rounded-xl overflow-hidden border border-border shadow-sm mb-6" />
      )}
      {withCoords.length === 0 && <div ref={mapContainerRef} className="hidden" />}

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {MELBOURNE_CATEGORIES.map((cat) => {
          const count = ideas.filter((i) => i.category === cat && !i.assignedDay).length;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-accent-light text-accent' : 'text-text-muted hover:text-text-primary hover:bg-surface-alt'}`}>
              <span>{CATEGORY_EMOJI[cat]}</span><span>{cat}</span>
              {count > 0 && <span className="opacity-50">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Add spot */}
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addIdea()}
            placeholder={extracting ? 'Extracting place info...' : 'Place name or paste Google Maps link...'}
            disabled={extracting}
            className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 shadow-sm disabled:opacity-50"
          />
          <button onClick={addIdea} disabled={!inputText.trim() || extracting}
            className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-30">
            {extracting ? '...' : 'Add'}
          </button>
        </div>
        {isGoogleMapsUrl(inputText) && (
          <p className="text-xs text-accent mt-1.5">Google Maps link detected — AI will extract place details</p>
        )}
      </div>

      {/* Spots list */}
      <div className="space-y-1.5">
        {categoryIdeas.length === 0 && (
          <p className="text-text-muted text-sm py-6 text-center">No spots yet for {activeCategory}.</p>
        )}
        {categoryIdeas.map((idea) => {
          const has = idea.upvotedBy.includes(userName);
          const isAssigning = assigningId === idea.id;
          return (
            <div key={idea.id} className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, idea.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 cursor-grab active:cursor-grabbing hover:border-accent/30 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-text-muted/40 flex-shrink-0 hidden md:block" viewBox="0 0 20 20" fill="currentColor">
                      <circle cx="7" cy="6" r="1.5"/><circle cx="13" cy="6" r="1.5"/><circle cx="7" cy="10" r="1.5"/><circle cx="13" cy="10" r="1.5"/><circle cx="7" cy="14" r="1.5"/><circle cx="13" cy="14" r="1.5"/>
                    </svg>
                    <span className="text-sm text-text-primary">{idea.text}</span>
                    {idea.mapsUrl && (
                      <a href={idea.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-70 flex-shrink-0" title="Open in Google Maps">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                      </a>
                    )}
                  </div>
                  {idea.description && <p className="text-xs text-text-muted mt-0.5 md:ml-5">{idea.description}</p>}
                  <span className="text-xs text-text-muted md:ml-5">{idea.author}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Assign to day — mobile tap alternative to drag */}
                  <button onClick={() => setAssigningId(isAssigning ? null : idea.id)}
                    className="text-accent hover:opacity-70 p-1" title="Add to day">
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </button>
                  <button onClick={() => toggleUpvote(idea.id)}
                    className={`flex items-center gap-1 text-xs p-1 transition-colors ${has ? 'text-accent-pink' : 'text-text-muted hover:text-accent-pink'}`}>
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill={has ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                    {idea.upvotedBy.length > 0 && <span>{idea.upvotedBy.length}</span>}
                  </button>
                  <button onClick={() => deleteIdea(idea.id)}
                    className="text-text-muted hover:text-red-500 text-sm p-1" title="Delete">
                    &times;
                  </button>
                </div>
              </div>
              {/* Day picker dropdown */}
              {isAssigning && (
                <div className="border-t border-border bg-surface-alt px-4 py-2 flex flex-wrap gap-1.5">
                  <span className="text-xs text-text-muted mr-1 self-center">Add to:</span>
                  {TRIP_DATES.days.map((day) => (
                    <button key={day.id} onClick={() => assignToDay(idea.id, day.id)}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-white border border-border text-text-primary hover:border-accent hover:text-accent transition-colors">
                      {day.label.split(' · ')[0].replace('Day ', 'D')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted mt-4 text-center">
        Tap + to assign a spot to a day, or drag on desktop
      </p>
    </section>
  );
}

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
