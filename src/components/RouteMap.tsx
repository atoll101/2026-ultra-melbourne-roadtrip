'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COORDINATES, ROUTE_GEOJSON, POLL_INTERVAL } from '@/lib/constants';
import type { PitStop } from '@/lib/types';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface RouteMapProps {
  userName: string;
}

export default function RouteMap({ userName }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const [stops, setStops] = useState<PitStop[]>([]);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [addingAt, setAddingAt] = useState<{ lng: number; lat: number } | null>(null);

  const fetchStops = useCallback(async () => {
    try {
      const res = await fetch('/api/stops');
      if (res.ok) {
        const data: PitStop[] = await res.json();
        setStops(data);
      }
    } catch {
      // silently retry on next poll
    }
  }, []);

  // Fetch stops on mount + poll
  useEffect(() => {
    fetchStops();
    const interval = setInterval(fetchStops, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStops]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [COORDINATES.albury.lng, COORDINATES.albury.lat],
      zoom: 5.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.on('load', () => {
      // Route line
      map.addSource('route', {
        type: 'geojson',
        data: ROUTE_GEOJSON,
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#A855F7',
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });

      // Fixed markers
      addFixedMarker(map, COORDINATES.sydney, 'Sydney', '#BFFF00');
      addFixedMarker(map, COORDINATES.albury, 'Albury', '#EC4899');
      addFixedMarker(map, COORDINATES.melbourne, 'Melbourne', '#A855F7');
    });

    // Click to add pit stop
    map.on('click', (e) => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      const { lng, lat } = e.lngLat;
      setAddingAt({ lng, lat });
      setFormName('');
      setFormDesc('');

      const popupNode = document.createElement('div');
      popupNode.id = 'add-stop-popup';

      const popup = new mapboxgl.Popup({ closeOnClick: true, maxWidth: '280px' })
        .setLngLat([lng, lat])
        .setDOMContent(popupNode)
        .addTo(map);

      popup.on('close', () => {
        setAddingAt(null);
        popupRef.current = null;
      });

      popupRef.current = popup;

      // Render form into popup
      renderAddForm(popupNode, lng, lat);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderAddForm(container: HTMLElement, lng: number, lat: number) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;min-width:220px;">
        <div style="font-weight:600;font-size:14px;color:#F0EDE6;">Add Pit Stop</div>
        <input id="popup-name" type="text" placeholder="Name"
          style="background:#1E1E2E;border:1px solid #2A2A3A;border-radius:8px;padding:6px 10px;color:#F0EDE6;font-size:13px;outline:none;" />
        <input id="popup-desc" type="text" placeholder="Description"
          style="background:#1E1E2E;border:1px solid #2A2A3A;border-radius:8px;padding:6px 10px;color:#F0EDE6;font-size:13px;outline:none;" />
        <button id="popup-submit"
          style="background:#A855F7;color:#F0EDE6;border:none;border-radius:8px;padding:6px 12px;font-size:13px;font-weight:600;cursor:pointer;">
          Add Stop
        </button>
      </div>
    `;

    const submitBtn = container.querySelector('#popup-submit') as HTMLButtonElement;
    submitBtn.addEventListener('click', async () => {
      const nameInput = container.querySelector('#popup-name') as HTMLInputElement;
      const descInput = container.querySelector('#popup-desc') as HTMLInputElement;
      const name = nameInput.value.trim();
      const description = descInput.value.trim();
      if (!name) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding...';

      try {
        const res = await fetch('/api/stops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, lng, lat, addedBy: userName }),
        });
        if (res.ok) {
          if (popupRef.current) {
            popupRef.current.remove();
            popupRef.current = null;
          }
          // Re-fetch stops
          const stopsRes = await fetch('/api/stops');
          if (stopsRes.ok) {
            const data: PitStop[] = await stopsRes.json();
            setStops(data);
          }
        }
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Stop';
      }
    });
  }

  // Sync pit stop markers with stops state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    stopMarkersRef.current.forEach((m) => m.remove());
    stopMarkersRef.current = [];

    stops.forEach((stop) => {
      const el = document.createElement('div');
      el.style.width = '12px';
      el.style.height = '12px';
      el.style.borderRadius = '50%';
      el.style.background = '#FFFFFF';
      el.style.border = '2px solid #A855F7';
      el.style.cursor = 'pointer';

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([stop.lng, stop.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 12, maxWidth: '240px' }).setHTML(`
            <div style="font-size:14px;">
              <div style="font-weight:600;color:#F0EDE6;margin-bottom:4px;">${escapeHtml(stop.name)}</div>
              ${stop.description ? `<div style="color:#8A8690;font-size:12px;margin-bottom:4px;">${escapeHtml(stop.description)}</div>` : ''}
              <div style="color:#A855F7;font-size:11px;">Added by ${escapeHtml(stop.addedBy)}</div>
            </div>
          `)
        )
        .addTo(map);

      stopMarkersRef.current.push(marker);
    });
  }, [stops]);

  async function handleDelete(id: string) {
    try {
      const res = await fetch('/api/stops', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchStops();
      }
    } catch {
      // ignore
    }
  }

  return (
    <section id="route" className="px-4 md:px-8 py-16 max-w-6xl mx-auto">
      <h2 className="font-display text-3xl md:text-4xl font-bold text-text-primary mb-8">
        The Route
      </h2>

      <div className="relative">
        {/* Map container */}
        <div
          ref={mapContainerRef}
          className="w-full h-[500px] md:h-[600px] rounded-2xl overflow-hidden border border-border"
        />

        {/* Floating Stops Panel */}
        <div className="absolute top-3 right-3 w-64 max-h-[300px] flex flex-col bg-surface/90 backdrop-blur border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <h3 className="text-sm font-semibold text-text-primary">
              Pit Stops{' '}
              <span className="text-text-muted font-normal">({stops.length})</span>
            </h3>
          </div>

          <div className="overflow-y-auto flex-1">
            {stops.length === 0 ? (
              <p className="text-text-muted text-xs px-4 py-3">
                Click on the map to add a pit stop.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {stops.map((stop) => (
                  <li
                    key={stop.id}
                    className="px-4 py-2 flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text-primary truncate">
                        {stop.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate">
                        by {stop.addedBy}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(stop.id)}
                      className="text-text-muted hover:text-accent-pink text-xs flex-shrink-0 leading-none mt-0.5 cursor-pointer"
                      aria-label={`Delete ${stop.name}`}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function addFixedMarker(
  map: mapboxgl.Map,
  coords: { lng: number; lat: number },
  label: string,
  color: string
) {
  const el = document.createElement('div');
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';
  el.style.gap = '4px';

  const dot = document.createElement('div');
  dot.style.width = '14px';
  dot.style.height = '14px';
  dot.style.borderRadius = '50%';
  dot.style.background = color;
  dot.style.boxShadow = `0 0 8px ${color}80`;

  const text = document.createElement('div');
  text.textContent = label;
  text.style.color = '#F0EDE6';
  text.style.fontSize = '11px';
  text.style.fontWeight = '600';
  text.style.textShadow = '0 1px 4px rgba(0,0,0,0.8)';
  text.style.whiteSpace = 'nowrap';

  el.appendChild(dot);
  el.appendChild(text);

  new mapboxgl.Marker({ element: el }).setLngLat([coords.lng, coords.lat]).addTo(map);
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
