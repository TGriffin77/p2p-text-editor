import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";

const PORT = parseInt(process.env.PORT || "3001");

const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
}

const rooms = new Map<string, Room>();

function getRoom(name: string): Room {
  let room = rooms.get(name);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, clients: new Set() };
    rooms.set(name, room);
  }
  return room;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`y-websocket server running on ws://localhost:${PORT}`);

wss.on("connection", (conn, req) => {
  const roomName = (req.url || "").slice(1).split("?")[0] || "default";
  const room = getRoom(roomName);
  room.clients.add(conn);

  conn.binaryType = "arraybuffer";

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    conn.send(encoding.toUint8Array(encoder));
  }

  {
    const awarenessStates = room.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      conn.send(encoding.toUint8Array(encoder));
    }
  }

  conn.on("message", (raw) => {
    const data = new Uint8Array(
      Array.isArray(raw) ? Buffer.concat(raw as Buffer[]) : (raw as Buffer)
    );

    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case messageSync: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        try {
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, "server");
        } catch {
          return;
        }
        if (encoding.length(encoder) > 1) {
          conn.send(encoding.toUint8Array(encoder));
        }
        room.clients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
        break;
      }
      case messageAwareness: {
        const awarenessUpdate = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, "server");
        room.clients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
        break;
      }
      case messageQueryAwareness: {
        const states = room.awareness.getStates();
        if (states.size > 0) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(
              room.awareness,
              Array.from(states.keys())
            )
          );
          conn.send(encoding.toUint8Array(encoder));
        }
        break;
      }
    }
  });

  conn.on("close", () => {
    room.clients.delete(conn);
    if (room.clients.size === 0) {
      rooms.delete(roomName);
    }
  });

  conn.on("error", (err) => {
    console.error(`WebSocket error:`, err.message);
  });
});
