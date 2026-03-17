export interface PitStop {
  id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
  addedBy: string;
  addedAt: string;
}

export interface DayNote {
  content: string;
  lastEditedBy: string;
  lastEditedAt: string;
}

export interface DayPlan {
  notes: string;
  spots: string[]; // idea IDs assigned to this day
  lastEditedBy: string;
  lastEditedAt: string;
}

export type ItineraryData = Record<string, DayPlan>;

export interface MelbourneIdea {
  id: string;
  category: string;
  text: string;
  description?: string;
  author: string;
  upvotedBy: string[];
  createdAt: string;
  mapsUrl?: string;
  lng?: number;
  lat?: number;
  assignedDay?: string; // day ID if dragged to itinerary
}

export interface NotepadData {
  content: string;
  lastEditedBy: string;
  lastEditedAt: string;
}

export interface ExtractedPlace {
  name: string;
  description: string;
  category: string;
  lat?: number;
  lng?: number;
}

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
