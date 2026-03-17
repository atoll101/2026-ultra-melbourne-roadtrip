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

export type ItineraryNotes = Record<string, DayNote>;

export interface MelbourneIdea {
  id: string;
  category: string;
  text: string;
  author: string;
  upvotedBy: string[];
  createdAt: string;
}

export interface NotepadData {
  content: string;
  lastEditedBy: string;
  lastEditedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  addedBy: string;
}

export interface KVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
}
