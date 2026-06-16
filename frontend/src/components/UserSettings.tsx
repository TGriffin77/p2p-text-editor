import { useEffect, useRef, useState } from "react";

const LS_KEY = "p2p-editor-user";

interface SavedUser {
  name: string;
  color: string;
}

function getSaved(): SavedUser | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupted */
  }
  return null;
}

function save(name: string, color: string) {
  localStorage.setItem(LS_KEY, JSON.stringify({ name, color }));
}

interface UserSettingsProps {
  awareness: { setLocalStateField: (field: string, value: unknown) => void; getLocalState: () => { user?: { name?: string; color?: string } } | null };
}

export default function UserSettings({ awareness }: UserSettingsProps) {
  const saved = getSaved();
  const [name, setName] = useState(saved?.name ?? "");
  const [color, setColor] = useState(saved?.color ?? "#1ea7fd");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function handleToggle() {
    if (!open) {
      const user = awareness.getLocalState()?.user;
      if (!saved && user?.name) setName(user.name);
      if (!saved && user?.color) setColor(user.color);
    }
    setOpen(!open);
  }

  useEffect(() => {
    awareness.setLocalStateField("user", {
      name: name || "Anonymous",
      color,
      colorLight: color + "66",
    });
    save(name, color);
  }, [name, color, awareness]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      <button
        onClick={handleToggle}
        className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 cursor-pointer"
      >
        <span
          style={{ backgroundColor: color }}
          className="inline-block w-2.5 h-2.5 rounded-full"
        />
        {name || "You"}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded shadow-lg z-10 flex flex-col gap-2 min-w-36">
          <label className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 w-8">Name:</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-gray-300 rounded px-1 py-0.5 text-xs w-24"
              autoFocus
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            <span className="text-gray-500 w-8">Color:</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-5 p-0 border-none cursor-pointer"
            />
          </label>
        </div>
      )}
    </div>
  );
}
