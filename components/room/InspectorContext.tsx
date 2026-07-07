"use client";
/** My Room v3 — inspector context (on-demand slide-over; <900px bottom sheet).
 *  Contract kept from v2, plus a 1-depth back stack (the Masquerade backlink
 *  hack, generalized):
 *   select() = set content + open (clears the back entry)
 *   push()   = set content + open, remembering the CURRENT selection as the
 *              back target (1 deep — a second push overwrites it)
 *   back()   = return to the remembered selection (or close if none)
 *   setDefault() = register the page brief (opened via the app-bar Brief button)
 *   reset()  = clear selection + close.
 *  Route rules: the brief is scoped to the pathname that registered it, and any
 *  route change clears selection/panel so unmounted pages' callbacks die with it.
 *  Content is a rendered snapshot — pass data via props and re-select from
 *  workspace state when it changes (see insp/ICard.tsx note). */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { STR } from "./strings";

type Entry = { node: ReactNode; title: string };

type Ctx = {
  content: ReactNode | null;
  title: string;
  open: boolean;
  hasDefault: boolean;
  canBack: boolean;
  select: (node: ReactNode, title?: string) => void;
  push: (node: ReactNode, title?: string) => void;
  back: () => void;
  setDefault: (node: ReactNode) => void;
  openDefault: () => void;
  close: () => void;
  reset: () => void;
};
const InspectorCtx = createContext<Ctx | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [sel, setSel] = useState<Entry | null>(null);
  const [prev, setPrev] = useState<Entry | null>(null); // 1-depth back target
  const [def, setDef] = useState<{ path: string; node: ReactNode } | null>(null);
  const [open, setOpen] = useState(false);

  /* Route change → clear selection + close (the brief is path-scoped, so it
     invalidates naturally). */
  useEffect(() => {
    setSel(null); setPrev(null); setOpen(false);
  }, [pathname]);

  const select = useCallback((node: ReactNode, t?: string) => {
    setSel({ node, title: t ?? STR.shell.inspectorTitle });
    setPrev(null);
    setOpen(true);
  }, []);
  const push = useCallback((node: ReactNode, t?: string) => {
    setSel((cur) => {
      if (cur) setPrev(cur);
      return { node, title: t ?? STR.shell.inspectorTitle };
    });
    setOpen(true);
  }, []);
  const back = useCallback(() => {
    setPrev((p) => {
      if (p) setSel(p);
      else setOpen(false);
      return null;
    });
  }, []);
  const setDefault = useCallback((node: ReactNode) => {
    setDef({ path: pathRef.current, node });
  }, []);
  const openDefault = useCallback(() => { setSel(null); setPrev(null); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => { setSel(null); setPrev(null); setOpen(false); }, []);

  const defNode = def && def.path === pathname ? def.node : null;
  const title = sel ? sel.title : STR.shell.briefTitle;

  return (
    <InspectorCtx.Provider value={{
      content: sel?.node ?? defNode, title, open, hasDefault: defNode != null, canBack: prev != null,
      select, push, back, setDefault, openDefault, close, reset,
    }}>
      {children}
    </InspectorCtx.Provider>
  );
}

export function useInspector() {
  const c = useContext(InspectorCtx);
  if (!c) throw new Error("useInspector must be used within InspectorProvider");
  return c;
}
