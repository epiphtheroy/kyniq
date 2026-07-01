"use client";
/** Inspector-swap: the UI implementation of explainability (HANDOFF §1).
 *  Anything clicked (row/rec/lineage) sets the right inspector to "its detail + why".
 *  Empty → the page's default analysis summary. */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Ctx = {
  content: ReactNode | null;
  title: string;
  select: (node: ReactNode, title?: string) => void;
  setDefault: (node: ReactNode) => void;
  reset: () => void;
};
const InspectorCtx = createContext<Ctx | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [def, setDef] = useState<ReactNode | null>(null);
  const [title, setTitle] = useState("인스펙터 · 분석");
  const select = useCallback((node: ReactNode, t?: string) => { setContent(node); setTitle(t ?? "인스펙터 · 상세"); }, []);
  const setDefault = useCallback((node: ReactNode) => setDef(node), []);
  const reset = useCallback(() => { setContent(null); setTitle("인스펙터 · 분석"); }, []);
  return (
    <InspectorCtx.Provider value={{ content: content ?? def, title, select, setDefault, reset }}>
      {children}
    </InspectorCtx.Provider>
  );
}

export function useInspector() {
  const c = useContext(InspectorCtx);
  if (!c) throw new Error("useInspector must be used within InspectorProvider");
  return c;
}
