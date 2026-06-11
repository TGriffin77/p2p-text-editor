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
import StatusWorkspace from "./components/StatusWorkspace";
import handleRoomHash from "./util/handleRoomHash";

function App() {
  const [roomId, setRoomId] = useState(handleRoomHash);

  const [content, setContent] = useState(
    () => localStorage.getItem(roomId) ?? "",
  );
  useAutosave(content, roomId);
  const panelRef = useRef<PanelImperativeHandle>(null);

  // Handle manual url change, updating only is new hash is non-empty
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

  // when roomId is loaded, mount from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(roomId);
    setContent(saved ?? "");
  }, [roomId]);

  // Snapping functionality for middle of screen.
  function handleLayoutChanged(layout: Layout) {
    const editorSize = layout["editor"];
    if (editorSize !== 50 && editorSize > 48 && editorSize < 52) {
      panelRef.current?.resize("50%");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">My App</h1>
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
