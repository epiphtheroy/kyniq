"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="shell" style={{ textAlign: "center", paddingTop: 60, paddingBottom: 60 }}>
      <h1 className="disp" style={{ fontSize: 28, margin: 0 }}>Something went wrong</h1>
      <p className="body muted" style={{ fontSize: 16, marginTop: 12 }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <div style={{ marginTop: 20, display: "flex", gap: 14, justifyContent: "center" }}>
        <button onClick={() => reset()} className="btn">Try again</button>
        <a href="/" className="link-primary">Go home</a>
      </div>
    </main>
  );
}
