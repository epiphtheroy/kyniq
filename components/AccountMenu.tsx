"use client";

/**
 * AccountMenu — auth entry point + logged-in indicator in the top nav.
 * Logged out: a "Sign in" link. Logged in: the username with a dropdown
 * (Dashboard / Profile / Settings / Log out). This is both the login fix
 * (the wiki nav had no auth UI) and the personalization anchor.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { clearLocalTakeDrafts } from "@/lib/room/drafts";

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function AccountMenu() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let alive = true;
    const c = sb();
    (async () => {
      const { data: auth } = await c.auth.getUser();
      const user = auth?.user;
      if (!alive) return;
      if (user) {
        const { data: p } = await c.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle();
        if (!alive) return;
        setUsername((p?.username as string) ?? null);
        setName((p?.display_name as string) || (p?.username as string) || (user.email?.split("@")[0] ?? "Account"));
      }
      setReady(true);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function logout() {
    await sb().auth.signOut();
    clearLocalTakeDrafts();
    setName(null); setUsername(null); setOpen(false);
    router.push("/"); router.refresh();
  }

  if (!ready) return <span className="acct-ph" aria-hidden="true" />;
  if (!name) return <Link href="/login" className="acct-signin">Sign in</Link>;

  return (
    <span className="acct" ref={wrap}>
      <button type="button" className="acct-btn" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span className="acct-dot" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
        <span className="acct-name">{name}</span>
      </button>
      {open && (
        <div className="acct-menu" role="menu">
          <Link href="/room" role="menuitem" onClick={() => setOpen(false)}>My Room</Link>
          {username && <Link href={`/u/${username}`} role="menuitem" onClick={() => setOpen(false)}>Public profile</Link>}
          <Link href="/settings" role="menuitem" onClick={() => setOpen(false)}>Settings</Link>
          <button type="button" role="menuitem" className="acct-logout" onClick={logout}>Log out</button>
        </div>
      )}
    </span>
  );
}
