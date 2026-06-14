"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
      }}
    >
      <form
        onSubmit={handleLogin}
        style={{
          width: "100%",
          maxWidth: 380,
          padding: "2.5rem 2rem",
          background: "var(--surface)",
          border: "1px solid var(--hairline)",
          borderRadius: 8,
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            color: "var(--ink)",
            marginBottom: "0.25rem",
          }}
        >
          Metatake Admin
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--muted)",
            marginBottom: "1.5rem",
          }}
        >
          Sign in with your admin account
        </p>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 6,
              color: "#991b1b",
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </div>
        )}

        <label
          style={{
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 4,
          }}
        >
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            fontSize: "0.875rem",
            marginBottom: "1rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <label
          style={{
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 4,
          }}
        >
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            border: "1px solid var(--hairline)",
            borderRadius: 6,
            fontSize: "0.875rem",
            marginBottom: "1.5rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem",
            background: "var(--ink)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
