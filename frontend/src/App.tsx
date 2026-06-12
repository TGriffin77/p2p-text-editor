import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import Editor from "./components/Editor";
import Preview from "./components/Preview";
import {
  Group,
  Panel,
  Separator,
  type Layout,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { useYjs } from "./hooks/useYjs";
import StatusWorkspace from "./components/StatusWorkspace";
import handleRoomHash from "./util/handleRoomHash";

function App() {
  const [roomId, setRoomId] = useState(handleRoomHash);
  const { ydoc, ytext, provider } = useYjs(roomId);

  const [content, setContent] = useState("");
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const panelRef = useRef<PanelImperativeHandle>(null);

  // ytext → content (remote changes + initial persisted load)
  useEffect(() => {
    const handler = (_event: unknown, txn: unknown) => {
      const transaction = txn as { origin?: unknown };
      if (transaction.origin === "user") return;
      setContent(ytext.toString());
    };
    ytext.observe(handler);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize from external Yjs store
    setContent(ytext.toString());
    return () => ytext.unobserve(handler);
  }, [ytext]);

  // Track connected peers
  useEffect(() => {
    const handler = (event: {
      webrtcPeers: string[];
      bcPeers: string[];
    }) => {
      setPeerIds([...event.webrtcPeers, ...event.bcPeers]);
    };
    provider.on("peers", handler);
    return () => provider.off("peers", handler);
  }, [provider]);

  // content → ytext (local edits)
  const handleChange = useCallback(
    (newContent: string) => {
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newContent);
      }, "user");
      setContent(newContent);
    },
    [ydoc, ytext],
  );

  // Handle manual hash change
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash) setRoomId(hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  function handleLayoutChanged(layout: Layout) {
    const editorSize = layout["editor"];
    if (editorSize !== 50 && editorSize > 48 && editorSize < 52) {
      panelRef.current?.resize("50%");
    }
  }

  const peerCount = peerIds.length;

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">My App</h1>
      <div className="text-sm text-gray-500 mb-2">
        Room: {roomId} | Peers: {peerCount}
      </div>
      <StatusWorkspace />
      <div className="flex flex-col w-full h-screen">
        <Group orientation="horizontal" onLayoutChange={handleLayoutChanged}>
          <Panel
            panelRef={panelRef}
            id="editor"
            defaultSize="50%"
            minSize="30%"
          >
            <Editor value={content} onChange={handleChange} />
          </Panel>
          <Separator />
          <Panel id="preview" defaultSize="50%" minSize="30%">
            <Preview content={content} />
          </Panel>
        </Group>
      </div>
    </>
  );
}

export default App;
