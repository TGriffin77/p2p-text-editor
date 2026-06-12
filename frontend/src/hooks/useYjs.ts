import { useEffect, useMemo } from "react";
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

export function useYjs(roomId: string) {
  const roomName = roomId.startsWith("#") ? roomId.slice(1) : roomId;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- recreate Y.Doc on room change
  const ydoc = useMemo(() => new Y.Doc(), [roomName]);
  const ytext = useMemo(() => ydoc.getText("content"), [ydoc]);

  const provider = useMemo(
    () =>
      new WebrtcProvider(roomName, ydoc, {
        signaling: [WS_URL],
        peerOpts: { config: TURN_CONFIG },
      }),
    [roomName, ydoc],
  );

  const indexeddb = useMemo(
    () => new IndexeddbPersistence(roomName, ydoc),
    [roomName, ydoc],
  );

  // Restore from localStorage if y-indexeddb has no persisted data
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

  // Save a snapshot to localStorage on beforeunload and periodically
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

  // Clean up everything when roomId changes or component unmounts
  useEffect(() => {
    return () => {
      indexeddb.destroy();
      provider.destroy();
      ydoc.destroy();
    };
  }, [indexeddb, provider, ydoc]);

  return { ydoc, ytext, provider };
}
