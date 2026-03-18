'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { COORDINATES, PICKUP_POINTS, POLL_INTERVAL } from '@/lib/constants';
import type { PitStop, ExtractedPlace } from '@/lib/types';

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

// Sort confirmed stops geographically along the route (by distance from Sydney)
function sortStopsAlongRoute(stops: PitStop[]): PitStop[] {
  const start = COORDINATES.sydney;
  return [...stops].sort((a, b) => {
    const da = Math.sqrt((a.lng - start.lng) ** 2 + (a.lat - start.lat) ** 2);
    const db = Math.sqrt((b.lng - start.lng) ** 2 + (b.lat - start.lat) ** 2);
    return da - db;
  });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function addMinutes(date: Date, mins: number): Date {
  return new Date(date.getTime() + mins * 60000);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase();
}

interface LegInfo {
  label: string;
  durationSec: number;
  departTime: Date;
  arriveTime: Date;
}

export default function RouteMap({ userName }: { userName: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [stops, setStops] = useState<PitStop[]>([]);
  const [inputText, setInputText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [legs, setLegs] = useState<LegInfo[]>([]);

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

  // Init map + directions
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
    if (!apiKey) return;

    setOptions({ key: apiKey, v: 'weekly' });

    const init = async () => {
      const { Map } = await importLibrary('maps') as google.maps.MapsLibrary;

      const map = new Map(mapContainerRef.current!, {
        center: { lat: COORDINATES.albury.lat, lng: COORDINATES.albury.lng },
        zoom: 6,
        mapId: 'route-map',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'cooperative',
      });
      mapRef.current = map;
    };
    init();

    return () => { mapRef.current = null; };
  }, []);

  // Update route when confirmed stops change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateRoute = async () => {
      const { DirectionsService, DirectionsRenderer } = await importLibrary('routes') as google.maps.RoutesLibrary;
      const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

      // Clear old
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];

      const confirmed = sortStopsAlongRoute(stops.filter((s) => s.confirmed));

      // Build waypoints: pickups + confirmed stops (between Sydney and Albury)
      const day1Waypoints = [
        ...PICKUP_POINTS.map((p) => ({ location: new google.maps.LatLng(p.lat, p.lng), stopover: true })),
        ...confirmed.map((s) => ({ location: new google.maps.LatLng(s.lat, s.lng), stopover: true })),
        { location: new google.maps.LatLng(COORDINATES.albury.lat, COORDINATES.albury.lng), stopover: true },
      ];

      const directionsService = new DirectionsService();
      const renderer = new DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#7C3AED', strokeWeight: 4, strokeOpacity: 0.8 },
      });
      directionsRendererRef.current = renderer;

      try {
        const result = await directionsService.route({
          origin: new google.maps.LatLng(COORDINATES.sydney.lat, COORDINATES.sydney.lng),
          destination: new google.maps.LatLng(COORDINATES.melbourne.lat, COORDINATES.melbourne.lng),
          waypoints: day1Waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        });

        renderer.setDirections(result);

        // Calculate leg times
        const routeLegs = result.routes[0]?.legs ?? [];
        if (routeLegs.length > 0) {
          // Day 1: Sydney → Albury (all legs up to Albury waypoint)
          // Albury is the last waypoint before Melbourne, so all legs except the last = Day 1
          const alburyIdx = day1Waypoints.length; // legs count = waypoints + 1 (origin to dest)
          // Actually: legs = waypoints.length + 1 if we count origin→wp1, wp1→wp2, ..., wpN→dest
          // Day 1 legs: index 0 to (alburyIdx - 1) — up to and including arrival at Albury
          // Day 2 leg: last leg (Albury → Melbourne)

          const day1Legs = routeLegs.slice(0, -1); // everything except last
          const day2Leg = routeLegs[routeLegs.length - 1]; // last = Albury → Melbourne

          const day1Duration = day1Legs.reduce((sum, l) => sum + (l.duration?.value ?? 0), 0);
          const day2Duration = day2Leg.duration?.value ?? 0;

          const day1Depart = new Date('2026-04-08T16:00:00+10:00');
          const day1Arrive = addMinutes(day1Depart, day1Duration / 60);
          const day2Depart = new Date('2026-04-09T10:00:00+10:00');
          const day2Arrive = addMinutes(day2Depart, day2Duration / 60);

          setLegs([
            { label: 'Sydney → Albury', durationSec: day1Duration, departTime: day1Depart, arriveTime: day1Arrive },
            { label: 'Albury → Melbourne', durationSec: day2Duration, departTime: day2Depart, arriveTime: day2Arrive },
          ]);
        }
      } catch (e) {
        console.error('Directions request failed:', e);
      }

      // Add custom markers for key locations
      const addMarker = (lat: number, lng: number, label: string, color: string) => {
        const el = document.createElement('div');
        el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
        const dot = document.createElement('div');
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);`;
        const txt = document.createElement('div');
        txt.textContent = label;
        txt.style.cssText = 'color:#1A1A1A;font-size:10px;font-weight:600;font-family:system-ui;white-space:nowrap;text-shadow:0 0 3px white,0 0 3px white;';
        el.appendChild(dot);
        el.appendChild(txt);
        const marker = new AdvancedMarkerElement({ map, position: { lat, lng }, content: el });
        markersRef.current.push(marker);
      };

      addMarker(COORDINATES.sydney.lat, COORDINATES.sydney.lng, 'Sydney', '#7C3AED');
      addMarker(COORDINATES.albury.lat, COORDINATES.albury.lng, 'Albury', '#7C3AED');
      addMarker(COORDINATES.melbourne.lat, COORDINATES.melbourne.lng, 'Melbourne', '#7C3AED');

      // Pickup markers (small, no label)
      PICKUP_POINTS.forEach((pt) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#7C3AED;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.15);';
        const marker = new AdvancedMarkerElement({ map, position: { lat: pt.lat, lng: pt.lng }, content: el });
        markersRef.current.push(marker);
      });

      // Stop markers
      stops.forEach((stop) => {
        const el = document.createElement('div');
        const color = stop.confirmed ? '#7C3AED' : '#888888';
        const size = stop.confirmed ? '12px' : '10px';
        el.style.cssText = `width:${size};height:${size};border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.2);cursor:pointer;`;
        const marker = new AdvancedMarkerElement({ map, position: { lat: stop.lat, lng: stop.lng }, content: el, title: stop.name });
        markersRef.current.push(marker);
      });
    };

    updateRoute();
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
    <section id="route" className="py-6 px-4 md:px-6 max-w-5xl mx-auto">
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
          className="flex-1 bg-white border border-border rounded-lg px-3 py-2.5 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 shadow-sm disabled:opacity-50"
        />
        <button onClick={addStop} disabled={!inputText.trim() || extracting}
          className="px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-30">
          {extracting ? '...' : 'Add'}
        </button>
      </div>
      {isGoogleMapsUrl(inputText) && (
        <p className="text-xs text-accent mb-3 -mt-2">Google Maps link detected — AI will extract place details</p>
      )}

      {/* Map + drive itinerary side-by-side on desktop */}
      <div className="md:flex md:gap-4">
        <div className="flex-1 rounded-xl overflow-hidden border border-border shadow-sm">
          <div ref={mapContainerRef} className="w-full h-[300px] md:h-[450px]" />
        </div>

        {/* Drive itinerary panel */}
        <div className="md:w-64 mt-4 md:mt-0 space-y-3">
          {/* Day 1 */}
          <div className="bg-white rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Day 1 — Wed Apr 8</p>
            <div className="space-y-0">
              <div className="flex items-start gap-2.5">
                <div className="flex flex-col items-center mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" />
                  <div className="w-px h-full bg-accent/30 min-h-[24px]" />
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium text-text-primary">Depart Sydney</p>
                  <p className="text-xs text-accent font-semibold">4:00 PM</p>
                </div>
              </div>

              {legs[0] && (
                <div className="flex items-center gap-2.5 py-1">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-2 bg-accent/30" />
                  </div>
                  <p className="text-xs text-text-muted">{formatDuration(legs[0].durationSec)} drive</p>
                </div>
              )}

              {confirmed.length > 0 && confirmed.map((stop) => (
                <div key={stop.id} className="flex items-start gap-2.5">
                  <div className="flex flex-col items-center mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/60 flex-shrink-0 ml-0.5" />
                    <div className="w-px h-full bg-accent/30 min-h-[16px]" />
                  </div>
                  <p className="text-xs text-text-primary truncate pb-1">{stop.name}</p>
                </div>
              ))}

              <div className="flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Arrive Albury</p>
                  {legs[0] && <p className="text-xs text-accent font-semibold">~{formatTime(legs[0].arriveTime)}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Day 2 */}
          <div className="bg-white rounded-lg border border-border p-3 shadow-sm">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Day 2 — Thu Apr 9</p>
            <div className="space-y-0">
              <div className="flex items-start gap-2.5">
                <div className="flex flex-col items-center mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0" />
                  <div className="w-px h-full bg-accent/30 min-h-[24px]" />
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium text-text-primary">Depart Albury</p>
                  <p className="text-xs text-accent font-semibold">10:00 AM</p>
                </div>
              </div>

              {legs[1] && (
                <div className="flex items-center gap-2.5 py-1">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-2 bg-accent/30" />
                  </div>
                  <p className="text-xs text-text-muted">{formatDuration(legs[1].durationSec)} drive</p>
                </div>
              )}

              <div className="flex items-start gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Arrive Melbourne</p>
                  {legs[1] && <p className="text-xs text-accent font-semibold">~{formatTime(legs[1].arriveTime)}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggleConfirm(stop.id, false)} className="text-xs text-text-muted hover:text-accent-pink active:text-accent-pink min-h-10 min-w-10 flex items-center justify-center" title="Remove from route">
                    Remove
                  </button>
                  <button onClick={() => handleDelete(stop.id)} className="text-text-muted hover:text-red-500 active:text-red-500 text-lg min-h-10 min-w-10 flex items-center justify-center">&times;</button>
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
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleUpvote(stop.id)}
                      className={`flex items-center gap-1 text-xs min-h-10 min-w-10 justify-center transition-colors ${hasVoted ? 'text-accent-pink' : 'text-text-muted hover:text-accent-pink active:text-accent-pink'}`}>
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill={hasVoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                      </svg>
                      {votes.length > 0 && <span>{votes.length}</span>}
                    </button>
                    <button onClick={() => toggleConfirm(stop.id, true)}
                      className="text-xs text-accent hover:opacity-70 active:opacity-70 min-h-10 px-2 font-medium" title="Add to route">
                      Add to route
                    </button>
                    <button onClick={() => handleDelete(stop.id)} className="text-text-muted hover:text-red-500 active:text-red-500 text-lg min-h-10 min-w-10 flex items-center justify-center">&times;</button>
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
