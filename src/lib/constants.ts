export const TRIP_DATES = {
  departure: '2026-04-08T16:00:00+10:00', // 4pm AEST
  days: [
    { id: 'day-1', date: '2026-04-08', label: 'Day 1 — Wed Apr 8 · Sydney → Albury', stay: 'albury' as const },
    { id: 'day-2', date: '2026-04-09', label: 'Day 2 — Thu Apr 9 · Albury → Melbourne', stay: 'melbourne' as const },
    { id: 'day-3', date: '2026-04-10', label: 'Day 3 — Fri Apr 10 · Melbourne', stay: 'melbourne' as const },
    { id: 'day-4', date: '2026-04-11', label: 'Day 4 — Sat Apr 11 · Ultra', stay: 'melbourne' as const },
    { id: 'day-5', date: '2026-04-12', label: 'Day 5 — Sun Apr 12 · Melbourne', stay: 'melbourne' as const },
  ],
} as const;

export const ACCOMMODATION = {
  albury: {
    name: 'Night 1 — Albury',
    address: '286 Downside Street, East Albury NSW 2640',
  },
  melbourne: {
    name: 'Nights 2–4 — Melbourne',
    address: '38 Rose Lane, Unit 1802, Melbourne VIC 3000',
  },
} as const;

export const COORDINATES = {
  sydney: { lng: 151.2093, lat: -33.8688 },
  albury: { lng: 146.9135, lat: -36.0737 },
  melbourne: { lng: 144.9631, lat: -37.8136 },
} as const;

// Simplified route GeoJSON (Sydney → Albury → Melbourne via Hume Highway)
export const ROUTE_GEOJSON: GeoJSON.Feature<GeoJSON.LineString> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [151.2093, -33.8688], // Sydney
      [150.8931, -34.0576], // Campbelltown area
      [150.6042, -34.3418], // Mittagong
      [150.1781, -34.7501], // Goulburn
      [149.1300, -35.2809], // Canberra region
      [148.2910, -35.7127], // Yass
      [147.3598, -35.1082], // Wagga area
      [146.9135, -36.0737], // Albury
      [145.9486, -36.3584], // Benalla
      [145.3989, -36.3566], // Euroa
      [145.0000, -36.6200], // Seymour
      [144.9631, -37.8136], // Melbourne
    ],
  },
};

export const MELBOURNE_CATEGORIES = [
  'Eat',
  'Drink',
  'Sights',
  'Friday Night',
  'Coffee',
] as const;

export type MelbourneCategory = (typeof MELBOURNE_CATEGORIES)[number];

export const KV_KEYS = {
  stops: 'stops',
  itinerary: 'itinerary_notes',
  ideas: 'melbourne_ideas',
  notepad: 'notepad',
} as const;

export const POLL_INTERVAL = 12000; // 12 seconds
