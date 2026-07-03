"use client";
/** Inspector-swap v2 — 설명가능성의 UI. v1(상시 4단 컬럼) → v2(온디맨드 슬라이드오버).
 *  기존 API(select/setDefault/reset)는 전 페이지 하위호환:
 *   select() = 콘텐츠 지정 + 패널 열기 · reset() = 선택 해제 + 닫기 ·
 *   setDefault() = 페이지 요약 저장(자동으로 열지 않음 — 앱바 「요약」 버튼으로 열람).
 *  라우트 규칙: 요약(def)은 등록한 pathname에서만 유효(다른 페이지 요약이 새어 보이지 않음),
 *  라우트가 바뀌면 선택·패널을 자동으로 닫는다(언마운트된 페이지의 콜백이 살아남지 않게). */
import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const [sel, setSel] = useState<ReactNode | null>(null);
  const [def, setDef] = useState<{ path: string; node: ReactNode } | null>(null);
  const [title, setTitle] = useState("상세 · 왜");
  const [open, setOpen] = useState(false);

  /* 라우트 이동 → 선택 해제 + 닫기 (요약은 path 스코프라 자연히 무효화) */
  useEffect(() => {
    setSel(null); setOpen(false); setTitle("상세 · 왜");
  }, [pathname]);

  const select = useCallback((node: ReactNode, t?: string) => {
    setSel(node); setTitle(t ?? "상세 · 왜"); setOpen(true);
  }, []);
  const setDefault = useCallback((node: ReactNode) => {
    setDef({ path: pathRef.current, node });
  }, []);
  const openDefault = useCallback(() => { setSel(null); setTitle("이 페이지 요약"); setOpen(true); }, []);
  const close = useCallback(() => setOpen(false), []);
  const reset = useCallback(() => { setSel(null); setOpen(false); setTitle("상세 · 왜"); }, []);

  const defNode = def && def.path === pathname ? def.node : null;

  return (
    <InspectorCtx.Provider value={{
      content: sel ?? defNode, title, open, hasDefault: defNode != null,
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
