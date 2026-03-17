'use client';

import { useEffect, useRef } from 'react';
import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import type { MelbourneIdea } from '@/lib/types';

interface DayMapProps {
  spots: MelbourneIdea[];
}

export default function DayMap({ spots }: DayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const spotsWithCoords = spots.filter((s) => s.lng != null && s.lat != null);

  useEffect(() => {
    if (!containerRef.current || spotsWithCoords.length === 0) return;

    const init = async () => {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? '';
      if (!apiKey) return;
      setOptions({ key: apiKey, v: 'weekly' });
      const { Map, InfoWindow } = await importLibrary('maps') as google.maps.MapsLibrary;
      const { AdvancedMarkerElement } = await importLibrary('marker') as google.maps.MarkerLibrary;

      if (!mapRef.current && containerRef.current) {
        mapRef.current = new Map(containerRef.current, {
          center: { lat: spotsWithCoords[0].lat!, lng: spotsWithCoords[0].lng! },
          zoom: 13,
          mapId: 'day-spots',
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'cooperative',
        });
        infoWindowRef.current = new InfoWindow();
      }

      const map = mapRef.current!;
      const infoWindow = infoWindowRef.current!;

      // Clear old markers
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];

      const bounds = new google.maps.LatLngBounds();

      spotsWithCoords.forEach((spot) => {
        const pin = document.createElement('div');
        Object.assign(pin.style, { width: '12px', height: '12px', borderRadius: '50%', background: '#7C3AED', border: '2px solid white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', cursor: 'pointer' });

        const marker = new AdvancedMarkerElement({
          map,
          position: { lat: spot.lat!, lng: spot.lng! },
          content: pin,
          title: spot.text,
        });

        marker.addListener('click', () => {
          infoWindow.setContent(
            `<div style="font-size:12px;font-family:system-ui;max-width:180px;"><strong>${esc(spot.text)}</strong>${spot.description ? `<br><span style="color:#888">${esc(spot.description)}</span>` : ''}</div>`
          );
          infoWindow.open({ anchor: marker, map });
        });

        markersRef.current.push(marker);
        bounds.extend({ lat: spot.lat!, lng: spot.lng! });
      });

      if (spotsWithCoords.length > 1) {
        map.fitBounds(bounds, { top: 40, bottom: 40, left: 40, right: 40 });
      } else {
        map.setCenter({ lat: spotsWithCoords[0].lat!, lng: spotsWithCoords[0].lng! });
        map.setZoom(14);
      }
    };

    init();

    return () => {
      markersRef.current.forEach((m) => (m.map = null));
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotsWithCoords.map((s) => s.id).join(',')]);

  if (spotsWithCoords.length === 0) return null;

  return (
    <div ref={containerRef} className="w-full h-[180px] rounded-lg overflow-hidden border border-border" />
  );
}

function esc(s: string) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
