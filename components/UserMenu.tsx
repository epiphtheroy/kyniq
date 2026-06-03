"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

interface Props {
  username: string;
  displayName: string | null;
  role: string;
}

export default function UserMenu({ username, displayName, role }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const initial = (displayName || username || "?").charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        className="avatar disp"
        style={{ width: 30, height: 30, fontSize: 13, cursor: "pointer", background: "var(--bg)", border: "1px solid var(--hairline)" }}
        aria-label="User menu"
      >
        {initial}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: 38, background: "var(--surface)",
          border: "1px solid var(--hairline)", borderRadius: 4, padding: "8px 0",
          minWidth: 180, zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          <Link href={`/u/${username}`} className="footer-link" style={{ padding: "8px 16px", display: "block" }} onClick={() => setOpen(false)}>
            View profile
          </Link>
          <Link href="/settings" className="footer-link" style={{ padding: "8px 16px", display: "block" }} onClick={() => setOpen(false)}>
            Settings
          </Link>
          {role === "admin" && (
            <Link href="/admin" className="footer-link" style={{ padding: "8px 16px", display: "block" }} onClick={() => setOpen(false)}>
              Admin
            </Link>
          )}
          <hr className="rule" style={{ margin: "4px 0" }} />
          <button onClick={handleSignOut} className="footer-link" style={{ padding: "8px 16px", display: "block", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
