/**
 * beacon — first-party analytics for the native app (server: /api/metrics/app,
 * table mt_app_events, migration 0145).
 *
 * Why this exists: native screens run no web beacon and no Vercel analytics
 * script, and the judgment taps (watchlist / seen / pass / rate) go straight to
 * Supabase RPCs without touching Vercel at all — so until now the only trace of
 * app use was the BFF ledger, which is a cache-miss floor and cannot see a tap.
 *
 * Identity: a random visitor id is minted ON DEVICE and replaced every day.
 * Nothing links a device across days and no id is derived from hardware, so
 * this counts daily actives and taps without tracking anyone. It needs no
 * crypto module, which keeps the whole feature OTA-shippable — no native build.
 *
 * Transport: events queue in memory and flush on a short timer, on batch size,
 * and when the app leaves the foreground. Failures drop the batch; analytics
 * must never retry its way into the user's data plan, and never surface.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import { METATAKE_BASE, APP_VERSION } from "../config";

type EventType = "screen" | "tap" | "action";
type QueuedEvent = { t: EventType; name: string; arg?: string; props?: Record<string, unknown>; ts: number };

const VISITOR_KEY = "mt_beacon_visitor";   // { day, id } — id is re-minted daily
const OPTOUT_KEY = "mt_beacon_optout";     // "1" disables collection entirely
const ENDPOINT = `${METATAKE_BASE}/api/metrics/app`;
const FLUSH_MS = 8_000;
const MAX_BATCH = 20;
const MAX_QUEUE = 100; // a long offline stretch must not grow without bound

const rid = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2, 10);

const today = () => new Date().toISOString().slice(0, 10);

const sessionId = rid();          // per launch
let visitorId: string | null = null;
let visitorDay = "";
let optedOut = false;
let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

/** The daily-rotating id, re-minted whenever the calendar day changes. */
async function visitor(): Promise<string | null> {
  const day = today();
  if (visitorId && visitorDay === day) return visitorId;
  try {
    const raw = await AsyncStorage.getItem(VISITOR_KEY);
    const saved = raw ? (JSON.parse(raw) as { day?: string; id?: string }) : null;
    if (saved?.day === day && saved.id) {
      visitorId = saved.id;
    } else {
      visitorId = rid();
      await AsyncStorage.setItem(VISITOR_KEY, JSON.stringify({ day, id: visitorId }));
    }
    visitorDay = day;
    return visitorId;
  } catch {
    return null; // storage unavailable — stay silent rather than mint per event
  }
}

async function flush(): Promise<void> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (optedOut || !queue.length) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  const vid = await visitor();
  if (!vid) return;
  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vid,
        sid: sessionId,
        platform: Platform.OS === "ios" ? "ios" : "android",
        app_v: APP_VERSION,
        events: batch,
      }),
      keepalive: true,
    });
  } catch {
    // Dropped on purpose: a retry queue would replay stale events and spend
    // the user's data to no analytical benefit.
  }
  if (queue.length) schedule();
}

function schedule() {
  if (timer || optedOut) return;
  timer = setTimeout(() => { void flush(); }, FLUSH_MS);
}

function enqueue(t: EventType, name: string, arg?: string, props?: Record<string, unknown>) {
  if (optedOut || __DEV__) return; // never measure the developer's own taps
  if (queue.length >= MAX_QUEUE) queue.shift();
  queue.push({ t, name, arg, props, ts: Date.now() });
  if (queue.length >= MAX_BATCH) void flush();
  else schedule();
}

/** Mount once from the root layout. Flushes on backgrounding. */
export function startBeacon(): () => void {
  if (started) return () => {};
  started = true;
  void AsyncStorage.getItem(OPTOUT_KEY).then((v) => { optedOut = v === "1"; });
  const sub = AppState.addEventListener("change", (s) => {
    if (s !== "active") void flush();
  });
  return () => { sub.remove(); started = false; };
}

/** A screen view. `name` is the route pattern, `arg` the concrete slug/path. */
export function trackScreen(name: string, arg?: string) {
  enqueue("screen", name, arg);
}

/** A tap the user made: "watchlist:add", "tonight:pass", "rate:save"… */
export function trackTap(name: string, arg?: string, props?: Record<string, unknown>) {
  enqueue("tap", name, arg, props);
}

/** Owner escape hatch, mirroring the web's mt_optout. */
export async function setBeaconOptOut(on: boolean): Promise<void> {
  optedOut = on;
  if (on) queue = [];
  try { await AsyncStorage.setItem(OPTOUT_KEY, on ? "1" : "0"); } catch {}
}

export async function beaconOptedOut(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(OPTOUT_KEY)) === "1"; } catch { return false; }
}
