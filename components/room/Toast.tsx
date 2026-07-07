"use client";
/** My Room v3 — the single toast provider (spec §4). One host in RoomShell;
 *  every mutation surface (useRoomActions, screens) speaks through useToast().
 *  Duplicate per-workspace toast markup is gone. One toast at a time (the last
 *  message wins), optional action slot — the dismiss toast mounts Undo there. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type ToastAction = { label: string; run: () => void | Promise<void> };
export type ToastOpts = { action?: ToastAction; duration?: number };
export type ToastApi = {
  /** Show a toast. Default duration 3200ms (6000ms when an action is attached). */
  toast: (msg: string, opts?: ToastOpts) => void;
  dismiss: () => void;
};

const ToastCtx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [cur, setCur] = useState<{ msg: string; action?: ToastAction } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setCur(null);
  }, []);

  const toast = useCallback((msg: string, opts?: ToastOpts) => {
    if (timer.current) clearTimeout(timer.current);
    setCur({ msg, action: opts?.action });
    timer.current = setTimeout(() => setCur(null), opts?.duration ?? (opts?.action ? 6000 : 3200));
  }, []);

  return (
    <ToastCtx.Provider value={{ toast, dismiss }}>
      {children}
      {cur ? (
        <div className="v2toast" role="status">
          <span>{cur.msg}</span>
          {cur.action ? (
            <button
              type="button"
              className="tact"
              onClick={() => { const a = cur.action; dismiss(); void a?.run(); }}
            >
              {cur.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used within ToastProvider");
  return c;
}
