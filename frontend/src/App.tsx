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
import { useYjs } from "./hooks/useYjs";
import StatusWorkspace from "./components/StatusWorkspace";
import UserSettings from "./components/UserSettings";
import WelcomePage from "./components/WelcomePage";
import handleRoomHash from "./util/handleRoomHash";
import {
  addRoomToHistory,
  getRoomHistory,
  updateRoomName,
  updateRoomLastEdited,
} from "./util/roomHistory";

function App() {
  const [roomId, setRoomId] = useState<string | null>(handleRoomHash);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash;
      setRoomId(hash || null);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (roomId) {
      const id = roomId.startsWith("#") ? roomId.slice(1) : roomId;
      addRoomToHistory(id);
    }
  }, [roomId]);

  if (!roomId) return <WelcomePage />;

  return <EditorWorkspace key={roomId} roomId={roomId} />;
}

function EditorWorkspace({ roomId }: { roomId: string }) {
  const { ytext, provider, awareness } = useYjs(roomId);
  const [content, setContent] = useState("");
  const [peerCount, setPeerCount] = useState(0);
  const panelRef = useRef<PanelImperativeHandle>(null);
  const lastEditedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomNameRaw = roomId.startsWith("#") ? roomId.slice(1) : roomId;
  const [roomName, setRoomName] = useState(() => {
    const history = getRoomHistory();
    return history.find((e) => e.id === roomNameRaw)?.name || "";
  });

  useEffect(() => {
    const handler = () => {
      setContent(ytext.toString());
      if (ytext.toString()) {
        clearTimeout(lastEditedTimer.current ?? undefined);
        lastEditedTimer.current = setTimeout(() => {
          updateRoomLastEdited(roomNameRaw);
        }, 2000);
      }
    };
    ytext.observe(handler);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize from external Yjs store
    setContent(ytext.toString());
    return () => {
      ytext.unobserve(handler);
      clearTimeout(lastEditedTimer.current ?? undefined);
    };
  }, [ytext, roomNameRaw]);

  useEffect(() => {
    const handler = () => {
      setPeerCount(awareness.getStates().size - 1);
    };
    awareness.on("change", handler);
    handler();
    return () => awareness.off("change", handler);
  }, [awareness]);

  function handleRoomNameChange(name: string) {
    setRoomName(name);
    updateRoomName(roomNameRaw, name);
  }

  function handleLayoutChanged(layout: Layout) {
    const editorSize = layout["editor"];
    if (editorSize !== 50 && editorSize > 48 && editorSize < 52) {
      panelRef.current?.resize("50%");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">P2P Text Editor</h1>
      <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
        <input
          type="text"
          value={roomName}
          onChange={(e) => handleRoomNameChange(e.target.value)}
          placeholder="Room name..."
          className="border border-transparent hover:border-gray-300 focus:border-gray-400 rounded px-1.5 py-0.5 text-sm outline-none bg-transparent w-40"
        />
        <span className="text-xs text-gray-400 font-mono">
          #{roomNameRaw.slice(0, 8)}
        </span>
        <span>| Peers: {peerCount}</span>
        <span>|</span>
        <UserSettings awareness={awareness} />
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
            <Editor ytext={ytext} awareness={awareness} />
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
