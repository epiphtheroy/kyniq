"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearLocalTakeDrafts } from "@/lib/room/drafts";

function getSupabase() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = getSupabase();
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push("/login?next=/settings"); return; }
      setUser(u);

      const { data: p } = await supabase.from("profiles").select("*").eq("id", u.id).single();
      if (p) {
        setProfile(p);
        setDisplayName(p.display_name || "");
        setUsername(p.username || "");
        setBio(p.bio || "");
        setIsPublic((p.is_public ?? true) && (p.portfolio_public ?? false));
        // Fault-soft: marketing_consent column may not exist yet (migration 0115 pending).
        try { setMarketing(!!(p as any).marketing_consent); } catch { setMarketing(false); }
      }
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setMessage(null);

    const supabase = getSupabase();
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      username: username.trim() || null,
      bio: bio.trim() || null,
      is_public: isPublic,
      portfolio_public: isPublic,
    }).eq("id", user.id);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Settings saved.");
    }
    setSaving(false);
  }

  async function handleToggleMarketing() {
    if (!user) return;
    const next = !marketing;
    setMarketing(next); // optimistic; UI stays responsive even if the DB write can't land yet

    const supabase = getSupabase();

    // (a) Persist the preference on the profile. FAULT-SOFT: profiles.marketing_consent
    // does not exist until migration 0115 ships — a missing column returns an error in the
    // response (or throws). Swallow both so the page never white-screens.
    try {
      await supabase.from("profiles").update(
        next
          ? { marketing_consent: true, email_optin_at: new Date().toISOString() }
          : { marketing_consent: false },
      ).eq("id", user.id);
    } catch {
      /* column not present yet — non-fatal, ignore */
    }

    // (b) On opt-in, subscribe the auth email to the list. This is independent of the
    // profile write above, so it still runs even when marketing_consent doesn't exist yet.
    if (next && user.email) {
      try {
        await supabase.rpc("newsletter_subscribe", { p_email: user.email, p_source: "settings" });
        setMessage("Subscribed — the weekly Metatake Read is on its way.");
      } catch {
        /* list write failed — non-fatal */
      }
    }
  }

  async function handleSignOut() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    clearLocalTakeDrafts();
    router.push("/");
    router.refresh();
  }

  async function handleDeleteAccount() {
    if (!confirm("Delete your account? Your authored content will be anonymized to '[deleted]'. This cannot be undone.")) return;

    const res = await fetch("/api/account/delete", { method: "POST" });
    if (res.ok) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
      clearLocalTakeDrafts();
      router.push("/");
    } else {
      setMessage("Failed to delete account.");
    }
  }

  if (loading) {
    return <main className="shell"><p className="ui muted">Loading…</p></main>;
  }

  const initial = (displayName || username || "?").charAt(0).toUpperCase();

  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 25, margin: "26px 0 4px" }}>Settings</h1>
      <p className="ui muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
        This is your private account page. What others see is your{" "}
        <Link href={`/u/${username}`} className="accent" style={{ textDecoration: "none" }}>
          public profile
        </Link>.
      </p>

      {message && (
        <div style={{ padding: "10px 13px", marginBottom: 14, background: message.startsWith("Error") ? "#fef2f2" : "#f0fdf4", border: `1px solid ${message.startsWith("Error") ? "#fecaca" : "#bbf7d0"}`, borderRadius: 4, fontSize: 13, fontFamily: "var(--font-ui)", color: message.startsWith("Error") ? "#991b1b" : "#166534" }}>
          {message}
        </div>
      )}

      <hr className="rule" />

      {/* Profile section */}
      <div className="seclbl">Profile</div>
      <div className="tick" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
        <div>
          <div className="ui muted" style={{ fontSize: 12, marginBottom: 5 }}>Display name</div>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field" style={{ width: "100%", boxSizing: "border-box", outline: "none" }} />
        </div>
        <div>
          <div className="ui muted" style={{ fontSize: 12, marginBottom: 5 }}>Username (your profile URL: metatake.net/u/…)</div>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="field" style={{ width: "100%", boxSizing: "border-box", outline: "none" }} />
        </div>
        <div>
          <div className="ui muted" style={{ fontSize: 12, marginBottom: 5 }}>Bio</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="field" rows={3} style={{ width: "100%", boxSizing: "border-box", resize: "vertical", outline: "none", minHeight: 60 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--hairline)", borderRadius: 4, padding: "11px 13px" }}>
          <span className="ui" style={{ fontSize: 14 }}>
            Public film portfolio <span className="muted" style={{ fontSize: 12 }}>— others can view your seen films &amp; NAV at /u/{username}</span>
          </span>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`ui ${isPublic ? "accent" : "muted"}`}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13 }}
          >
            {isPublic ? "On ⏻" : "Off"}
          </button>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn" style={{ alignSelf: "flex-start", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <hr className="rule" />

      {/* Account section */}
      <div className="seclbl">Account</div>
      <div className="tick" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="ui" style={{ fontSize: 14 }}>
            Email <span className="muted">· {user?.email}</span>
          </span>
        </div>
        <div style={{ marginTop: 4 }}>
          <button onClick={handleSignOut} className="action-secondary" style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Sign out
          </button>
        </div>
      </div>

      <hr className="rule" />

      {/* Notifications */}
      <div className="seclbl">Notifications</div>
      <div className="tick" />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480 }}>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, border: "1px solid var(--hairline)", borderRadius: 4, padding: "11px 13px", cursor: "pointer" }}>
          <span className="ui" style={{ fontSize: 14 }}>
            Email me the weekly Metatake Read <span className="muted" style={{ fontSize: 12 }}>— unsubscribe anytime</span>
          </span>
          <input
            type="checkbox"
            checked={marketing}
            onChange={handleToggleMarketing}
            aria-label="Email me the weekly Metatake Read"
            style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer", flex: "none" }}
          />
        </label>
        <div className="ui muted" style={{ fontSize: 12 }}>
          Email me when my reading is promoted into a canonical answer.{" "}
          <span style={{ fontSize: 11.5 }}>(fuller preferences coming later)</span>
        </div>
      </div>

      <hr className="rule" />

      {/* Danger zone */}
      <div className="seclbl" style={{ color: "var(--accent)" }}>Danger zone</div>
      <div style={{ borderTop: "2px solid var(--accent)", width: 34, margin: "8px 0 12px" }} />
      <div className="ui muted" style={{ fontSize: 13, maxWidth: 520 }}>
        Delete account. Your authored questions and readings are{" "}
        <span style={{ color: "var(--ink)" }}>anonymized to &ldquo;[deleted]&rdquo;</span>{" "}
        rather than removed, so the canonical answers others built on stay intact.{" "}
        <button onClick={handleDeleteAccount} className="accent" style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "none", fontSize: 13 }}>
          Delete my account ▸
        </button>
      </div>
    </main>
  );
}
