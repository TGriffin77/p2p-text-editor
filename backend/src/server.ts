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

const messageLabels: Record<number, string> = {
  [messageSync]: "sync",
  [messageAwareness]: "awareness",
  [messageQueryAwareness]: "query-awareness",
};

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
}

const rooms = new Map<string, Room>();

function connId(): string {
  return `#${Math.random().toString(36).slice(2, 6)}`;
}

function ts(): string {
  return new Date().toLocaleTimeString();
}

function getRoom(name: string): Room {
  let room = rooms.get(name);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    room = { doc, awareness, clients: new Set() };
    rooms.set(name, room);
    console.log(`[${ts()}] room "${name}" created`);
  }
  return room;
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[${ts()}] y-websocket server running on ws://localhost:${PORT}`);

wss.on("connection", (conn, req) => {
  const id = connId();
  const roomName = (req.url || "").slice(1).split("?")[0] || "default";
  const room = getRoom(roomName);
  room.clients.add(conn);

  console.log(`[${ts()}] ${id} connected to "${roomName}" (peers: ${room.clients.size})`);

  conn.binaryType = "arraybuffer";

  {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    conn.send(encoding.toUint8Array(encoder));
    console.log(`[${ts()}] ${id} ← sync step 1 (server → client, ${encoding.length(encoder)} bytes)`);
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
      console.log(`[${ts()}] ${id} ← awareness (${awarenessStates.size} states, ${encoding.length(encoder)} bytes)`);
    }
  }

  conn.on("message", (raw) => {
    const data = new Uint8Array(
      Array.isArray(raw) ? Buffer.concat(raw as Buffer[]) : (raw as Buffer)
    );

    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    const label = messageLabels[messageType] ?? `unknown(${messageType})`;

    switch (messageType) {
      case messageSync: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        try {
          syncProtocol.readSyncMessage(decoder, encoder, room.doc, "server");
        } catch {
          console.log(`[${ts()}] ${id} ← ${label} (parse error, ${data.length} bytes)`);
          return;
        }
        const responseLen = encoding.length(encoder);
        if (responseLen > 1) {
          conn.send(encoding.toUint8Array(encoder));
        }
        let peerCount = 0;
        room.clients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
            client.send(data);
            peerCount++;
          }
        });
        console.log(
          `[${ts()}] ${id} → ${label} (${data.length} bytes, resp: ${responseLen} bytes, relayed to ${peerCount} peers)`
        );
        break;
      }
      case messageAwareness: {
        const awarenessUpdate = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, awarenessUpdate, "server");
        let peerCount = 0;
        room.clients.forEach((client) => {
          if (client !== conn && client.readyState === WebSocket.OPEN) {
            client.send(data);
            peerCount++;
          }
        });
        console.log(
          `[${ts()}] ${id} → ${label} (${data.length} bytes, ${awarenessUpdate.length} bytes update, relayed to ${peerCount} peers)`
        );
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
          console.log(
            `[${ts()}] ${id} ← query-awareness → ${states.size} states (${encoding.length(encoder)} bytes)`
          );
        } else {
          console.log(`[${ts()}] ${id} ← query-awareness (no states)`);
        }
        break;
      }
      default:
        console.log(`[${ts()}] ${id} ← ${label} (${data.length} bytes, unhandled)`);
    }
  });

  conn.on("close", () => {
    room.clients.delete(conn);
    console.log(`[${ts()}] ${id} disconnected from "${roomName}" (peers: ${room.clients.size})`);
    if (room.clients.size === 0) {
      rooms.delete(roomName);
      console.log(`[${ts()}] room "${roomName}" deleted (no clients left)`);
    }
  });

  conn.on("error", (err) => {
    console.error(`[${ts()}] ${id} error:`, err.message);
  });
});
