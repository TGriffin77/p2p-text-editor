import { WebSocketServer, WebSocket } from "ws";

const PORT = 3001;

const rooms = new Map<string, Map<WebSocket, string>>();
let connectionCounter = 0;

function peerId(socket: WebSocket): string | undefined {
  for (const room of rooms.values()) {
    const id = room.get(socket);
    if (id) return id;
  }
}

function send(socket: WebSocket, msg: object) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

function signalType(data: any): string {
  if (data.offer) return "offer";
  if (data.answer) return "answer";
  if (data.ice) return "ice-candidate";
  return "unknown";
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[${timestamp()}] Signaling server running on ws://localhost:${PORT}`);

wss.on("connection", (socket) => {
  let currentRoomId: string | null = null;
  let myId: string | null = null;
  const connId = ++connectionCounter;

  console.log(`[${timestamp()}] [connect] client #${connId} connected (total: ${connectionCounter})`);

  socket.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case "join-room": {
        const roomId = msg.roomId;
        if (!roomId || typeof roomId !== "string") return;

        // Leave previous room if any
        if (currentRoomId) {
          const prevRoom = rooms.get(currentRoomId);
          if (prevRoom) {
            prevRoom.delete(socket);
            console.log(`[${timestamp()}] [leave] client #${connId} left room "${currentRoomId}"`);
            if (prevRoom.size === 0) {
              rooms.delete(currentRoomId);
              console.log(`[${timestamp()}] [room] room "${currentRoomId}" deleted (empty)`);
            }
          }
        }

        let room = rooms.get(roomId);
        if (!room) {
          room = new Map();
          rooms.set(roomId, room);
          console.log(`[${timestamp()}] [room] room "${roomId}" created`);
        }

        myId = crypto.randomUUID();
        room.set(socket, myId);
        currentRoomId = roomId;

        const peerIds: string[] = [];
        for (const [peer, pid] of room) {
          if (peer !== socket) peerIds.push(pid);
        }

        send(socket, { type: "room-joined", roomId, myId, peerIds });
        console.log(`[${timestamp()}] [join] peer ${myId.slice(0, 8)} joined "${roomId}" (room size: ${room.size})`);

        // Notify existing peers
        for (const [peer, pid] of room) {
          if (peer !== socket) {
            send(peer, { type: "peer-joined", peerId: myId });
            console.log(`[${timestamp()}] [join] notified peer ${pid.slice(0, 8)} of new peer ${myId.slice(0, 8)}`);
          }
        }
        break;
      }

      case "signal": {
        const targetId = msg.to;
        const data = msg.data;
        if (!targetId || !currentRoomId) return;

        const room = rooms.get(currentRoomId);
        if (!room) return;

        const senderId = peerId(socket);
        console.log(`[${timestamp()}] [signal] ${signalType(data)} from ${(senderId ?? "?").slice(0, 8)} -> ${targetId.slice(0, 8)}`);

        for (const [peer, pid] of room) {
          if (pid === targetId) {
            send(peer, {
              type: "signal",
              from: senderId,
              data,
            });
            break;
          }
        }
        break;
      }
    }
  });

  socket.on("close", () => {
    connectionCounter--;
    console.log(`[${timestamp()}] [disconnect] client #${connId} disconnected (total: ${connectionCounter})`);

    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const leavingId = room.get(socket);
    room.delete(socket);

    if (room.size === 0) {
      rooms.delete(currentRoomId);
      console.log(`[${timestamp()}] [room] room "${currentRoomId}" deleted (empty)`);
    } else {
      console.log(`[${timestamp()}] [leave] peer ${(leavingId ?? "?").slice(0, 8)} left "${currentRoomId}" (room size: ${room.size})`);
      for (const [peer] of room) {
        send(peer, { type: "peer-left", peerId: leavingId });
      }
    }
  });
});
