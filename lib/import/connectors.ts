/**
 * Import connectors — what each service actually makes you do.
 * (Ported from mobile/src/lib/connect.ts, which is the SSOT for this wording:
 *  HANDOFF-커넥트-기록이관.md §1 is the interface audit behind it. If a service
 *  renames a button, fix the canon doc, then the app, then this file.)
 *
 * The web used to model an import as "pick a file". That is not what any of
 * these services hand you:
 *
 *   Letterboxd  one click, ZIP downloads immediately
 *   IMDb        TWO stages — you REQUEST an export, IMDb prepares it, and you
 *               collect the CSV minutes later from imdb.com/exports
 *   Netflix     buried under Account → Profile → Viewing activity → Download all,
 *               and carries no ratings at all
 *   Watcha      no export exists; you make the profile public, copy the page,
 *               and paste
 *
 * So a tile cannot just open a file dialog: for IMDb the file does not exist
 * yet, and a dialog demanding it is the whole bug (owner, 2026-08-05: "imdb
 * 누르니까 작동이 안되더라구요"). Each connector carries the real steps, the page
 * that starts them, and — where the service queues the work — the page where the
 * result is collected.
 */

export type ConnectorId = "letterboxd" | "imdb" | "netflix" | "watcha" | "sheet" | "text";
export type ConnectorKind = "file" | "paste";

export type Connector = {
  id: ConnectorId;
  name: string;
  /** Format hint on the tile face. */
  fmt: string;
  kind: ConnectorKind;
  /** Where the export begins. Opened in a new tab. */
  exportUrl?: string;
  /** Services that QUEUE the export: where the finished file is collected. */
  collectUrl?: string;
  /** The real buttons, in order — three steps, no more (the app's rule). */
  steps: string[];
  /** What to expect that the steps can't say (a wait, a missing field). */
  note?: string;
  /** File-input accept list, narrowed per service so the picker shows the file. */
  accept?: string;
  /** Label for the collect button, when there is one. */
  collectLabel?: string;
};

export const CONNECTORS: Connector[] = [
  {
    id: "letterboxd",
    name: "Letterboxd",
    fmt: "ZIP · CSV",
    kind: "file",
    exportUrl: "https://letterboxd.com/settings/data/",
    steps: [
      "Sign in at letterboxd.com — the export page opens in a new tab",
      "Click “Export your data” — a ZIP downloads immediately",
      "Come back to this tab and choose the ZIP",
    ],
    accept: ".zip,.csv",
  },
  {
    id: "imdb",
    name: "IMDb",
    fmt: "CSV · queued",
    kind: "file",
    exportUrl: "https://www.imdb.com/list/ratings",
    collectUrl: "https://www.imdb.com/exports/",
    collectLabel: "Open imdb.com/exports ↗",
    steps: [
      "Sign in at imdb.com and open Your ratings",
      "Click ⋮ → “Export” — IMDb starts preparing your file",
      "Collect the CSV at imdb.com/exports, then choose it here",
    ],
    note: "IMDb does not hand you the file straight away — it queues the export and usually takes a few minutes. Import another service while you wait; everything merges.",
    accept: ".csv",
  },
  {
    id: "netflix",
    name: "Netflix",
    fmt: "CSV",
    kind: "file",
    exportUrl: "https://www.netflix.com/settings/viewing-history",
    steps: [
      "Sign in at netflix.com in a browser — the mobile app has no history screen",
      "Scroll to the bottom and click “Download all”",
      "Come back and choose NetflixViewingHistory.csv",
    ],
    note: "Netflix exports titles and dates only — there are no ratings to bring.",
    accept: ".csv",
  },
  {
    id: "watcha",
    name: "Watcha",
    fmt: "paste",
    kind: "paste",
    exportUrl: "https://pedia.watcha.com/",
    steps: [
      "Set your profile public for a moment: Profile → Settings → visibility",
      "Open your ratings page, scroll to the very bottom, Select All, Copy",
      "Come back and paste it in the box below — we read it as it is",
    ],
    note: "Done? You can switch your profile back to private now.",
  },
  {
    id: "sheet",
    name: "Excel / CSV",
    fmt: "any sheet",
    kind: "file",
    steps: [
      "Any spreadsheet with a title column works — year, rating and date are optional",
      "Save it as .xlsx or .csv",
      "Choose the file here — we detect the columns",
    ],
    accept: ".csv,.tsv,.xlsx,.xls",
  },
  {
    id: "text",
    name: "Free text",
    fmt: "AI-parsed",
    kind: "paste",
    steps: [
      "Copy any list of titles — a diary, a notes app, a chat message",
      "Paste it in the box below",
      "We decode the format; you confirm every match before anything is saved",
    ],
  },
];

export function connector(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

/** Every extension any connector accepts — the default for the drop zone. */
export const ALL_ACCEPT = ".zip,.csv,.tsv,.xlsx,.xls,.txt";

/* ------------------------------------------------------------------ awaiting */

/**
 * The breadcrumb that survives leaving the page. Sending someone to IMDb means
 * losing them to another tab for minutes; when they come back the page must
 * remember what they were doing rather than presenting the same cold grid.
 * (The app does this on foreground — AppState "active" + a 1h TTL, connect.ts.)
 *
 * Local only, and only "where am I in the flow" — the imported rows themselves
 * live in the server ledger.
 */
export type Awaiting = {
  id: ConnectorId;
  /** "collect" = the service is still preparing it (IMDb); "file" = go pick it. */
  stage: "collect" | "file";
  at: number;
};

export const AWAITING_KEY = "mt-import-awaiting";
/** Long enough to walk through an IMDb export, short enough not to nag forever. */
export const AWAITING_TTL = 60 * 60 * 1000;

export function readAwaiting(): Awaiting | null {
  try {
    const raw = localStorage.getItem(AWAITING_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Awaiting;
    if (!a?.id || !connector(a.id)) return null;
    if (!a.at || Date.now() - a.at > AWAITING_TTL) return null;
    return a;
  } catch {
    return null;
  }
}

export function writeAwaiting(a: Awaiting | null): void {
  try {
    if (a) localStorage.setItem(AWAITING_KEY, JSON.stringify(a));
    else localStorage.removeItem(AWAITING_KEY);
  } catch {
    /* private mode — the flow still works, it just won't remember */
  }
}
