"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export default function SubscribeForm({ source = "blog", button = "Subscribe", dark = false }: { source?: string; button?: string; dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state === "sending") return;
    setState("sending");
    try {
      const { data, error } = await sb.rpc("newsletter_subscribe", { p_email: email, p_source: source });
      if (error || data === "invalid") setState("err");
      else setState("ok");
    } catch { setState("err"); }
  };

  if (state === "ok") return <div className="blg-subok">✓ You&apos;re in — the next edition lands in your inbox.</div>;

  return (
    <form className="blg-subform" onSubmit={submit}>
      <input type="email" required placeholder="you@example.com" aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" className={dark ? "dark" : undefined}>{state === "sending" ? "…" : button}</button>
      {state === "err" && <span className="blg-suberr">Please enter a valid email.</span>}
    </form>
  );
}
