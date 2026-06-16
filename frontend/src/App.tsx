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
import handleRoomHash from "./util/handleRoomHash";

function App() {
  const [roomId, setRoomId] = useState(handleRoomHash);
  const { ytext, provider, awareness } = useYjs(roomId);

  const [content, setContent] = useState("");
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const panelRef = useRef<PanelImperativeHandle>(null);

  useEffect(() => {
    const handler = () => {
      setContent(ytext.toString());
    };
    ytext.observe(handler);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initialize from external Yjs store
    setContent(ytext.toString());
    return () => ytext.unobserve(handler);
  }, [ytext]);

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
      <div className="text-sm text-gray-500 mb-2 flex items-center gap-2">
        <span>Room: {roomId} | Peers: {peerCount}</span>
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
