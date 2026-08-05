// The one place the Sentry DSN env var is interpreted. Born of a real incident
// (2026-08-05): NEXT_PUBLIC_SENTRY_DSN in Vercel held four concatenated paste
// fragments — three truncated at ".../45117" plus one complete DSN at the end.
// Sentry's production parser accepts any "https://key@host/rest" shape, so every
// envelope was POSTed to a garbled ingest URL and silently dropped: 90 days of
// zero events while "the DSN is in the bundle" checks all passed.
// The end-anchored match keeps a clean value as-is, recovers the last complete
// DSN from a mangled paste, and returns undefined (Sentry stays off) for
// anything else — a broken value can never again fail silently as "enabled".
export function resolveSentryDsn(raw: string | undefined): string | undefined {
  const m = (raw ?? "").trim().match(/https:\/\/[0-9a-f]+@[\w.-]+\/\d+$/);
  return m ? m[0] : undefined;
}
