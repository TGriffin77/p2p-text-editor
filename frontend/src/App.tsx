import { useRef, useState } from "react";

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

const STORAGE_KEY = "p2p-text-editor";

function App() {
  const [content, setContent] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? "",
  );
  useAutosave(content, STORAGE_KEY);
  const panelRef = useRef<PanelImperativeHandle>(null);

  function handleLayoutChanged(layout: Layout) {
    const editorSize = layout["editor"];
    if (editorSize !== 50 && editorSize > 48 && editorSize < 52) {
      panelRef.current?.resize("50%");
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold mb-4">My App</h1>

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
