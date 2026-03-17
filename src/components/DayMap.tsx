'use client';

import { useEffect, useRef } from 'react';
import type { MelbourneIdea } from '@/lib/types';

interface DayMapProps {
  spots: MelbourneIdea[];
}

export default function DayMap({ spots }: DayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const spotsWithCoords = spots.filter((s) => s.lng != null && s.lat != null);

  useEffect(() => {
    if (!containerRef.current || spotsWithCoords.length === 0) return;

    const init = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

      if (!mapRef.current && containerRef.current) {
        mapRef.current = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/light-v11',
          center: [spotsWithCoords[0].lng!, spotsWithCoords[0].lat!],
          zoom: 13,
          interactive: true,
        });
      }

      const map = mapRef.current;
      if (!map) return;

      // Wait for map to be ready
      if (!map.isStyleLoaded()) {
        await new Promise<void>((resolve) => map.on('load', () => resolve()));
      }

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const bounds = new mapboxgl.LngLatBounds();

      spotsWithCoords.forEach((spot) => {
        const el = document.createElement('div');
        Object.assign(el.style, {
          width: '10px', height: '10px', borderRadius: '50%',
          background: '#7C3AED', border: '2px solid white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', cursor: 'pointer',
        });

        const popup = new mapboxgl.Popup({ offset: 8, maxWidth: '180px' }).setHTML(
          `<div style="font-size:12px;font-family:system-ui;"><strong>${esc(spot.text)}</strong>${spot.description ? `<br><span style="color:#888">${esc(spot.description)}</span>` : ''}</div>`
        );

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([spot.lng!, spot.lat!])
          .setPopup(popup)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([spot.lng!, spot.lat!]);
      });

      if (spotsWithCoords.length > 1) {
        map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
      } else {
        map.setCenter([spotsWithCoords[0].lng!, spotsWithCoords[0].lat!]);
        map.setZoom(14);
      }
    };

    init();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Re-run when spots change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotsWithCoords.map((s) => s.id).join(',')]);

  if (spotsWithCoords.length === 0) return null;

  return (
    <div ref={containerRef} className="w-full h-[180px] rounded-lg overflow-hidden border border-border" />
  );
}

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
