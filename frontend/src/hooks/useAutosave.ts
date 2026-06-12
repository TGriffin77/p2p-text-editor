import { useEffect, useRef } from "react";

const SAVE_DELAY = 500;

export function useAutosave(value: string, storageKey: string) {
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, value);
      } catch (e) {
        console.warn("Failed to save to localStorage", e);
      }
    }, SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [value, storageKey]);

  useEffect(() => {
    function handleBeforeUnload() {
      try {
        localStorage.setItem(storageKey, valueRef.current);
      } catch (e) {
        console.warn("Failed to save on unload", e);
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (valueRef.current) {
        handleBeforeUnload();
      }
    };
  }, [storageKey]);
}
