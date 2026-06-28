import { useEffect } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL ||
  `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

let iceServers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

try {
  const res = await fetch(
    `https://thomasgriffin.metered.live/api/v1/turn/credentials?apiKey=${import.meta.env.VITE_METERED_API_KEY}`
  );
  if (res.ok) {
    const apiServers: RTCIceServer[] = await res.json();
    const relay = apiServers.find(
      (s) =>
        (Array.isArray(s.urls)
          ? s.urls.some((u: string) => u.startsWith("turns:"))
          : String(s.urls).startsWith("turns:")) &&
        String(s.urls).includes("transport=tcp")
    );
    if (relay) {
      iceServers = [{ urls: "stun:stun.l.google.com:19302" }, relay];
    }
  } else {
    console.error("[y-webrtc] Metered API returned", res.status);
  }
} catch (e) {
  console.error("[y-webrtc] Failed to fetch TURN credentials:", e);
}

console.log("[y-webrtc] ICE servers:", JSON.stringify(iceServers));

function lsKey(roomName: string) {
  return `p2p-editor-${roomName}`;
}

interface CachedEntry {
  ydoc: Y.Doc;
  ytext: Y.Text;
  yname: Y.Text;
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
    const yname = ydoc.getText("name");
    const provider = new WebrtcProvider(roomName, ydoc, {
      signaling: [SIGNALING_URL],
      peerOpts: { config: { iceServers } },
      filterBcConns: true,
    });
    const indexeddb = new IndexeddbPersistence(roomName, ydoc);
    entry = { ydoc, ytext, yname, provider, indexeddb, refCount: 0 };
    cache.set(roomName, entry);
  }

  const { ydoc, ytext, yname, provider, indexeddb } = entry;

  useEffect(() => {
    const onStatus = (event: { connected: boolean }) => {
      console.log(`y-webrtc (${roomName}):`, event.connected ? "connected" : "disconnected");
    };
    const onPeers = (event: {
      added: string[];
      removed: string[];
      webrtcPeers: string[];
      bcPeers: string[];
    }) => {
      console.log(
        `y-webrtc (${roomName}): peers — webrtc: ${event.webrtcPeers.length}, bc: ${event.bcPeers.length}`
      );
    };
    provider.on("status", onStatus);
    provider.on("peers", onPeers);
    return () => {
      provider.off("status", onStatus);
      provider.off("peers", onPeers);
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
