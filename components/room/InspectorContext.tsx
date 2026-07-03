"use client";
/** Inspector-swap v2 — 설명가능성의 UI. v1(상시 4단 컬럼) → v2(온디맨드 슬라이드오버).
 *  기존 API(select/setDefault/reset)는 전 페이지 하위호환:
 *   select() = 콘텐츠 지정 + 패널 열기 · reset() = 선택 해제 + 닫기 ·
 *   setDefault() = 페이지 요약 저장(자동으로 열지 않음 — 앱바 「요약」 버튼으로 열람).
 *  신규: open/close/openDefault (RoomShell이 렌더 소유). */
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Ctx = {
  content: ReactNode | null;
  title: string;
  open: boolean;
  hasDefault: boolean;
  select: (node: ReactNode, title?: string) => void;
  setDefault: (node: ReactNode) => void;
  openDefault: () => void;
  close: () => void;
  reset: () => void;
};
const InspectorCtx = createContext<Ctx | null>(null);

export function InspectorProvider({ children }: { children: ReactNode }) {
  const [sel, setSel] = useState<ReactNode | null>(null);
  const [def, setDef] = useState<ReactNode | null>(null);
  const [title, setTitle] = useState("상세 · 왜");
  const [open, setOpen] = useState(false);

  const select = useCallback((node: ReactNode, t?: string) => {
    setSel(node); setTitle(t ?? "상세 · 왜"); setOpen(true);
  }, []);
  const setDefault = useCallback((node: ReactNode) => setDef(node), []);
  const openDefault = useCallback(() => { setSel(null); setTitle("이 페이지 요약"); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => { setSel(null); setOpen(false); setTitle("상세 · 왜"); }, []);

  return (
    <InspectorCtx.Provider value={{
      content: sel ?? def, title, open, hasDefault: def != null,
      select, setDefault, openDefault, close, reset,
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
