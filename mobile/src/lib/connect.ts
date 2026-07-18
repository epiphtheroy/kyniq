// Connect — bring your film life (HANDOFF-커넥트 §2). Connector registry +
// device-local state machine for the I1 file connectors.
//
// The registry's URLs and step copy mirror the interface audit in the canon
// doc §1 (the SSOT for guide wording — if a service renames a button, update
// the doc first, then the dict strings).
//
// State is device-local (AsyncStorage) in I1 by design: imported data itself
// lives in the server ledger (user_watch_log / user_movies — invariant §6-4);
// only the "where am I in the flow" breadcrumb is local. I2's user_connections
// migration promotes this to cross-device state.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DictKey } from "../i18n";

export type ConnectorId =
  | "letterboxd"
  | "imdb"
  | "netflix"
  | "watcha"
  | "trakt"
  | "tmdb"
  | "simkl";
// file/clipboard = the I1 export→pick flow; oauth = the I2 one-tap sign-in flow
// (system browser → server holds the tokens → server-side sync). §4.
export type ConnectorKind = "file" | "clipboard" | "oauth";

export type ConnectorStatus =
  | "idle"
  | "awaiting_file" // opened the export page; waiting for the user to pick the file
  | "awaiting_collect" // IMDb only: export queued at the service, waiting to collect
  | "authorizing" // oauth: system-browser sign-in sheet is open
  | "importing"
  | "syncing" // oauth: server is pulling the library
  | "done"
  | "error";

export type ConnectorState = {
  status: ConnectorStatus;
  films?: number; // committed rows
  ratings?: number; // rows that carried a rating
  unmatched?: number; // rows we couldn't match (surfaced, never hidden — §6-5)
  at?: number; // last transition, epoch ms
  error?: string;
};

export type Connector = {
  id: ConnectorId;
  kind: ConnectorKind;
  /** typographic tile — we ship no third-party logo art */
  monogram: string;
  tint: string; // tile accent (neutralized brand hue, never the Lava gradient)
  /** file/clipboard only — the export page opened in real Safari */
  exportUrl?: string;
  /** IMDb's two-stage queue: where the finished export is collected */
  collectUrl?: string;
  /** file/clipboard only — the 3 real-button guide steps */
  stepKeys?: [DictKey, DictKey, DictKey];
  /** extra expectation copy (IMDb wait / Netflix no-ratings / Watcha revert) */
  noteKey?: DictKey;
  /** file only — document-picker MIME hints */
  fileTypes?: string[];
  /** parse hint forwarded to the server (letterboxd zip vs csv is auto-detected) */
  sourceLabel: string;
  /** oauth only — the one-line sign-in pitch shown instead of the 3-step guide */
  pitchKey?: DictKey;
};

export const CONNECTORS: Connector[] = [
  {
    id: "letterboxd",
    kind: "file",
    monogram: "L",
    tint: "#5A9E4B",
    exportUrl: "https://letterboxd.com/settings/data/",
    stepKeys: ["connect.letterboxd.s1", "connect.letterboxd.s2", "connect.letterboxd.s3"],
    fileTypes: ["application/zip", "text/csv", "text/comma-separated-values"],
    sourceLabel: "letterboxd",
  },
  {
    id: "imdb",
    kind: "file",
    monogram: "IM",
    tint: "#C09A2E",
    exportUrl: "https://www.imdb.com/list/ratings",
    collectUrl: "https://www.imdb.com/exports/",
    stepKeys: ["connect.imdb.s1", "connect.imdb.s2", "connect.imdb.s3"],
    noteKey: "connect.imdb.wait",
    fileTypes: ["text/csv", "text/comma-separated-values"],
    sourceLabel: "imdb",
  },
  {
    id: "netflix",
    kind: "file",
    monogram: "N",
    tint: "#B1362F",
    exportUrl: "https://www.netflix.com/settings/viewing-history",
    stepKeys: ["connect.netflix.s1", "connect.netflix.s2", "connect.netflix.s3"],
    noteKey: "connect.netflix.note",
    fileTypes: ["text/csv", "text/comma-separated-values"],
    sourceLabel: "netflix",
  },
  {
    id: "watcha",
    kind: "clipboard",
    monogram: "W",
    tint: "#C9566B",
    exportUrl: "https://pedia.watcha.com/",
    stepKeys: ["connect.watcha.s1", "connect.watcha.s2", "connect.watcha.s3"],
    noteKey: "connect.watcha.revert",
    fileTypes: [],
    sourceLabel: "watcha",
  },
  // OAuth connectors (I2, §1 A-grade) — one-tap sign-in, tokens live server-side,
  // sync is a server pull. tmdb ids come back directly so matching is exact.
  {
    id: "trakt",
    kind: "oauth",
    monogram: "TK",
    tint: "#C0392B", // Trakt red (#ED1C24), neutralized
    pitchKey: "connect.oauth.pitch",
    sourceLabel: "trakt",
  },
  {
    id: "tmdb",
    kind: "oauth",
    monogram: "TM",
    tint: "#2A9FC4", // TMDB cyan (#01B4E4), neutralized
    pitchKey: "connect.oauth.pitch",
    sourceLabel: "tmdb",
  },
  {
    id: "simkl",
    kind: "oauth",
    monogram: "SK",
    tint: "#2AA46B", // Simkl green (#2ECC71) on ink (#0B0F14), neutralized
    pitchKey: "connect.oauth.pitch",
    sourceLabel: "simkl",
  },
];

export function connector(id: ConnectorId): Connector {
  return CONNECTORS.find((c) => c.id === id)!;
}

// ---------------------------------------------------------------- state store

const KEY = "mt-connect-v1";
type StateMap = Partial<Record<ConnectorId, ConnectorState>>;

let cache: StateMap | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<StateMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as StateMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function save(map: StateMap): Promise<void> {
  cache = map;
  for (const fn of listeners) fn();
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // breadcrumb only — the ledger itself is server-side
  }
}

export async function connectStates(): Promise<StateMap> {
  return { ...(await load()) };
}

export async function setConnectState(id: ConnectorId, state: ConnectorState): Promise<void> {
  const map = await load();
  await save({ ...map, [id]: { ...state, at: Date.now() } });
}

export async function clearConnectState(id: ConnectorId): Promise<void> {
  const map = await load();
  const next = { ...map };
  delete next[id];
  await save(next);
}

/** Subscribe to state changes (hub re-render). Returns unsubscribe. */
export function onConnectChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// The return banner should nudge for a while, not forever: an abandoned export
// (user opened the page, never downloaded) would otherwise re-fire on every app
// foreground indefinitely. Surface an awaiting connector only within this window.
const AWAITING_TTL = 60 * 60 * 1000; // 1h

/** Connectors currently waiting for a file — drives the foreground return banner. */
export async function awaitingConnectors(): Promise<Connector[]> {
  const map = await load();
  const now = Date.now();
  return CONNECTORS.filter((c) => {
    const st = map[c.id];
    if (!st) return false;
    if (st.status !== "awaiting_file" && st.status !== "awaiting_collect") return false;
    return !st.at || now - st.at < AWAITING_TTL;
  });
}
