import { useEffect } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";

const WS_URL = import.meta.env.VITE_WS_URL || `wss://${window.location.host}/ws`;

function lsKey(roomName: string) {
  return `p2p-editor-${roomName}`;
}

interface CachedEntry {
  ydoc: Y.Doc;
  ytext: Y.Text;
  yname: Y.Text;
  provider: WebsocketProvider;
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
    const yname = ydoc.getText("name");
    const provider = new WebsocketProvider(WS_URL, roomName, ydoc, {
      disableBc: true,
    });
    const indexeddb = new IndexeddbPersistence(roomName, ydoc);
    entry = { ydoc, ytext, yname, provider, indexeddb, refCount: 0 };
    cache.set(roomName, entry);
  }

  const { ydoc, ytext, yname, provider, indexeddb } = entry;

  useEffect(() => {
    const onStatus = (event: { status: string }) => {
      console.log(`y-websocket (${roomName}):`, event.status);
    };
    const onSynced = (synced: boolean) => {
      console.log(`y-websocket (${roomName}):`, synced ? "synced" : "not synced");
    };
    provider.on("status", onStatus);
    provider.on("synced", onSynced);
    return () => {
      provider.off("status", onStatus);
      provider.off("synced", onSynced);
    };
  }, [roomName, provider]);

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

  return { ydoc, ytext, yname, provider, awareness: provider.awareness };
}
