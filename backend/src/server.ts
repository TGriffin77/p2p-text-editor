import { WebSocketServer } from "ws";

const PORT = parseInt(process.env.PORT || "3001");

const topics = new Map<string, Set<any>>();

const wss = new WebSocketServer({ port: PORT });
console.log(`signaling server running on ws://localhost:${PORT}`);

wss.on("connection", (conn) => {
  const subscribedTopics = new Set<string>();
  let closed = false;

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      conn.close();
      clearInterval(pingInterval);
    } else {
      pongReceived = false;
      try {
        conn.ping();
      } catch {
        conn.close();
      }
    }
  }, 30000);

  conn.on("pong", () => {
    pongReceived = true;
  });

  conn.on("close", () => {
    closed = true;
    clearInterval(pingInterval);
    subscribedTopics.forEach((topicName) => {
      const subs = topics.get(topicName);
      if (subs) {
        subs.delete(conn);
        if (subs.size === 0) topics.delete(topicName);
      }
    });
    subscribedTopics.clear();
  });

  conn.on("message", (raw) => {
    if (closed) return;
    try {
      const message =
        typeof raw === "string" || Buffer.isBuffer(raw)
          ? JSON.parse(raw.toString())
          : raw;
      if (!message || !message.type) return;

      switch (message.type) {
        case "subscribe": {
          const topicsList: string[] = message.topics || [];
          topicsList.forEach((topicName: string) => {
            if (typeof topicName === "string") {
              let topic = topics.get(topicName);
              if (!topic) {
                topic = new Set();
                topics.set(topicName, topic);
              }
              topic.add(conn);
              subscribedTopics.add(topicName);
            }
          });
          break;
        }
        case "unsubscribe": {
          const topicsList: string[] = message.topics || [];
          topicsList.forEach((topicName: string) => {
            subscribedTopics.delete(topicName);
            const subs = topics.get(topicName);
            if (subs) subs.delete(conn);
          });
          break;
        }
        case "publish": {
          if (message.topic) {
            const receivers = topics.get(message.topic);
            if (receivers) {
              message.clients = receivers.size;
              receivers.forEach((receiver: any) => {
                if (receiver !== conn && receiver.readyState === 1) {
                  try {
                    receiver.send(JSON.stringify(message));
                  } catch {
                    receiver.close();
                  }
                }
              });
            }
          }
          break;
        }
        case "ping":
          try {
            conn.send(JSON.stringify({ type: "pong" }));
          } catch {
            conn.close();
          }
          break;
      }
    } catch {
      // ignore malformed messages
    }
  });
});
