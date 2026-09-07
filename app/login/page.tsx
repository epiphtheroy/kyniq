"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BrandStack } from "@/components/Brand";
import { Suspense } from "react";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleGoogleLogin() {
    const supabase = getSupabase();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  }

  return (
    <main className="shell" style={{ maxWidth: 420 }}>
      <div style={{ textAlign: "center", margin: "24px 0 26px" }}>
        <Link href="/" className="brandlink" aria-label="Metatake home">
          <BrandStack height={80} label="" />
        </Link>
        <div className="tagline" style={{ marginTop: 6 }}>Read films closely.</div>
      </div>

      <h1 className="disp" style={{ fontSize: 22, margin: "0 0 18px", textAlign: "center" }}>
        Welcome back
      </h1>

      {error && (
        <div style={{ padding: "10px 13px", marginBottom: 14, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, color: "#991b1b", fontSize: 13, fontFamily: "var(--font-ui)" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required className="field" style={{ width: "100%", boxSizing: "border-box", outline: "none" }} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required className="field" style={{ width: "100%", boxSizing: "border-box", outline: "none" }} />
        <button type="submit" disabled={loading} className="btn" style={{ textAlign: "center", width: "100%", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="ui muted" style={{ textAlign: "center", fontSize: 12, margin: "16px 0" }}>or</div>

      <button onClick={handleGoogleLogin} className="field" style={{ display: "block", width: "100%", textAlign: "center", cursor: "pointer", background: "var(--surface)", boxSizing: "border-box" }}>
        Sign in with Google
      </button>

      <p className="ui" style={{ fontSize: 13, textAlign: "center", marginTop: 20 }}>
        <Link href="/reset" className="accent" style={{ textDecoration: "none" }}>Forgot password?</Link>
      </p>

      <p className="ui" style={{ fontSize: 13, textAlign: "center", marginTop: 8 }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="accent" style={{ textDecoration: "none" }}>Sign up</Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
