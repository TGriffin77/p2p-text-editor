import { useEffect, useRef, useCallback, useState } from "react";

export interface SignalMessage {
  from: string;
  data: any;
}

export function useSignaling(roomId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [peerIds, setPeerIds] = useState<string[]>([]);

  const signalListeners = useRef<Set<(msg: SignalMessage) => void>>(new Set());
  const peerJoinedListeners = useRef<Set<(peerId: string) => void>>(new Set());
  const peerLeftListeners = useRef<Set<(peerId: string) => void>>(new Set());

  const onSignal = useCallback((cb: (msg: SignalMessage) => void) => {
    signalListeners.current.add(cb);
    return () => {
      signalListeners.current.delete(cb);
    };
  }, []);

  const onPeerJoined = useCallback((cb: (peerId: string) => void) => {
    peerJoinedListeners.current.add(cb);
    return () => {
      peerJoinedListeners.current.delete(cb);
    };
  }, []);

  const onPeerLeft = useCallback((cb: (peerId: string) => void) => {
    peerLeftListeners.current.add(cb);
    return () => {
      peerLeftListeners.current.delete(cb);
    };
  }, []);

  const sendSignal = useCallback((to: string, data: any) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "signal", to, data }));
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const ws = new WebSocket("ws://localhost:3001");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join-room", roomId }));
    };

    ws.onmessage = (event) => {
      let msg: any;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (msg.type) {
        case "room-joined":
          setMyId(msg.myId);
          setPeerIds(msg.peerIds);
          break;
        case "peer-joined":
          setPeerIds((prev) => [...prev, msg.peerId]);
          peerJoinedListeners.current.forEach((cb) => cb(msg.peerId));
          break;
        case "peer-left":
          setPeerIds((prev) => prev.filter((id) => id !== msg.peerId));
          peerLeftListeners.current.forEach((cb) => cb(msg.peerId));
          break;
        case "signal":
          signalListeners.current.forEach((cb) =>
            cb({ from: msg.from, data: msg.data }),
          );
          break;
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => {
      ws.close();
      wsRef.current = null;
      setMyId(null);
      setPeerIds([]);
    };
  }, [roomId]);

  return { myId, peerIds, sendSignal, onSignal, onPeerJoined, onPeerLeft };
}
