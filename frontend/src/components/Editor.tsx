import { useEffect, useRef } from "react";
import * as Y from "yjs";
import { EditorView } from "codemirror";
import { drawSelection, dropCursor, highlightSpecialChars, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";

interface EditorProps {
  ytext: Y.Text;
  awareness: unknown;
}

export default function Editor({ ytext, awareness }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const view = new EditorView({
      doc: ytext.toString(),
      extensions: [
        drawSelection(),
        dropCursor(),
        highlightSpecialChars(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...yUndoManagerKeymap]),
        markdown(),
        yCollab(ytext, awareness),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ytext, awareness]);

  return <div ref={containerRef} className="w-full h-full" />;
}
