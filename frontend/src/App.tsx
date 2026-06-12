import { useEffect, useRef, useState } from "react";
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
import { useAutosave } from "./hooks/useAutosave";
import { useSignaling } from "./hooks/useSignaling";
import { usePeerConnection } from "./hooks/usePeerConnection";
import StatusWorkspace from "./components/StatusWorkspace";
import handleRoomHash from "./util/handleRoomHash";

function App() {
  const [roomId, setRoomId] = useState(handleRoomHash);

  // Start empty — localStorage is only loaded after signaling confirms we're alone
  const [content, setContent] = useState("");
  useAutosave(content, roomId);
  const panelRef = useRef<PanelImperativeHandle>(null);

  const updatingFromRemoteRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;

  const { myId, peerIds, sendSignal, onSignal, onPeerJoined, onPeerLeft } =
    useSignaling(roomId);

  const { send } = usePeerConnection(
    sendSignal,
    onSignal,
    onPeerJoined,
    onPeerLeft,
    (data) => {
      updatingFromRemoteRef.current = true;
      setContent(data);
      updatingFromRemoteRef.current = false;
    },
    () => contentRef.current,
  );

  // Once signaling confirms our room join (myId is set), load from localStorage
  // only if we're alone in the room. If peers exist, their content is the truth.
  const initialJoinRef = useRef(false);
  useEffect(() => {
    if (myId && !initialJoinRef.current) {
      initialJoinRef.current = true;
      const saved = localStorage.getItem(roomId);
      if (saved) setContent(saved);
    }
    if (!myId) {
      initialJoinRef.current = false;
    }
  }, [myId, peerIds, roomId]);

  // When roomId changes, reset and wait for the new room's signal
  useEffect(() => {
    setContent("");
    initialJoinRef.current = false;
  }, [roomId]);

  // Send content changes to all connected peers
  useEffect(() => {
    if (updatingFromRemoteRef.current) return;
    if (!content) return;
    send(content);
  }, [content, send]);

  // Handle manual url change, updating only if new hash is non-empty
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      if (hash) {
        setRoomId(hash);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Snapping functionality for middle of screen.
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
            <Editor value={content} onChange={setContent} />
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
