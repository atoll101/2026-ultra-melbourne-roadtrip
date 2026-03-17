'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COORDINATES, ROUTE_GEOJSON, POLL_INTERVAL } from '@/lib/constants';
import type { PitStop } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export default function RouteMap({ userName }: { userName: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [stops, setStops] = useState<PitStop[]>([]);

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
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#7C3AED', 'line-width': 3, 'line-opacity': 0.7 },
      });

      addCityMarker(map, COORDINATES.sydney, 'Sydney');
      addCityMarker(map, COORDINATES.albury, 'Albury');
      addCityMarker(map, COORDINATES.melbourne, 'Melbourne');
    });

    map.on('click', (e) => {
      if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
      const { lng, lat } = e.lngLat;
      const node = document.createElement('div');
      node.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;min-width:200px;font-family:system-ui;">
          <div style="font-weight:600;font-size:13px;color:#1A1A1A;">Add a pit stop</div>
          <input id="ps-name" type="text" placeholder="Name" style="background:#F5F5F5;border:1px solid #E5E5E5;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;color:#1A1A1A;" />
          <input id="ps-desc" type="text" placeholder="Notes (optional)" style="background:#F5F5F5;border:1px solid #E5E5E5;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;color:#1A1A1A;" />
          <button id="ps-btn" style="background:#7C3AED;color:white;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:500;cursor:pointer;">Add</button>
        </div>`;
      const popup = new mapboxgl.Popup({ closeOnClick: true, maxWidth: '260px' })
        .setLngLat([lng, lat]).setDOMContent(node).addTo(map);
      popup.on('close', () => { popupRef.current = null; });
      popupRef.current = popup;

      node.querySelector('#ps-btn')!.addEventListener('click', async () => {
        const name = (node.querySelector('#ps-name') as HTMLInputElement).value.trim();
        const desc = (node.querySelector('#ps-desc') as HTMLInputElement).value.trim();
        if (!name) return;
        try {
          const res = await fetch('/api/stops', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: desc, lng, lat, addedBy: userName }),
          });
          if (res.ok) { popup.remove(); fetchStops(); }
        } catch { /* ignore */ }
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync stop markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const el = document.createElement('div');
      Object.assign(el.style, { width: '10px', height: '10px', borderRadius: '50%', background: '#7C3AED', border: '2px solid white', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup({ offset: 8, maxWidth: '200px' }).setHTML(`
          <div style="font-size:13px;font-family:system-ui;">
            <div style="font-weight:600;color:#1A1A1A;">${esc(stop.name)}</div>
            ${stop.description ? `<div style="color:#888;font-size:11px;margin-top:2px;">${esc(stop.description)}</div>` : ''}
            <div style="color:#7C3AED;font-size:11px;margin-top:4px;">by ${esc(stop.addedBy)}</div>
          </div>`))
        .addTo(map);
      stopMarkersRef.current.push(marker);
    });
  }, [stops]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/stops', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (res.ok) fetchStops();
    } catch { /* ignore */ }
  };

  return (
    <section id="route" className="py-10 px-6 max-w-2xl mx-auto">
      <h2 className="font-display text-lg font-bold text-text-primary mb-1">Route</h2>
      <p className="text-text-muted text-sm mb-4">Click the map to add a pit stop along the way.</p>

      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        <div ref={mapContainerRef} className="w-full h-[400px]" />
      </div>

      {stops.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs text-text-muted font-medium uppercase tracking-wide">Pit stops</p>
          {stops.map((stop) => (
            <div key={stop.id} className="flex items-center justify-between py-1.5 group">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                <span className="text-sm text-text-primary truncate">{stop.name}</span>
                <span className="text-xs text-text-muted">&middot; {stop.addedBy}</span>
              </div>
              <button onClick={() => handleDelete(stop.id)} className="text-text-muted hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
            </div>
          ))}
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
