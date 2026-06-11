import { useEffect, useRef, useCallback } from "react";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

interface SignalMessage {
  from: string;
  data: any;
}

export function usePeerConnection(
  sendSignal: (to: string, data: any) => void,
  onSignal: (cb: (msg: SignalMessage) => void) => () => void,
  onPeerJoined: (cb: (peerId: string) => void) => () => void,
  onPeerLeft: (cb: (peerId: string) => void) => () => void,
  onData: (data: string) => void,
) {
  const pcsRef = useRef(new Map<string, RTCPeerConnection>());
  const dcsRef = useRef(new Map<string, RTCDataChannel>());
  const sendSignalRef = useRef(sendSignal);
  sendSignalRef.current = sendSignal;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const cleanup = useCallback((peerId: string) => {
    const dc = dcsRef.current.get(peerId);
    if (dc) {
      dc.close();
      dcsRef.current.delete(peerId);
    }
    const pc = pcsRef.current.get(peerId);
    if (pc) {
      pc.close();
      pcsRef.current.delete(peerId);
    }
  }, []);

  const createPeer = useCallback(
    (peerId: string, initiator: boolean) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcsRef.current.set(peerId, pc);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignalRef.current(peerId, {
            ice: e.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          cleanup(peerId);
        }
      };

      if (initiator) {
        const dc = pc.createDataChannel("text");
        dcsRef.current.set(peerId, dc);

        dc.onmessage = (e) => onDataRef.current(e.data);

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendSignalRef.current(peerId, {
              offer: pc.localDescription,
            });
          })
          .catch(console.error);
      } else {
        pc.ondatachannel = (e) => {
          const dc = e.channel;
          dcsRef.current.set(peerId, dc);
          dc.onmessage = (ev) => onDataRef.current(ev.data);
        };
      }

      return pc;
    },
    [cleanup],
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      const { from, data } = msg;
      let pc = pcsRef.current.get(from);

      if (data.offer) {
        pc = createPeer(from, false);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignalRef.current(from, {
            answer: pc.localDescription,
          });
        } catch (err) {
          console.error("Signal error (offer):", err);
          cleanup(from);
        }
      } else if (data.answer) {
        if (!pc) return;
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } catch (err) {
          console.error("Signal error (answer):", err);
        }
      } else if (data.ice) {
        if (!pc) return;
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.ice));
        } catch (err) {
          console.error("Signal error (ice):", err);
        }
      }
    },
    [createPeer, cleanup],
  );

  // Wire up signaling subscriptions
  useEffect(() => {
    const unsubSignal = onSignal(handleSignal);
    const unsubJoin = onPeerJoined((peerId) => createPeer(peerId, true));
    const unsubLeave = onPeerLeft(cleanup);

    return () => {
      unsubSignal();
      unsubJoin();
      unsubLeave();
      for (const peerId of pcsRef.current.keys()) {
        cleanup(peerId);
      }
    };
  }, [onSignal, onPeerJoined, onPeerLeft, handleSignal, createPeer, cleanup]);

  const send = useCallback((data: string) => {
    for (const dc of dcsRef.current.values()) {
      if (dc.readyState === "open") {
        dc.send(data);
      }
    }
  }, []);

  return { send };
}
