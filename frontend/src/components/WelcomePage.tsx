import { useEffect, useRef, useState } from "react";
import {
  getRoomHistory,
  addRoomToHistory,
  removeRoomFromHistory,
  updateRoomName,
  type RoomEntry,
} from "../util/roomHistory";

const USER_LS_KEY = "p2p-editor-user";

interface SavedUser {
  name: string;
  color: string;
}

function getSavedUser(): SavedUser | null {
  try {
    const raw = localStorage.getItem(USER_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupted */
  }
  return null;
}

function saveUser(name: string, color: string) {
  localStorage.setItem(USER_LS_KEY, JSON.stringify({ name, color }));
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function WelcomePage() {
  const saved = getSavedUser();
  const [rooms, setRooms] = useState<RoomEntry[]>(getRoomHistory);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const [userName, setUserName] = useState(saved?.name ?? "");
  const [userColor, setUserColor] = useState(saved?.color ?? "#1ea7fd");
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveUser(userName, userColor);
  }, [userName, userColor]);

  useEffect(() => {
    if (!userOpen) return;
    const handler = (e: MouseEvent) => {
      if (userRef.current && !userRef.current.contains(e.target as Node))
        setUserOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userOpen]);

  function openRoom(id: string) {
    addRoomToHistory(id);
    // eslint-disable-next-line react-hooks/immutability
    window.location.hash = "#" + id;
  }

  function createRoom() {
    const id = crypto.randomUUID();
    addRoomToHistory(id, newName.trim() || undefined);
    window.location.hash = "#" + id;
  }

  function startRename(room: RoomEntry) {
    setEditingId(room.id);
    setEditName(room.name);
  }

  function saveRename(id: string) {
    updateRoomName(id, editName);
    setRooms(getRoomHistory());
    setEditingId(null);
  }

  function removeRoom(id: string) {
    removeRoomFromHistory(id);
    setRooms(getRoomHistory());
  }

  return (
    <div className="max-w-lg mx-auto mt-24 px-4">
      <h1 className="text-2xl font-bold mb-2">P2P Text Editor</h1>
      <p className="text-sm text-gray-500 mb-6">
        Collaborative markdown editing using WebRTC
      </p>

      <div ref={userRef} className="relative inline-block mb-6">
        <button
          onClick={() => setUserOpen(!userOpen)}
          className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 cursor-pointer"
        >
          <span
            style={{ backgroundColor: userColor }}
            className="inline-block w-2.5 h-2.5 rounded-full"
          />
          {userName || "You"}
        </button>
        {userOpen && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded shadow-lg z-10 flex flex-col gap-2 min-w-36">
            <label className="flex items-center gap-1 text-xs">
              <span className="text-gray-500 w-8">Name:</span>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="border border-gray-300 rounded px-1 py-0.5 text-xs w-24"
                autoFocus
              />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <span className="text-gray-500 w-8">Color:</span>
              <input
                type="color"
                value={userColor}
                onChange={(e) => setUserColor(e.target.value)}
                className="w-8 h-5 p-0 border-none cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm text-gray-600 mb-1">
          Room name (optional)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") createRoom();
            }}
            placeholder="My Room"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            onClick={createRoom}
            className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded hover:bg-blue-700 cursor-pointer whitespace-nowrap"
          >
            Create New Room
          </button>
        </div>
      </div>

      {rooms.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recent Rooms
          </h2>
          <ul className="space-y-1">
            {rooms.map((room) => (
              <li
                key={room.id}
                className="flex items-center gap-2 group hover:bg-gray-50 rounded px-2 py-1.5 -mx-2"
              >
                {editingId === room.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(room.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => saveRename(room.id)}
                    className="border border-gray-300 rounded px-2 py-0.5 text-sm flex-1"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => openRoom(room.id)}
                    className="text-sm text-left flex-1 truncate cursor-pointer hover:text-blue-600"
                  >
                    <div>{room.name || room.id.slice(0, 8) + "..."}</div>
                    {room.lastEdited && (
                      <div className="text-xs text-gray-400">
                        edited {formatRelativeTime(room.lastEdited)}
                      </div>
                    )}
                  </button>
                )}
                <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                  {room.id.slice(0, 8)}
                </span>
                <button
                  onClick={() => startRename(room)}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Rename"
                >
                  edit
                </button>
                <button
                  onClick={() => removeRoom(room.id)}
                  className="text-xs text-gray-400 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Remove"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
