import { useEffect } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

const TURN_CONFIG = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    },
  ],
};

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001";

function lsKey(roomName: string) {
  return `p2p-editor-${roomName}`;
}

interface CachedEntry {
  ydoc: Y.Doc;
  ytext: Y.Text;
  provider: WebrtcProvider;
  indexeddb: IndexeddbPersistence;
  refCount: number;
}

const cache = new Map<string, CachedEntry>();

export function useYjs(roomId: string) {
  const roomName = roomId.startsWith("#") ? roomId.slice(1) : roomId;

  let entry = cache.get(roomName);
  if (!entry) {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: [WS_URL],
      peerOpts: { config: TURN_CONFIG },
    });
    const indexeddb = new IndexeddbPersistence(roomName, ydoc);
    entry = { ydoc, ytext, provider, indexeddb, refCount: 0 };
    cache.set(roomName, entry);
  }

  const { ydoc, ytext, provider, indexeddb } = entry;

  useEffect(() => {
    const e = cache.get(roomName);
    if (!e) return;
    e.refCount++;

    return () => {
      e.refCount--;
      if (e.refCount <= 0) {
        Promise.resolve().then(() => {
          if (e.refCount <= 0) {
            cache.delete(roomName);
            e.indexeddb.destroy();
            e.provider.destroy();
            e.ydoc.destroy();
          }
        });
      }
    };
  }, [roomName]);

  useEffect(() => {
    let cancelled = false;
    const key = lsKey(roomName);

    const tryRestore = () => {
      if (cancelled) return;
      if (ytext.toString() === "") {
        const backup = localStorage.getItem(key);
        if (backup) {
          try {
            const data = new Uint8Array(JSON.parse(backup));
            ydoc.transact(() => {
              Y.applyUpdate(ydoc, data);
            }, "localStorageBackup");
          } catch {
            /* corrupted backup, ignore */
          }
        }
      }
      localStorage.removeItem(key);
    };

    if (indexeddb.synced) {
      tryRestore();
    } else {
      indexeddb.on("synced", tryRestore);
    }

    return () => {
      cancelled = true;
      indexeddb.off("synced", tryRestore);
    };
  }, [roomName, indexeddb, ydoc, ytext]);

  useEffect(() => {
    const key = lsKey(roomName);
    const save = () => {
      const state = Y.encodeStateAsUpdate(ydoc);
      localStorage.setItem(key, JSON.stringify(Array.from(state)));
    };

    window.addEventListener("beforeunload", save);
    const interval = setInterval(save, 5000);

    return () => {
      window.removeEventListener("beforeunload", save);
      clearInterval(interval);
      save();
    };
  }, [roomName, ydoc]);

  return { ydoc, ytext, provider, awareness: provider.awareness };
}
