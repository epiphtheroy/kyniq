/**
 * lib/crm/gmail.ts — minimal Gmail REST client over fetch (NO googleapis dep).
 * Server-only. Scopes minted by worker/gmail-auth.py: gmail.compose + gmail.readonly
 * (gmail.compose already authorizes drafts.send, so no P3 re-consent — §5-6-A).
 *
 * Env: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

let cachedToken: { access: string; exp: number } | null = null;

export class GmailAuthError extends Error {}

/** Refresh (and cache) an access token. Throws GmailAuthError on invalid_grant. */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 5 * 60_000) return cachedToken.access;

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refresh = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refresh) {
    throw new GmailAuthError("Gmail credentials not configured (GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN).");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    if (json.error === "invalid_grant") throw new GmailAuthError("invalid_grant — Gmail refresh token expired/revoked.");
    throw new Error(`Gmail token refresh failed: ${json.error ?? res.status}`);
  }
  cachedToken = { access: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.access;
}

async function api(path: string, init?: RequestInit, retries = 2): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if ((res.status === 429 || res.status >= 500) && retries > 0) {
    await new Promise((r) => setTimeout(r, (3 - retries) * 800 + 400));
    return api(path, init, retries - 1);
  }
  return res;
}

function b64url(s: string): string {
  return Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build a base64url RFC822 message. Subject is RFC2047-encoded for non-ASCII. */
function buildRaw(to: string, subject: string, body: string, from?: string, threadHeaders?: { messageId?: string }): string {
  const encSubject = /[^\x20-\x7E]/.test(subject)
    ? `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`
    : subject;
  const lines = [
    from ? `From: ${from}` : null,
    `To: ${to}`,
    `Subject: ${encSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    threadHeaders?.messageId ? `In-Reply-To: ${threadHeaders.messageId}` : null,
    threadHeaders?.messageId ? `References: ${threadHeaders.messageId}` : null,
    "",
    Buffer.from(body, "utf-8").toString("base64"),
  ].filter((l): l is string => l !== null);
  return b64url(lines.join("\r\n"));
}

export interface DraftResult {
  draftId: string;
  messageId: string;
  threadId: string;
}

/** Create a Gmail draft. Returns draftId + the message id/threadId. */
export async function createDraft(
  to: string,
  subject: string,
  body: string,
  opts?: { from?: string; threadId?: string }
): Promise<DraftResult> {
  const raw = buildRaw(to, subject, body, opts?.from);
  const message: Record<string, unknown> = { raw };
  if (opts?.threadId) message.threadId = opts.threadId;
  const res = await api("/drafts", { method: "POST", body: JSON.stringify({ message }) });
  if (!res.ok) throw new Error(`createDraft failed: ${res.status} ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as { id: string; message?: { id: string; threadId: string } };
  return { draftId: j.id, messageId: j.message?.id ?? "", threadId: j.message?.threadId ?? "" };
}

/** Send an existing draft (P3). Returns sent message id + threadId. */
export async function sendDraft(draftId: string): Promise<{ messageId: string; threadId: string }> {
  const res = await api("/drafts/send", { method: "POST", body: JSON.stringify({ id: draftId }) });
  if (!res.ok) throw new Error(`sendDraft failed: ${res.status} ${await res.text().catch(() => "")}`);
  const j = (await res.json()) as { id: string; threadId: string };
  return { messageId: j.id, threadId: j.threadId };
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  snippet: string;
  internalDate: number;
}

export async function listMessageIds(q: string, max = 100): Promise<{ id: string; threadId: string }[]> {
  const out: { id: string; threadId: string }[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - out.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await api(`/messages?${params.toString()}`);
    if (!res.ok) throw new Error(`listMessages failed: ${res.status}`);
    const j = (await res.json()) as { messages?: { id: string; threadId: string }[]; nextPageToken?: string };
    out.push(...(j.messages ?? []));
    pageToken = j.nextPageToken;
  } while (pageToken && out.length < max);
  return out.slice(0, max);
}

function header(headers: { name: string; value: string }[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function getMessageMeta(id: string): Promise<GmailMessageMeta> {
  const res = await api(`/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject`);
  if (!res.ok) throw new Error(`getMessage failed: ${res.status}`);
  const j = (await res.json()) as {
    id: string; threadId: string; snippet?: string; internalDate?: string;
    payload?: { headers?: { name: string; value: string }[] };
  };
  const h = j.payload?.headers ?? [];
  return {
    id: j.id,
    threadId: j.threadId,
    from: header(h, "From"),
    to: header(h, "To"),
    subject: header(h, "Subject"),
    snippet: (j.snippet ?? "").slice(0, 300),
    internalDate: j.internalDate ? Number(j.internalDate) : 0,
  };
}

/** Extract a bare lowercased email address from a "Name <a@b.com>" header. */
export function parseEmail(headerValue: string): string {
  const m = headerValue.match(/<([^>]+)>/) ?? headerValue.match(/([^\s<>]+@[^\s<>]+)/);
  return (m?.[1] ?? "").trim().toLowerCase();
}
