import { lazy, Suspense, useEffect, useState } from "react";
import WelcomePage from "./components/WelcomePage";
import handleRoomHash from "./util/handleRoomHash";
import { addRoomToHistory } from "./util/roomHistory";

const EditorWorkspace = lazy(() => import("./components/EditorWorkspace"));

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

  return (
    <Suspense fallback={null}>
      <EditorWorkspace key={roomId} roomId={roomId} />
    </Suspense>
  );
}

export default App;
