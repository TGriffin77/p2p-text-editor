const LS_KEY = "p2p-editor-room-history";

export interface RoomEntry {
  id: string;
  name: string;
  lastAccessed: number;
  lastEdited?: number;
}

export function getRoomHistory(): RoomEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    /* corrupted */
  }
  return [];
}

export function saveRoomHistory(entries: RoomEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

export function addRoomToHistory(id: string, name?: string) {
  const history = getRoomHistory();
  const now = Date.now();
  const existing = history.find((e) => e.id === id);
  if (existing) {
    existing.lastAccessed = now;
    if (name !== undefined) existing.name = name;
  } else {
    history.push({ id, name: name || "", lastAccessed: now });
  }
  history.sort((a, b) => b.lastAccessed - a.lastAccessed);
  saveRoomHistory(history);
}

export function removeRoomFromHistory(id: string) {
  const history = getRoomHistory().filter((e) => e.id !== id);
  saveRoomHistory(history);
}

export function updateRoomName(id: string, name: string) {
  const history = getRoomHistory();
  const existing = history.find((e) => e.id === id);
  if (existing) {
    existing.name = name;
    saveRoomHistory(history);
  }
}

export function updateRoomLastEdited(id: string) {
  const history = getRoomHistory();
  const existing = history.find((e) => e.id === id);
  if (existing) {
    existing.lastEdited = Date.now();
    saveRoomHistory(history);
  }
}
