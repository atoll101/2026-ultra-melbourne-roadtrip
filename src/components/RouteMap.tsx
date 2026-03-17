'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COORDINATES, ROUTE_GEOJSON, POLL_INTERVAL } from '@/lib/constants';
import type { PitStop, ExtractedPlace } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

function isGoogleMapsUrl(text: string): boolean {
  return /google\.\w+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(text);
}

function parseMapsUrl(url: string): { lat: number; lng: number } | null {
  const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
  const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (q) return { lat: parseFloat(q[1]), lng: parseFloat(q[2]) };
  const p = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (p) return { lat: parseFloat(p[1]), lng: parseFloat(p[2]) };
  return null;
}

// Build route coordinates with confirmed stops inserted in geographic order
function buildRouteWithStops(confirmedStops: PitStop[]): GeoJSON.Feature<GeoJSON.LineString> {
  const baseCoords = ROUTE_GEOJSON.geometry.coordinates;
  if (confirmedStops.length === 0) return ROUTE_GEOJSON;

  // For each confirmed stop, find the best insertion point along the route
  const allCoords = [...baseCoords];
  for (const stop of confirmedStops) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allCoords.length - 1; i++) {
      const d = distToSegment([stop.lng, stop.lat], allCoords[i], allCoords[i + 1]);
      if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
    }
    allCoords.splice(bestIdx, 0, [stop.lng, stop.lat]);
  }

  return { ...ROUTE_GEOJSON, geometry: { ...ROUTE_GEOJSON.geometry, coordinates: allCoords } };
}

function distToSegment(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  const px = a[0] + t * dx, py = a[1] + t * dy;
  return Math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2);
}

export default function RouteMap({ userName }: { userName: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [stops, setStops] = useState<PitStop[]>([]);
  const [inputText, setInputText] = useState('');
  const [extracting, setExtracting] = useState(false);

  const fetchStops = useCallback(async () => {
    try {
      const res = await fetch('/api/stops');
      if (res.ok) setStops(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStops(); }, [fetchStops]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStops();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStops]);

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [COORDINATES.albury.lng, COORDINATES.albury.lat],
      zoom: 5.5,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: ROUTE_GEOJSON });
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7C3AED', 'line-width': 3, 'line-opacity': 0.7 },
      });
      addCityMarker(map, COORDINATES.sydney, 'Sydney');
      addCityMarker(map, COORDINATES.albury, 'Albury');
      addCityMarker(map, COORDINATES.melbourne, 'Melbourne');
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers + route line with stops
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const el = document.createElement('div');
      const color = stop.confirmed ? '#7C3AED' : '#888888';
      Object.assign(el.style, {
        width: stop.confirmed ? '12px' : '10px',
        height: stop.confirmed ? '12px' : '10px',
        borderRadius: '50%', background: color,
        border: '2px solid white', cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup({ offset: 8, maxWidth: '200px' }).setHTML(`
          <div style="font-size:13px;font-family:system-ui;">
            <div style="font-weight:600;">${esc(stop.name)}</div>
            ${stop.description ? `<div style="color:#888;font-size:11px;margin-top:2px;">${esc(stop.description)}</div>` : ''}
            <div style="color:#7C3AED;font-size:11px;margin-top:4px;">by ${esc(stop.addedBy)}</div>
            ${stop.confirmed ? '<div style="color:#22c55e;font-size:11px;font-weight:600;">On the route</div>' : '<div style="color:#888;font-size:11px;">Suggested</div>'}
          </div>`))
        .addTo(map);
      stopMarkersRef.current.push(marker);
    });

    // Update route line to include confirmed stops
    const confirmed = stops.filter((s) => s.confirmed);
    const source = map.getSource('route') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(buildRouteWithStops(confirmed));
    }
  }, [stops]);

  const addStop = async () => {
    const text = inputText.trim();
    if (!text) return;

    if (isGoogleMapsUrl(text)) {
      setExtracting(true);
      setInputText('');
      try {
        const extractRes = await fetch('/api/extract-place', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: text }),
        });

        let name = text;
        let description = '';
        let lng: number | undefined;
        let lat: number | undefined;

        if (extractRes.ok) {
          const place: ExtractedPlace = await extractRes.json();
          name = place.name || text;
          description = place.description || '';
          if (place.lat && place.lng) { lat = place.lat; lng = place.lng; }
        }

        if (lat == null || lng == null) {
          const coords = parseMapsUrl(text);
          if (coords) { lat = coords.lat; lng = coords.lng; }
        }

        if (lat != null && lng != null) {
          const res = await fetch('/api/stops', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, lng, lat, addedBy: userName, mapsUrl: text }),
          });
          if (res.ok) {
            const newStop: PitStop = await res.json();
            setStops((prev) => [...prev, newStop]);
          }
        }
      } catch { /* ignore */ }
      setExtracting(false);
      return;
    }

    // Plain text — can't add without coordinates
    setInputText('');
  };

  const toggleConfirm = async (id: string, confirmed: boolean) => {
    setStops((prev) => prev.map((s) => s.id === id ? { ...s, confirmed } : s));
    try {
      await fetch('/api/stops', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, confirmed }),
      });
    } catch { fetchStops(); }
  };

  const toggleUpvote = async (id: string) => {
    setStops((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const votes = s.upvotedBy ?? [];
      const has = votes.includes(userName);
      return { ...s, upvotedBy: has ? votes.filter((u) => u !== userName) : [...votes, userName] };
    }));
    try {
      await fetch('/api/stops', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, userName }),
      });
    } catch { fetchStops(); }
  };

  const handleDelete = async (id: string) => {
    setStops((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch('/api/stops', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    } catch { fetchStops(); }
  };

  const confirmed = stops.filter((s) => s.confirmed);
  const suggestions = stops.filter((s) => !s.confirmed);

  return (
    <section id="route" className="py-6 px-4 md:px-6 max-w-3xl mx-auto">
      <h2 className="font-display text-lg font-bold text-text-primary mb-1">Route</h2>
      <p className="text-text-muted text-sm mb-4">
        Paste a Google Maps link to suggest a pit stop. Confirm stops to add them to the route.
      </p>

      {/* Add stop input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addStop()}
          placeholder={extracting ? 'Extracting place info...' : 'Paste Google Maps link for a pit stop...'}
          disabled={extracting}
          className="flex-1 bg-white border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 shadow-sm disabled:opacity-50"
        />
        <button onClick={addStop} disabled={!inputText.trim() || extracting}
          className="px-3 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-30">
          {extracting ? '...' : 'Add'}
        </button>
      </div>
      {isGoogleMapsUrl(inputText) && (
        <p className="text-xs text-accent mb-3 -mt-2">Google Maps link detected — AI will extract place details</p>
      )}

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        <div ref={mapContainerRef} className="w-full h-[300px] md:h-[400px]" />
      </div>

      {/* Confirmed stops */}
      {confirmed.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">On the route</p>
          <div className="space-y-1.5">
            {confirmed.map((stop) => (
              <div key={stop.id} className="flex items-center justify-between bg-white rounded-lg border border-accent/20 px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-sm text-text-primary truncate">{stop.name}</span>
                  {stop.mapsUrl && (
                    <a href={stop.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-70 flex-shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleConfirm(stop.id, false)} className="text-xs text-text-muted hover:text-accent-pink p-1" title="Remove from route">
                    Remove
                  </button>
                  <button onClick={() => handleDelete(stop.id)} className="text-text-muted hover:text-red-500 text-sm p-1">&times;</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2">Suggestions</p>
          <div className="space-y-1.5">
            {suggestions.sort((a, b) => (b.upvotedBy?.length ?? 0) - (a.upvotedBy?.length ?? 0)).map((stop) => {
              const votes = stop.upvotedBy ?? [];
              const hasVoted = votes.includes(userName);
              return (
                <div key={stop.id} className="flex items-center justify-between bg-white rounded-lg border border-border px-3 py-2.5 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-text-muted/40 flex-shrink-0" />
                      <span className="text-sm text-text-primary truncate">{stop.name}</span>
                      {stop.mapsUrl && (
                        <a href={stop.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:opacity-70 flex-shrink-0">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z" clipRule="evenodd" /></svg>
                        </a>
                      )}
                    </div>
                    {stop.description && <p className="text-xs text-text-muted mt-0.5 ml-4">{stop.description}</p>}
                    <span className="text-xs text-text-muted ml-4">{stop.addedBy}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleUpvote(stop.id)}
                      className={`flex items-center gap-1 text-xs p-1 transition-colors ${hasVoted ? 'text-accent-pink' : 'text-text-muted hover:text-accent-pink'}`}>
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      {votes.length > 0 && <span>{votes.length}</span>}
                    </button>
                    <button onClick={() => toggleConfirm(stop.id, true)}
                      className="text-xs text-accent hover:opacity-70 p-1 font-medium" title="Add to route">
                      Add to route
                    </button>
                    <button onClick={() => handleDelete(stop.id)} className="text-text-muted hover:text-red-500 text-sm p-1">&times;</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function addCityMarker(map: mapboxgl.Map, coords: { lng: number; lat: number }, label: string) {
  const el = document.createElement('div');
  Object.assign(el.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' });
  const dot = document.createElement('div');
  Object.assign(dot.style, { width: '8px', height: '8px', borderRadius: '50%', background: '#7C3AED', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' });
  const text = document.createElement('div');
  text.textContent = label;
  Object.assign(text.style, { color: '#1A1A1A', fontSize: '10px', fontWeight: '600', fontFamily: 'system-ui', whiteSpace: 'nowrap' });
  el.appendChild(dot);
  el.appendChild(text);
  new mapboxgl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
}

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
