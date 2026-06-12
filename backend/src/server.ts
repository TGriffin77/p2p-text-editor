import { WebSocketServer, WebSocket } from "ws";

const PORT = parseInt(process.env.PORT || "3001");

const topics = new Map<string, Set<WebSocket>>();

function send(conn: WebSocket, message: object) {
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(JSON.stringify(message));
  }
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

const wss = new WebSocketServer({ port: PORT });
console.log(`[${timestamp()}] y-webrtc signaling server running on ws://localhost:${PORT}`);

wss.on("connection", (conn) => {
  const subscribedTopics = new Set<string>();
  let closed = false;

  const connId = `#${Math.random().toString(36).slice(2, 6)}`;

  console.log(`[${timestamp()}] ${connId} connected`);

  conn.on("message", (raw) => {
    let message: any;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message?.type || closed) return;

    switch (message.type) {
      case "subscribe":
        (message.topics || []).forEach((topic: string) => {
          if (typeof topic !== "string") return;
          if (subscribedTopics.has(topic)) return;
          const set = topics.get(topic) ?? new Set();
          set.add(conn);
          topics.set(topic, set);
          subscribedTopics.add(topic);
          console.log(`[${timestamp()}] ${connId} subscribed to "${topic}"`);
        });
        break;
      case "unsubscribe":
        (message.topics || []).forEach((topic: string) => {
          const set = topics.get(topic);
          if (set) {
            set.delete(conn);
            if (set.size === 0) topics.delete(topic);
          }
          subscribedTopics.delete(topic);
          console.log(`[${timestamp()}] ${connId} unsubscribed from "${topic}"`);
        });
        break;
      case "publish":
        if (message.topic) {
          const receivers = topics.get(message.topic);
          if (receivers) {
            const payload = JSON.stringify(message);
            receivers.forEach((peer) => {
              if (peer !== conn && peer.readyState === WebSocket.OPEN) {
                peer.send(payload);
              }
            });
          }
        }
        break;
      case "ping":
        send(conn, { type: "pong" });
        break;
    }
  });

  conn.on("close", (code, reason) => {
    closed = true;
    subscribedTopics.forEach((topic) => {
      const set = topics.get(topic);
      if (set) {
        set.delete(conn);
        if (set.size === 0) topics.delete(topic);
      }
    });
    console.log(`[${timestamp()}] ${connId} disconnected (code=${code} reason=${reason.toString().slice(0, 40) || "none"})`);
  });

  conn.on("error", (err) => {
    console.error(`[${timestamp()}] ${connId} error:`, err.message);
  });
});
