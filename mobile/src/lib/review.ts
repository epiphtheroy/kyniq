// When to ask for a store rating.
//
// The prompt is scarce and one-way: iOS allows three sheets per user per year
// and spends one whether or not the reader was ready, and a rating asked for at
// a flat moment is answered with a flat star. So this policy is deliberately
// stingy — better to ask a tenth of readers at a moment that earned it than
// everyone at an average one.
//
// Five gates, all of which must hold:
//   1. three separate days of use — one long first session is not a habit;
//   2. eight judgments — the reader has used the thing the app is actually for;
//   3. three days since the install we first saw — never during the honeymoon;
//   4. a positive moment just happened (the caller decides what counts: today
//      that is a film rated 4+, the app's own signal that the evening worked);
//   5. no ask within 120 days, and never more than three in the app's lifetime.
//
// Measurement: the OS reports nothing, so `review:ask` in the beacon is the only
// number we will ever have on this side. The ratings themselves are counted in
// App Store Connect and Play Console — read the two together, never the prompt
// against itself.
//
// All state is local to the device on purpose. It is a nudge budget, not a fact
// about the person, and syncing it would put "how often we pestered you" in the
// database for no gain.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ask as askForReview, canAsk, openListing } from "../platform/review";
import { trackTap } from "./beacon";

const KEY = "mt.review.v1";

const MIN_DAYS_USED = 3;
const MIN_JUDGMENTS = 8;
const MIN_AGE_DAYS = 3;
const COOLDOWN_DAYS = 120;
const MAX_ASKS = 3;
/** Stars, out of five: the rating at which the reader is telling us the pick
 *  landed. Below it they are judging a film, not the app. */
const LOVED = 4;
/** Long enough for the rating sheet's exit animation to be gone, short enough
 *  that the system sheet still reads as a consequence of what just happened. */
const DELAY_MS = 900;
const DAY_MS = 86_400_000;

type State = {
  /** ISO day this install was first seen. */
  first: string;
  /** Distinct ISO days of use, oldest first, capped — we only ever ask "how
   *  many", so keeping more than the threshold would be hoarding. */
  days: string[];
  judgments: number;
  asks: number;
  /** Epoch ms of the last ask; 0 = never asked. */
  lastAsk: number;
};

let cache: State | null = null;
let loading: Promise<State> | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

const today = (): string => new Date().toISOString().slice(0, 10);

function fresh(): State {
  const d = today();
  return { first: d, days: [d], judgments: 0, asks: 0, lastAsk: 0 };
}

async function load(): Promise<State> {
  if (cache) return cache;
  if (!loading) {
    loading = (async (): Promise<State> => {
      let next: State;
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const p = raw ? (JSON.parse(raw) as Partial<State>) : null;
        next = p?.first
          ? {
              first: p.first,
              days: Array.isArray(p.days) ? p.days.slice(-MIN_DAYS_USED) : [],
              judgments: typeof p.judgments === "number" ? p.judgments : 0,
              asks: typeof p.asks === "number" ? p.asks : 0,
              lastAsk: typeof p.lastAsk === "number" ? p.lastAsk : 0,
            }
          : fresh();
      } catch {
        // Storage unavailable: behave as a first run. The gates then hold this
        // device back for three more days, which is the safe direction to fail.
        next = fresh();
      }
      cache = next;
      return next;
    })();
  }
  return loading;
}

/** Trailing write: judgments arrive in bursts and this is a nudge budget, not
 *  a ledger — one flush per burst is enough, and a lost tail costs an ask that
 *  was never urgent. */
function persist(s: State): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {});
  }, 1_000);
}

/** Mount once from the root layout: today counts as a day of use. */
export async function noteLaunch(): Promise<void> {
  const s = await load();
  const d = today();
  if (s.days.includes(d)) return;
  s.days = [...s.days, d].slice(-MIN_DAYS_USED);
  persist(s);
}

/** One judgment tap — want, pass, seen, rate, restore. Called from the single
 *  gate in state/films.tsx so no surface can forget it. */
export function noteJudgment(): void {
  void load().then((s) => {
    s.judgments += 1;
    persist(s);
  });
}

async function eligible(): Promise<boolean> {
  const s = await load();
  if (s.asks >= MAX_ASKS) return false;
  if (s.lastAsk && Date.now() - s.lastAsk < COOLDOWN_DAYS * DAY_MS) return false;
  if (s.days.length < MIN_DAYS_USED) return false;
  if (s.judgments < MIN_JUDGMENTS) return false;
  const age = (Date.now() - Date.parse(`${s.first}T00:00:00Z`)) / DAY_MS;
  if (!(age >= MIN_AGE_DAYS)) return false;
  return canAsk();
}

/**
 * The positive moment: a rating the reader just saved. Fire-and-forget — the
 * caller is a UI callback and must never wait on, or fail because of, a nudge.
 */
export function maybeAskAfterRating(rating: number): void {
  if (!(rating >= LOVED)) return;
  void (async () => {
    if (!(await eligible())) return;
    const s = await load();
    s.asks += 1;
    s.lastAsk = Date.now();
    persist(s);
    // Spend the ask in our own count BEFORE showing it: if the OS swallows the
    // sheet on its own quota we must still not come back tomorrow.
    trackTap("review:ask", "rated", { rating, ask: s.asks });
    setTimeout(() => {
      void askForReview();
    }, DELAY_MS);
  })();
}

/** The settings row. A link the reader chose, so it answers to no quota and
 *  spends none of the three asks. */
export async function openReviewListing(): Promise<void> {
  trackTap("review:listing");
  await openListing();
}
