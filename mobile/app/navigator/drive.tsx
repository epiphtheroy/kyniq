// The Navigator — cinephile turn-by-turn drive (HANDOFF-navigator §5.3).
// One destination, one next turn, the road ahead. The familiar Google-Maps driving
// shape with RN + react-native-svg (NO native map): a green maneuver card (next film),
// a pannable overworld MAP whose hero is the route, the "me" chevron, and a COLLAPSIBLE
// bottom sheet (peek: time remaining + N films + progress; expand: traveled/remaining
// meter + fewest/fastest/no-tolls switch + actions) so the map owns the screen.
//
// MAP v3 (ported from web components/room/NavigatorDrive.tsx): the ordered films are
// idealised into ONE clean, evenly-spaced, gently-flowing LANE — X = drive order, Y a
// smoothed echo of each film's real /odyssey band (missing slugs interpolated, the lane
// never breaks). One bright blue road; each film a poster node with a drive-order badge
// (red on "Now", gold on the 🏁 destination). The real lineages/stations the journey
// passes are hard-faded to grey context behind it. The lane length grows with the film
// count and the initial zoom adapts to journey size (short = intimate, long = frame the
// road ahead and pan forward). If the odyssey data isn't loaded — or no route film is on
// the plane — the original synthetic overworld is drawn instead (never breaks).
//
// A destination is a director conquest ({ dir }) or a canon list ({ lineage, label }).
// Position is ledger-derived server-side (invariant §10-1); marking the next film seen
// advances the chevron ("rerouting").
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, Share, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Ellipse, Path, Rect } from "react-native-svg";
import { Btn, Loading, PosterImg, Screen, Serif, Tactile, Ui } from "../../src/components/ui";
import { METATAKE_BASE } from "../../src/config";
import { t } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, motion, radius, shadow, sp, usePalette } from "../../src/theme";
import type {
  NavAvailability,
  NavDest,
  NavPref,
  NavStop,
  NavigatorPayload,
  OdyLineLite,
  OdyMapLite,
  OdyStationLite,
} from "../../src/types";

const DEFAULT_DIR = "stanley-kubrick";
const GOLD = "#8F6A1E";
const PREFS: NavPref[] = ["fewest", "fastest", "no_tolls"];
const MAXPAN = 130; // how far the road layer can be dragged from center

// The winding "overworld" route (viewBox 0-100) + the poster stops that stand at its
// nodes, near→far (nearer = larger, for depth). A Mario-style map you drive across —
// mirrors components/room/NavigatorDrive.tsx exactly. The map stays a bright daytime
// palette in BOTH light & dark (it's a stylized game map); cards/sheet stay theme-aware.
const ROUTE_D =
  "M11,80 C18,70 22,64 27,60 C34,55 40,68 45,72 C52,76 56,54 62,50 C68,46 74,56 78,60 C83,63 87,42 90,33";
const WAYPOINTS = [
  { top: 60, left: 27, w: 78 },
  { top: 72, left: 45, w: 62 },
  { top: 50, left: 62, w: 52 },
  { top: 60, left: 78, w: 44 },
];
const MAP_BASE = "#E8EEDA"; // daytime overworld base — identical in light & dark

// ── Map v3 — the odyssey hero-lane engine (ported from web NavigatorDrive.tsx) ──
// Lane geometry, in "lane units" that equal % of the map box: 100 units = one box
// width across, so nodes past 100 are reached by panning. Y units = % of box height.
const SP = 20; // even spacing between drive-order nodes
const X0 = 22; // first node's x (room for the "me" chevron on the left)
const AMP = 12; // gentle vertical undulation of the lane
const BLUE = "#3B7DED"; // the bright hero road
const BLUE_CASING = "#2B5FB0";
const RED = "#E3120B"; // "Now" ring + badge

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A smooth-through-points path (quadratic midpoints) for the flowing lane. */
function smoothD(pts: Array<{ x: number; y: number }>): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1) return `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  if (n === 2) return `M${r2(pts[0].x)} ${r2(pts[0].y)} L${r2(pts[1].x)} ${r2(pts[1].y)}`;
  let d = `M${r2(pts[0].x)} ${r2(pts[0].y)}`;
  for (let i = 1; i < n - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q${r2(pts[i].x)} ${r2(pts[i].y)} ${r2(mx)} ${r2(my)}`;
  }
  d += ` L${r2(pts[n - 1].x)} ${r2(pts[n - 1].y)}`;
  return d;
}

/** Linear-interpolate null entries by index (edges hold the nearest known value). */
function fillNulls(a: Array<number | null>): void {
  const n = a.length;
  let first = -1;
  for (let i = 0; i < n; i++)
    if (a[i] != null) {
      first = i;
      break;
    }
  if (first < 0) return;
  for (let i = 0; i < first; i++) a[i] = a[first];
  let lastK = first;
  for (let i = first + 1; i < n; i++) {
    if (a[i] != null) {
      const v0 = a[lastK] as number,
        v1 = a[i] as number;
      for (let j = lastK + 1; j < i; j++) a[j] = v0 + ((v1 - v0) * (j - lastK)) / (i - lastK);
      lastK = i;
    }
  }
  for (let i = lastK + 1; i < n; i++) a[i] = a[lastK];
}

/** Moving-average smoothing (window ±w) — flattens the lane's drift to a gentle flow. */
function smoothArr(a: number[], w: number): number[] {
  const n = a.length;
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let s = 0,
      c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      s += a[j];
      c++;
    }
    out[i] = s / c;
  }
  return out;
}

type ScenePt = { stop: NavStop; nx: number; ny: number; w: number; now: boolean; dest: boolean; missing: boolean };
type SceneCross = { id: string; name: string; d: string; lx: number; ly: number };
type SceneBgP = { key: string; nx: number; ny: number; p: string };
type SceneDot = { key: string; nx: number; ny: number };

// A background film in the explorable world: its real odyssey position mapped into
// the pannable layer's lane-unit space (wx,wy), kept for viewport culling on pan.
type WorldStation = { key: string; wx: number; wy: number; v: number; p?: string };
type World = {
  stations: WorldStation[];
  bounds: { WX0: number; WSPANX: number; WY0: number; WSPANY: number };
};

/**
 * Spread ALL off-route odyssey stations over a large world in the pannable layer's
 * lane-unit space, mapped linearly from each station's real (x, yy). The area is
 * several screens wide/tall so panning in any direction keeps surfacing new films
 * (Google-Maps feel). The hero route lane stays anchored on top; this is only the
 * faded, viewport-culled background world.
 */
function buildWorld(stations: OdyStationLite[], onRoute: Set<string>, L: number): World {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const s of stations) {
    if (typeof s.x !== "number" || typeof s.yy !== "number") continue;
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.yy < minY) minY = s.yy;
    if (s.yy > maxY) maxY = s.yy;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const WSPANX = clamp(L * 2.4, 380, 1400); // world width in lane units (≥ ~4 screens)
  const WSPANY = 260; // world height in lane units (~2.6 screens tall)
  const WX0 = (X0 + L) / 2 - WSPANX / 2; // centre the world on the lane's middle
  const WY0 = 50 - WSPANY / 2;
  const out: WorldStation[] = [];
  for (const s of stations) {
    if (onRoute.has(s.s)) continue;
    if (typeof s.x !== "number" || typeof s.yy !== "number") continue;
    const nx = (s.x - minX) / spanX;
    const ny = (s.yy - minY) / spanY;
    out.push({ key: s.s, wx: WX0 + nx * WSPANX, wy: WY0 + ny * WSPANY, v: s.v ?? 0, p: s.p });
  }
  return { stations: out, bounds: { WX0, WSPANX, WY0, WSPANY } };
}
type Scene = {
  L: number; // total lane length, in lane units (= % of box width)
  routePts: ScenePt[];
  routeD: string;
  cross: SceneCross[];
  me: { nx: number; ny: number };
  missingCount: number;
};

/**
 * Lay the journey out as the hero lane (verbatim port of the web buildScene):
 *  1. ordered stops → evenly-spaced nodes on a gently-flowing centreline. x is pure
 *     drive order; y drifts with a smoothed, idealised echo of each film's real
 *     odyssey band. Films absent from the map keep their sequence place (band
 *     interpolated) — the lane never breaks.
 *  2. the real lineages the journey passes become faded grey cross-streets — soft
 *     context only. (The explorable background world of stations is culled separately.)
 *  3. the lane length grows with the film count (a long road you pan to follow).
 * Returns null when NO stop is on the map (caller draws the synthetic fallback).
 */
function buildScene(map: OdyMapLite, stops: NavStop[]): Scene | null {
  const N = stops.length;
  if (!N) return null;
  const byId = new Map<string, OdyStationLite>(map.stations.map((s) => [s.s, s]));

  const yReal: Array<number | null> = stops.map((s) => byId.get(s.slug)?.yy ?? null);
  const missing = stops.map((s) => !byId.has(s.slug));
  const knownCount = missing.filter((m) => !m).length;
  if (!knownCount) return null;
  fillNulls(yReal);
  let mn = Infinity,
    mx = -Infinity;
  for (const v of yReal)
    if (v != null) {
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
  const span = mx - mn;
  const norm = yReal.map((v) => (span > 1 && v != null ? ((v - mn) / span) * 2 - 1 : 0));
  const drift = smoothArr(norm, 2);

  // the hero lane — evenly-spaced nodes on a gently flowing centreline
  const nodes = stops.map((stop, i) => ({
    stop,
    i,
    lx: X0 + i * SP,
    ly: clamp(50 + AMP * (0.55 * Math.sin(i * 0.7 + 0.6) + 0.45 * drift[i]), 30, 70),
  }));
  const L = Math.max(150, X0 + (N - 1) * SP + 40);
  const last = N - 1;
  const routePts: ScenePt[] = nodes.map((n) => ({
    stop: n.stop,
    nx: n.lx,
    ny: n.ly,
    w: clamp(58 - n.i * 2.5, 40, 58),
    now: n.i === 0,
    dest: n.i === last,
    missing: missing[n.i],
  }));
  const routeD = smoothD(nodes.map((n) => ({ x: n.lx, y: n.ly })));
  const meMarker = { nx: X0 - SP * 0.55, ny: nodes[0].ly };

  // ambient cross-streets — the real lineages this journey passes, hard-faded,
  // spread across the whole lane so panning keeps revealing context
  const lineById = new Map<string, OdyLineLite>(map.lines.map((l) => [l.id, l]));
  const touched: string[] = [];
  const seenL = new Set<string>();
  for (const s of stops) {
    const st = byId.get(s.slug);
    for (const id of st?.ln ?? []) if (!seenL.has(id)) { seenL.add(id); touched.push(id); }
  }
  const lineIds = touched.slice(0, 6);
  for (const l of map.lines) {
    if (lineIds.length >= 4) break;
    if (!seenL.has(l.id)) { seenL.add(l.id); lineIds.push(l.id); }
  }
  const cross: SceneCross[] = lineIds.map((id, idx) => {
    const cx = X0 + ((idx + 0.5) * (L - X0)) / Math.max(1, lineIds.length);
    return {
      id,
      name: lineById.get(id)?.name_en ?? "Lineage",
      d: `M${r2(cx)} 3 C${r2(cx + 6)} 30 ${r2(cx - 6)} 70 ${r2(cx)} 97`,
      lx: clamp(cx, 6, L - 4),
      ly: idx % 2 ? 12 : 88,
    };
  });

  return { L, routePts, routeD, cross, me: meMarker, missingCount: N - knownCount };
}

/**
 * Adaptive default view (mobile equivalent of the web computeDefaultView). Zoom scales
 * INVERSELY with film count: a short journey zooms in (intimate), a long one holds a
 * comfortable zoom and frames the road ahead so you pan forward. Returns a screen-space
 * pan translate (tx,ty) + scale k for the pan/zoom layer (origin = box centre).
 */
function computeDefaultView(n: number, w: number, h: number): { tx: number; ty: number; k: number } {
  if (!w || !h) return { tx: 0, ty: 0, k: 1 };
  const k = clamp(2.0 - n * 0.16, 0.92, 1.85);
  const visSpan = 100 / k; // % of lane width shown across the viewport
  const frameLx = X0 - SP * 0.55 + visSpan * 0.3;
  return { tx: k * w * (0.5 - frameLx / 100), ty: 0, k };
}

/** Duration — locale-aware long form via the dict (e.g. "11h 53m"). */
function fmtDur(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? t("nav.durHM", { h, m }) : t("nav.durMin", { m });
}
/** Compact meter form ("9:52"). */
function fmtHM(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function availLabel(a: NavAvailability, leavingSoon: boolean): string {
  if (leavingSoon) return t("nav.leavingSoon");
  if (a === "sub") return t("nav.playNow");
  if (a === "rent") return t("nav.rent");
  return t("nav.notOnServices");
}
function availDot(a: NavAvailability): string {
  if (a === "sub") return "#84F3BC";
  if (a === "rent") return "#F0C674";
  return "rgba(255,255,255,0.5)";
}

/** Floating chrome disc (matches the director screen's back/share affordance). */
function Disc({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8}>
      <View
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            backgroundColor: pal.chrome,
            alignItems: "center",
            justifyContent: "center",
          },
          shadow.card,
        ]}
      >
        <Ionicons name={icon} size={20} color={pal.ink} />
      </View>
    </Tactile>
  );
}

export default function NavigatorDriveScreen() {
  const params = useLocalSearchParams<{ dir?: string; lineage?: string; label?: string }>();
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { country } = usePrefs();
  const { session, markSeen } = useFilms();

  const [dest, setDest] = useState<NavDest | null>(() => {
    if (params.lineage) return { lineage: params.lineage, label: params.label };
    if (params.dir) return { dir: params.dir };
    return null;
  });
  const [data, setData] = useState<NavigatorPayload | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0); // refetch bump (reroute after a judgment)
  const [pref, setPref] = useState<NavPref>("fewest");
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
  const [sheetOpen, setSheetOpen] = useState(false); // peek by default; tap to expand
  const [pick, setPick] = useState<NavStop | null>(null); // map poster → info card
  const [ody, setOdy] = useState<OdyMapLite | null>(null); // the odyssey plane (map v3)
  const [k, setK] = useState(1); // adaptive map scale (short journey = zoomed in)
  const [viewCenter, setViewCenter] = useState({ cx: 50, cy: 50 }); // pan centre, lane units → background culling
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draggable + adaptively-zoomed map layer. PanResponder claims only on a real drag
  // (poster taps pass through); the offset is clamped to the whole explorable world and
  // the scale k adapts to journey size. Both live in refs the framing effect populates,
  // so the responder itself never needs re-creating. During the drag we also update the
  // cull centre (quantised to a cell so setState stays cheap) → background swaps in.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panBase = useRef({ x: 0, y: 0 }); // committed offset (screen px)
  const clampRef = useRef({ loX: -MAXPAN, hiX: MAXPAN, loY: -MAXPAN, hiY: MAXPAN });
  const defaultRef = useRef({ tx: 0, ty: 0, k: 1 });
  const frameRef = useRef({ w: 0, h: 0, k: 1 }); // box + scale, read inside the responder
  const cellRef = useRef({ qx: 9999, qy: 9999 }); // last quantised cull cell
  const CELL = 22; // cull-centre quantum, in lane units
  const pushCenter = useCallback((px: number, py: number) => {
    const { w, h, k: kk } = frameRef.current;
    if (!w || !h) return;
    const cx = 50 - (100 * px) / (kk * w);
    const cy = 50 - (100 * py) / (kk * h);
    const qx = Math.round(cx / CELL),
      qy = Math.round(cy / CELL);
    if (qx !== cellRef.current.qx || qy !== cellRef.current.qy) {
      cellRef.current = { qx, qy };
      setViewCenter({ cx, cy });
    }
  }, []);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 || Math.abs(g.dy) > 8,
        onPanResponderMove: (_e, g) => {
          const c = clampRef.current;
          const nx = clamp(panBase.current.x + g.dx, c.loX, c.hiX);
          const ny = clamp(panBase.current.y + g.dy, c.loY, c.hiY);
          pan.setValue({ x: nx, y: ny });
          pushCenter(nx, ny); // reveal films in the direction of travel
        },
        onPanResponderRelease: (_e, g) => {
          const c = clampRef.current;
          const nx = clamp(panBase.current.x + g.dx, c.loX, c.hiX);
          const ny = clamp(panBase.current.y + g.dy, c.loY, c.hiY);
          panBase.current = { x: nx, y: ny };
          pushCenter(nx, ny);
        },
      }),
    [pan, pushCenter],
  );
  // ◎ recenter — snap the map back to its adaptive default frame.
  const recenter = useCallback(() => {
    const d = defaultRef.current;
    panBase.current = { x: d.tx, y: d.ty };
    Animated.spring(pan, {
      toValue: { x: d.tx, y: d.ty },
      useNativeDriver: false,
      damping: motion.spring.damping,
      stiffness: motion.spring.stiffness,
      mass: motion.spring.mass,
    }).start();
    cellRef.current = { qx: 9999, qy: 9999 };
    pushCenter(d.tx, d.ty);
  }, [pan, pushCenter]);

  // Resolve the destination when opened without params (deep link): the director the
  // user is mid-conquest on, else the canon default (§3 v1). With params the picker
  // already chose (director or canon), so this only runs for a bare /navigator/drive.
  useEffect(() => {
    if (dest) return;
    let alive = true;
    (async () => {
      const d = session ? await me.midConquestDirector().catch(() => null) : null;
      if (alive) setDest({ dir: d ?? DEFAULT_DIR });
    })();
    return () => {
      alive = false;
    };
  }, [dest, session]);

  // Load the odyssey plane once (public static JSON on the web origin), cached in state.
  // Silent-catch: a miss keeps the synthetic overworld — the drive never breaks (map v3).
  useEffect(() => {
    let live = true;
    api
      .odysseyMap()
      .then((m) => {
        if (live) setOdy(m);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Fetch the drive.
  useEffect(() => {
    if (!dest) return;
    let alive = true;
    setData(null);
    setErr(false);
    api
      .navigator(dest, country)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setPref(d.defaultPref);
        setSkipped(new Set());
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [dest, country, gen]);

  // Persist the active drive so the picker can offer "Resume" (§10-1: we store only
  // WHICH destination + pref — position stays ledger-derived). There IS a next turn →
  // me_nav_start; arrived (no next) → me_nav_arrive. Descriptor comes from the resolved
  // destination (dest), which the picker/deep-link set. Fire-and-forget: a failed
  // resume write must never block or break the drive.
  useEffect(() => {
    if (!session || !data || !dest) return;
    const dest_kind = dest.lineage ? "lineage" : "dir";
    const dest_key = dest.lineage ?? dest.dir;
    if (!dest_key) return;
    const dest_label = dest.label ?? data.label;
    const hasNext = !!data.routes[pref]?.next;
    (async () => {
      try {
        if (hasNext) await me.navStart({ dest_kind, dest_key, dest_label, route_pref: pref });
        else await me.navArrive({ dest_kind, dest_key });
      } catch {
        /* resume is best-effort */
      }
    })();
  }, [session, data, dest, pref]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // The active route for the selected pref, with locally-skipped turns pushed to
  // the rear (§4.4 — skip is a re-order, never a deletion or a penalty).
  const view = useMemo(() => {
    if (!data) return null;
    const base = data.routes[pref];
    const active = base.stops.filter((s) => !skipped.has(s.slug));
    const rear = base.stops.filter((s) => skipped.has(s.slug));
    const stops = [...active, ...rear];
    const reasonFor = (slug: string): string =>
      base.next?.slug === slug ? base.next.reason : base.then?.slug === slug ? base.then.reason : "";
    return { base, stops, reasonFor };
  }, [data, pref, skipped]);

  // ── Map v3: idealise the route into the hero lane over the odyssey plane. Null when
  //    the plane hasn't loaded or no route film is on it → the synthetic overworld. ──
  const scene = useMemo(() => (ody && view ? buildScene(ody, view.stops) : null), [ody, view]);
  const defaultView = useMemo(
    () => (scene ? computeDefaultView(scene.routePts.length, mapBox.w, mapBox.h) : null),
    [scene, mapBox.w, mapBox.h],
  );
  // The explorable background world — all off-route stations spread over a large area.
  const world = useMemo(
    () => (ody && scene && view ? buildWorld(ody.stations, new Set(view.stops.map((s) => s.slug)), scene.L) : null),
    [ody, scene, view],
  );
  // Viewport culling — only the stations inside the current window + margin, capped and
  // TakeScore-prioritised, split into a few faded posters + faint dots. As the cull
  // centre (viewCenter) moves with the pan, this set swaps → new films keep appearing.
  const bg = useMemo(() => {
    const empty = { posters: [] as SceneBgP[], dots: [] as SceneDot[] };
    if (!world) return empty;
    const hx = 50 / k + 26; // half visible lane-x span + margin
    const hy = 50 / k + 26;
    const inWin: WorldStation[] = [];
    for (const s of world.stations) {
      if (Math.abs(s.wx - viewCenter.cx) < hx && Math.abs(s.wy - viewCenter.cy) < hy) inWin.push(s);
    }
    inWin.sort((a, b) => b.v - a.v); // prioritise higher TakeScore when over the cap
    const capped = inWin.slice(0, 230);
    const posters: SceneBgP[] = [];
    const dots: SceneDot[] = [];
    for (const s of capped) {
      if (posters.length < 16 && s.p) posters.push({ key: s.key, nx: s.wx, ny: s.wy, p: s.p });
      else dots.push({ key: s.key, nx: s.wx, ny: s.wy });
    }
    return { posters, dots };
  }, [world, viewCenter, k]);

  // Re-frame when the journey (or box) changes: adaptive scale + a pan clamp that spans
  // the whole explorable world (pan any direction to reveal more). Not on plain drags.
  useEffect(() => {
    if (!mapBox.w || !mapBox.h) return;
    const w = mapBox.w,
      h = mapBox.h;
    if (scene && defaultView && world) {
      const kk = defaultView.k;
      const baseX = (X: number) => w / 2 + kk * ((X / 100) * w - w / 2);
      const baseY = (Y: number) => h / 2 + kk * ((Y / 100) * h - h / 2);
      const { WX0, WSPANX, WY0, WSPANY } = world.bounds;
      const maxPanX = 0.2 * w - baseX(WX0); // world left edge reachable near left
      const minPanX = 0.8 * w - baseX(WX0 + WSPANX); // world right edge near right
      const maxPanY = 0.2 * h - baseY(WY0);
      const minPanY = 0.8 * h - baseY(WY0 + WSPANY);
      const loX = Math.min(minPanX, maxPanX),
        hiX = Math.max(minPanX, maxPanX);
      const loY = Math.min(minPanY, maxPanY),
        hiY = Math.max(minPanY, maxPanY);
      const tx = clamp(defaultView.tx, loX, hiX);
      const ty = clamp(defaultView.ty, loY, hiY);
      clampRef.current = { loX, hiX, loY, hiY };
      defaultRef.current = { tx, ty, k: kk };
      frameRef.current = { w, h, k: kk };
      panBase.current = { x: tx, y: ty };
      cellRef.current = { qx: 9999, qy: 9999 };
      setK(kk);
      pan.setValue({ x: tx, y: ty });
      setViewCenter({ cx: 50 - (100 * tx) / (kk * w), cy: 50 - (100 * ty) / (kk * h) });
    } else {
      // synthetic fallback overworld — unit scale, soft box clamp around centre
      clampRef.current = { loX: -MAXPAN, hiX: MAXPAN, loY: -MAXPAN, hiY: MAXPAN };
      defaultRef.current = { tx: 0, ty: 0, k: 1 };
      frameRef.current = { w, h, k: 1 };
      panBase.current = { x: 0, y: 0 };
      setK(1);
      pan.setValue({ x: 0, y: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, defaultView, world, mapBox.w, mapBox.h]);

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapBox({ w: width, h: height });
  };

  const onMarkSeen = useCallback(
    async (slug: string) => {
      if (!session) {
        router.push({ pathname: "/onboarding", params: { step: "account" } });
        return;
      }
      const token = await markSeen(slug);
      if (token) {
        showToast(t("nav.rerouting"));
        setGen((g) => g + 1); // reroute: refetch → chevron advances
      }
    },
    [session, markSeen, router, showToast],
  );

  const onSkip = useCallback((slug: string) => {
    setSkipped((prev) => new Set(prev).add(slug));
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/navigator"));

  // ── loading / error ─────────────────────────────────────────────────────
  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ui size={fs.md} color={pal.muted} style={{ textAlign: "center" }}>
          {t("error.network")}
        </Ui>
        <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} style={{ alignSelf: "stretch" }} />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={back} />
        </View>
      </Screen>
    );
  if (!data || !view)
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Loading />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={back} />
        </View>
      </Screen>
    );

  const arrived = data.remaining === 0 || view.stops.length === 0;
  const head = view.stops[0] ?? null; // the next turn (a NavStop)
  const then = view.stops[1] ?? null;
  const webUrl = `${METATAKE_BASE}/navigator-preview.html`;

  // traveled fraction for the meter
  const trav = data.runtimeTraveled ?? 0;
  const rem = data.runtimeRemaining ?? 0;
  const doneFrac = trav + rem > 0 ? trav / (trav + rem) : arrived ? 1 : 0;

  // ── overworld poster stops: the nearest few stand at the route's nodes (near→far,
  //    nearer = larger for depth), plus the flagged destination if it isn't among them ──
  const near = view.stops.slice(0, WAYPOINTS.length);
  const finalStop = view.stops[view.stops.length - 1] ?? null;
  const destIsNear = !!finalStop && near.some((s) => s.slug === finalStop.slug);
  // Road-name signs (decorative flavor + the current road = destination). Percent of box.
  const roadName = data.label;
  const signs = [
    { left: 12, top: 91, label: roadName, cur: true },
    { left: 31, top: 40, label: "Noir Line →", cur: false },
    { left: 55, top: 27, label: "New Wave Way", cur: false },
    { left: 73, top: 88, label: "Neorealism Rd", cur: false },
    { left: 89, top: 17, label: "Formalist Blvd", cur: false },
  ];

  // Route-node viewport culling (mirrors web inWin/inDotBand). Only stops inside the
  // visible lane window + a one-screen buffer mount as full poster nodes; a wider band
  // renders lightweight numbered dots; the rest render nothing (the SVG lane still draws
  // the road end-to-end). "Now" (stop 0) and the 🏁 destination ALWAYS render as full
  // posters regardless of window. Derived from the same pan centre (viewCenter, lane
  // units) + scale k the background cull uses — so panning the lane continuously reveals
  // each film's poster and a 1000-stop route never mounts 1000 images.
  const rnFullHalf = 50 / k + 100 / k; // visible half-span + one-screen buffer
  const rnDotHalf = rnFullHalf * 2.2; // wider band → dots (web winPad = 0.6·window width)

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ═══════════ GREEN MANEUVER CARD (the next turn) ═══════════ */}
      <View style={{ paddingTop: insets.top + 48, paddingHorizontal: sp.s2 }}>
        {arrived || !head ? (
          <LinearGradient
            colors={[brand.success, "#0B6B3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: sp.s4, ...shadow.card }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
              <Ionicons name="flag" size={28} color="#fff" />
              <View style={{ flex: 1 }}>
                <Serif size={fs.lg} bold color="#fff">
                  {t("nav.arrived")}
                </Serif>
                <Ui size={fs.sm} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }}>
                  {t("nav.arrivedSub", { label: data.label, n: data.seenCount })}
                </Ui>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={[brand.success, "#0B6B3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, overflow: "hidden", ...shadow.card }}
          >
            <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: head.slug } })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, padding: sp.s3 }}>
                <View style={{ width: 40, alignItems: "center" }}>
                  <Ionicons name="return-up-forward" size={30} color="#fff" />
                  <Ui size={fs.xs - 1} weight="700" color="rgba(255,255,255,0.9)" style={{ marginTop: 1 }}>
                    {t("nav.next")}
                  </Ui>
                </View>
                <View style={{ borderRadius: radius.xs, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }}>
                  <PosterImg path={head.poster_path} width={46} height={68} size="w185" rounded={radius.xs - 2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Serif size={fs.lg} bold color="#fff" numberOfLines={1}>
                    {head.title}
                  </Serif>
                  <Ui size={fs.sm} color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ marginTop: 1 }}>
                    {[head.year, head.runtime ? fmtDur(head.runtime) : null].filter(Boolean).join(" · ")}
                  </Ui>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: 6,
                      marginTop: 6,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.28)",
                      borderRadius: radius.pill,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: availDot(head.availability) }} />
                    <Ui size={fs.xs} weight="600" color="#fff">
                      {availLabel(head.availability, false)}
                    </Ui>
                  </View>
                </View>
              </View>
            </Tactile>
            {view.reasonFor(head.slug) ? (
              <View style={{ paddingHorizontal: sp.s4, paddingBottom: 8, marginTop: -2 }}>
                <Ui size={fs.xs} color="rgba(255,255,255,0.82)" numberOfLines={1}>
                  {view.reasonFor(head.slug)}
                </Ui>
              </View>
            ) : null}
            {then ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: sp.s4,
                  paddingVertical: 8,
                  backgroundColor: "rgba(0,0,0,0.14)",
                }}
              >
                <Ionicons name="arrow-up" size={13} color="rgba(255,255,255,0.7)" />
                <Ui size={fs.xs} color="rgba(255,255,255,0.7)">
                  {t("nav.then")}
                </Ui>
                <Ui size={fs.xs} weight="700" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
                  {then.title}
                  {then.runtime ? ` · ${fmtDur(then.runtime)}` : ""}
                </Ui>
              </View>
            ) : null}
          </LinearGradient>
        )}
      </View>

      {/* ═══════════ OVERWORLD MAP — an SVG world you drive across (pannable) ═══════════ */}
      <View style={{ flex: 1, overflow: "hidden", backgroundColor: MAP_BASE }} onLayout={onMapLayout}>
        {mapBox.w > 0 && mapBox.h > 0 ? (
          <>
            <Animated.View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                transform: [...pan.getTranslateTransform(), { scale: k }],
              }}
              {...panResponder.panHandlers}
            >
              {scene ? (
                /* ── Map v3 — the odyssey hero lane over the explorable faded world ── */
                <>
                  {/* back layer — soft terrain + faded lineage cross-streets (viewBox 0..L) */}
                  <Svg
                    width={(scene.L / 100) * mapBox.w}
                    height={mapBox.h}
                    viewBox={`0 0 ${scene.L} 100`}
                    preserveAspectRatio="none"
                    style={{ position: "absolute", top: 0, left: 0 }}
                  >
                    <Rect x={-10} y={-10} width={scene.L + 20} height={120} fill="#DCE9C2" opacity={0.5} />
                    <Rect x={-10} y={2} width={scene.L + 20} height={22} fill="#CFE0A8" opacity={0.3} />
                    <Rect x={-10} y={76} width={scene.L + 20} height={24} fill="#CFE0A8" opacity={0.3} />
                    <Rect x={-10} y={34} width={scene.L + 20} height={32} fill="#E9E1C6" opacity={0.5} />
                    {scene.cross.map((c) => (
                      <Path
                        key={c.id}
                        d={c.d}
                        fill="none"
                        stroke="#C3B89E"
                        strokeWidth={6}
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                        opacity={0.66}
                      />
                    ))}
                  </Svg>

                  {/* the faded background WORLD — viewport-culled dots + a few desaturated
                      posters; panning any direction swaps this set → more films appear */}
                  {bg.dots.map((d) => (
                    <View
                      key={d.key}
                      style={{
                        position: "absolute",
                        left: (d.nx / 100) * mapBox.w - 2.5,
                        top: (d.ny / 100) * mapBox.h - 2.5,
                        width: 5,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: "#b2a88f",
                        opacity: 0.4,
                      }}
                    />
                  ))}
                  {bg.posters.map((bp) => (
                    <View
                      key={bp.key}
                      style={{
                        position: "absolute",
                        left: (bp.nx / 100) * mapBox.w - 9,
                        top: (bp.ny / 100) * mapBox.h - 13,
                        opacity: 0.34,
                      }}
                    >
                      <PosterImg path={bp.p} width={18} height={27} size="w92" rounded={3} />
                    </View>
                  ))}

                  {/* THE journey — one bold, bright, evenly-flowing lane (casing → blue → dash) */}
                  <Svg
                    width={(scene.L / 100) * mapBox.w}
                    height={mapBox.h}
                    viewBox={`0 0 ${scene.L} 100`}
                    preserveAspectRatio="none"
                    style={{ position: "absolute", top: 0, left: 0 }}
                  >
                    <Path d={scene.routeD} fill="none" stroke={BLUE_CASING} strokeWidth={14} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d={scene.routeD} fill="none" stroke={BLUE} strokeWidth={10} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d={scene.routeD} fill="none" stroke="#ffffff" strokeWidth={1.8} strokeDasharray="2.4 3.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                  </Svg>

                  {/* faded lineage road-name signs */}
                  {scene.cross.map((c) => (
                    <View
                      key={c.id}
                      style={{
                        position: "absolute",
                        left: (c.lx / 100) * mapBox.w,
                        top: (c.ly / 100) * mapBox.h,
                        transform: [{ translateX: -32 }, { translateY: -8 }],
                        maxWidth: 120,
                        backgroundColor: "rgba(156,146,124,0.82)",
                        borderRadius: 6,
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                      }}
                    >
                      <Ui size={fs.xs - 3} weight="700" color="#fff" numberOfLines={1}>
                        {c.name}
                      </Ui>
                    </View>
                  ))}
                  {/* the current road = destination */}
                  <View
                    style={{
                      position: "absolute",
                      left: (scene.me.nx / 100) * mapBox.w,
                      top: (clamp(scene.me.ny + 10, 6, 94) / 100) * mapBox.h,
                      transform: [{ translateX: -30 }, { translateY: -9 }],
                      maxWidth: 160,
                      backgroundColor: "rgba(74,70,64,0.94)",
                      borderRadius: 6,
                      paddingHorizontal: 9,
                      paddingVertical: 2,
                    }}
                  >
                    <Ui size={fs.xs - 1} weight="700" color="#fff" numberOfLines={1}>
                      {roadName}
                    </Ui>
                  </View>

                  {/* the route's films — poster nodes in drive order, VIEWPORT-CULLED:
                      full posters inside the visible window + one-screen buffer (Now & the
                      destination always), lightweight numbered dots in a wider band, nothing
                      far off (the SVG lane still shows the road end-to-end). Caption under
                      every full node = title · year · TakeScore. */}
                  {scene.routePts.map((rp, i) => {
                    const dx = Math.abs(rp.nx - viewCenter.cx);
                    const dy = Math.abs(rp.ny - viewCenter.cy);
                    const full = rp.now || rp.dest || (dx <= rnFullHalf && dy <= rnFullHalf);
                    if (!full) {
                      // out of the poster window → a lightweight numbered dot on the lane
                      // (only within the wider dot band; beyond it renders nothing).
                      if (dx > rnDotHalf || dy > rnDotHalf) return null;
                      return (
                        <View
                          key={rp.stop.slug}
                          style={{
                            position: "absolute",
                            left: (rp.nx / 100) * mapBox.w - 8,
                            top: (rp.ny / 100) * mapBox.h - 8,
                            minWidth: 16,
                            height: 16,
                            paddingHorizontal: 4,
                            borderRadius: radius.pill,
                            backgroundColor: BLUE,
                            borderWidth: 1.5,
                            borderColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                            ...shadow.card,
                          }}
                        >
                          <Ui size={fs.xs - 3} weight="700" color="#fff">
                            {i + 1}
                          </Ui>
                        </View>
                      );
                    }
                    const ph = Math.round(rp.w * 1.5);
                    const badgeBg = rp.now ? RED : rp.dest ? GOLD : BLUE;
                    const yr = rp.stop.year != null ? String(rp.stop.year) : null;
                    const ts =
                      rp.stop.takescore != null ? `${Math.round(rp.stop.takescore)} ${t("nav.takescore")}` : null;
                    const meta = [yr, ts].filter(Boolean).join(" · ");
                    return (
                      <View
                        key={rp.stop.slug}
                        style={{
                          position: "absolute",
                          left: (rp.nx / 100) * mapBox.w - rp.w / 2,
                          top: (rp.ny / 100) * mapBox.h - ph,
                          width: rp.w,
                          alignItems: "center",
                        }}
                      >
                        <Tactile onPress={() => setPick(rp.stop)}>
                          <View
                            style={{
                              borderRadius: 6,
                              overflow: "hidden",
                              borderWidth: 2,
                              borderColor: rp.now ? RED : rp.dest ? GOLD : "#fff",
                              ...shadow.card,
                            }}
                          >
                            <PosterImg path={rp.stop.poster_path} width={rp.w} height={ph} size="w185" rounded={4} />
                          </View>
                        </Tactile>
                        {/* signpost pole */}
                        <View style={{ width: 2.5, height: 12, backgroundColor: "#b7ad96" }} />
                        {/* caption — title, then year · TakeScore (two lines) under every node */}
                        <View
                          style={{
                            marginTop: 3,
                            backgroundColor: rp.now ? RED : rp.dest ? GOLD : "rgba(255,255,255,0.94)",
                            borderRadius: 9,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            maxWidth: rp.w + 52,
                            alignItems: "center",
                          }}
                        >
                          <Ui
                            size={fs.xs - 2}
                            weight="700"
                            color={rp.now || rp.dest ? "#fff" : "#4A4638"}
                            numberOfLines={2}
                            style={{ textAlign: "center", lineHeight: 12 }}
                          >
                            {rp.now ? `${t("nav.now")} · ${rp.stop.title}` : rp.stop.title}
                          </Ui>
                          {meta ? (
                            <Ui
                              size={fs.xs - 3}
                              weight="600"
                              color={rp.now || rp.dest ? "rgba(255,255,255,0.9)" : "#7A745F"}
                              numberOfLines={1}
                              style={{ marginTop: 1 }}
                            >
                              {meta}
                            </Ui>
                          ) : null}
                        </View>
                        {/* drive-order badge (absolute — anchored to the poster's top-left) */}
                        <View
                          style={{
                            position: "absolute",
                            left: -7,
                            top: -7,
                            minWidth: 17,
                            height: 17,
                            paddingHorizontal: 4,
                            borderRadius: radius.pill,
                            backgroundColor: badgeBg,
                            borderWidth: 1.5,
                            borderColor: "#fff",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ui size={fs.xs - 2} weight="700" color="#fff">
                            {i + 1}
                          </Ui>
                        </View>
                        {/* 🏁 flag over the destination (absolute — keeps poster anchoring uniform) */}
                        {rp.dest ? (
                          <View style={{ position: "absolute", top: -20, left: 0, right: 0, alignItems: "center" }}>
                            <Ui size={fs.md}>🏁</Ui>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}

                  {/* "me" — the chevron just before the next film */}
                  <View
                    style={{
                      position: "absolute",
                      left: (scene.me.nx / 100) * mapBox.w - 15,
                      top: (scene.me.ny / 100) * mapBox.h - 16,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 0,
                        height: 0,
                        borderLeftWidth: 13,
                        borderRightWidth: 13,
                        borderBottomWidth: 22,
                        borderLeftColor: "transparent",
                        borderRightColor: "transparent",
                        borderBottomColor: RED,
                      }}
                    />
                    <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: RED, borderWidth: 2.5, borderColor: "#fff", marginTop: -3 }} />
                    {data.seenCount > 0 ? (
                      <View style={{ marginTop: 4, backgroundColor: "rgba(255,255,255,0.82)", borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 }}>
                        <Ui size={fs.xs - 3} weight="700" color="#8a806c">
                          ↓ {t("nav.behindN", { n: data.seenCount })}
                        </Ui>
                      </View>
                    ) : null}
                  </View>
                </>
              ) : (
              <>
              {/* the world — terrain, cross-roads (other lineages), then THE route.
                  viewBox 0-100 stretched to fill the box; non-scaling strokes keep the
                  road widths constant. A bright daytime overworld in both light & dark. */}
              <Svg
                width={mapBox.w}
                height={mapBox.h}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                <Rect x={0} y={0} width={100} height={100} fill={MAP_BASE} />
                {/* world regions — grass · sand · water */}
                <Ellipse cx={20} cy={26} rx={28} ry={19} fill="#D9E6BE" opacity={0.65} />
                <Ellipse cx={84} cy={74} rx={26} ry={17} fill="#D7E4B8" opacity={0.6} />
                <Ellipse cx={16} cy={86} rx={20} ry={13} fill="#EBDCB4" opacity={0.6} />
                <Path d="M62,-6 C76,6 71,21 86,27 C99,32 110,23 114,31 L114,-8 Z" fill="#CFE2EA" opacity={0.6} />
                {/* other roads you pass — each a lineage/route */}
                <Path d="M-6,42 C18,36 34,51 54,43 C74,35 92,47 108,39" fill="none" stroke="#D6CDB2" strokeWidth={4.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={0.85} />
                <Path d="M41,-6 C37,18 47,33 39,53 C32,71 43,87 37,108" fill="none" stroke="#D6CDB2" strokeWidth={4} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={0.8} />
                <Path d="M-6,90 C22,82 41,93 63,85 C83,78 97,87 108,81" fill="none" stroke="#D6CDB2" strokeWidth={3.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" opacity={0.7} />
                {/* THE route — the films you'll drive, winding across the world (4 stacked) */}
                <Path d={ROUTE_D} fill="none" stroke="#D8D0BC" strokeWidth={12} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={ROUTE_D} fill="none" stroke="#ffffff" strokeWidth={9} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={ROUTE_D} fill="none" stroke="#3B7DED" strokeWidth={6} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={ROUTE_D} fill="none" stroke="#ffffffcc" strokeWidth={1.3} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
              </Svg>

              {/* road-name signs — small labels pinned across the map (the current road = destination) */}
              {signs.map((s) => (
                <View
                  key={`${s.label}-${s.left}`}
                  style={{
                    position: "absolute",
                    left: mapBox.w * (s.left / 100),
                    top: mapBox.h * (s.top / 100),
                    transform: [{ translateX: -32 }, { translateY: -9 }],
                    maxWidth: 130,
                    backgroundColor: s.cur ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)",
                    borderRadius: radius.pill,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Ui size={fs.xs - 2} weight={s.cur ? "700" : "600"} color={s.cur ? "#4A4638" : "#7A745F"} numberOfLines={1}>
                    {s.label}
                  </Ui>
                </View>
              ))}

              {/* poster stops standing at the route nodes (near→far). Tap → info card.
                  The PanResponder only claims on a real drag (dx/dy > 8), so a poster
                  tap passes through to the Tactile below and never starts a pan. */}
              {near.map((stop, i) => {
                const wp = WAYPOINTS[i];
                const w = wp.w;
                const h = Math.round(w * 1.5);
                const isNow = i === 0;
                const isDest = destIsNear && finalStop != null && stop.slug === finalStop.slug;
                return (
                  <View
                    key={stop.slug}
                    style={{
                      position: "absolute",
                      left: mapBox.w * (wp.left / 100) - w / 2,
                      bottom: mapBox.h * (1 - wp.top / 100),
                      width: w,
                      alignItems: "center",
                    }}
                  >
                    {isNow ? (
                      <View style={{ backgroundColor: brand.accent, borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, marginBottom: 3 }}>
                        <Ui size={fs.xs - 2} weight="700" color="#fff" numberOfLines={1}>
                          {t("nav.next")}
                        </Ui>
                      </View>
                    ) : wp.w >= 60 ? (
                      <View style={{ backgroundColor: "rgba(255,255,255,0.85)", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1, marginBottom: 3, maxWidth: w + 24 }}>
                        <Ui size={fs.xs - 2} weight="600" color="#4A4638" numberOfLines={1}>
                          {stop.title}
                        </Ui>
                      </View>
                    ) : null}
                    <Tactile onPress={() => setPick(stop)}>
                      <View
                        style={{
                          borderRadius: 6,
                          overflow: "hidden",
                          borderWidth: 2,
                          borderColor: isNow ? brand.accent : isDest ? GOLD : "#fff",
                          ...shadow.card,
                        }}
                      >
                        <PosterImg path={stop.poster_path} width={w} height={h} size="w185" rounded={4} />
                      </View>
                    </Tactile>
                    {/* signpost pole standing on the road */}
                    <View style={{ width: 2.5, height: 11, backgroundColor: "#b7ad96" }} />
                  </View>
                );
              })}

              {/* the flagged destination (🏁) — only when it isn't already among the near stops */}
              {!destIsNear && finalStop ? (
                <View
                  style={{
                    position: "absolute",
                    left: mapBox.w * 0.9 - 15,
                    bottom: mapBox.h * (1 - 0.33),
                    width: 30,
                    alignItems: "center",
                  }}
                >
                  <Ionicons name="flag" size={16} color={GOLD} style={{ marginBottom: 1 }} />
                  <Tactile onPress={() => setPick(finalStop)}>
                    <View style={{ borderRadius: 5, overflow: "hidden", borderWidth: 2, borderColor: GOLD, ...shadow.card }}>
                      <PosterImg path={finalStop.poster_path} width={30} height={45} size="w185" rounded={3} />
                    </View>
                  </Tactile>
                  <View style={{ width: 2.5, height: 10, backgroundColor: "#b7ad96" }} />
                </View>
              ) : null}

              {/* "me" position marker (chevron) on the current road */}
              <View
                style={{
                  position: "absolute",
                  left: mapBox.w * 0.11 - 16,
                  bottom: mapBox.h * (1 - 0.81) - 14,
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 0,
                    height: 0,
                    borderLeftWidth: 15,
                    borderRightWidth: 15,
                    borderBottomWidth: 26,
                    borderLeftColor: "transparent",
                    borderRightColor: "transparent",
                    borderBottomColor: brand.accent,
                  }}
                />
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: brand.accent,
                    borderWidth: 2.5,
                    borderColor: "#fff",
                    marginTop: -3,
                  }}
                />
                {data.seenCount > 0 ? (
                  <View style={{ marginTop: 5, backgroundColor: "rgba(255,255,255,0.85)", borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 1 }}>
                    <Ui size={fs.xs - 2} weight="700" color="#4A4638">
                      ↓ {t("nav.behindN", { n: data.seenCount })}
                    </Ui>
                  </View>
                ) : null}
              </View>
              </>
              )}
            </Animated.View>

            {/* ◎ recenter — outside the transformed layer (hidden while a card is open) */}
            {!pick ? (
              <Tactile onPress={recenter} hitSlop={6} style={{ position: "absolute", right: sp.s3, bottom: sp.s4 }}>
                <View
                  accessibilityLabel={t("nav.recenter")}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.pill,
                    backgroundColor: pal.card,
                    borderWidth: 1,
                    borderColor: pal.hairline,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadow.card,
                  }}
                >
                  <Ionicons name="locate" size={20} color={pal.ink} />
                </View>
              </Tactile>
            ) : null}

            {/* note when some route films aren't charted on the odyssey plane */}
            {scene && scene.missingCount > 0 ? (
              <View
                style={{
                  position: "absolute",
                  left: sp.s3,
                  top: sp.s3,
                  backgroundColor: "rgba(255,255,255,0.88)",
                  borderRadius: radius.pill,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: pal.hairline,
                }}
              >
                <Ui size={fs.xs - 2} weight="700" color="#6a6153">
                  ✦ {t("nav.offmap", { n: scene.missingCount })}
                </Ui>
              </View>
            ) : null}

            {/* poster tap → info card (director · year · TakeScore · availability). Lives
                OUTSIDE the pannable layer so it stays put, near the map's bottom edge. */}
            {pick ? (
              <View
                style={[
                  {
                    position: "absolute",
                    left: sp.s3,
                    right: sp.s3,
                    bottom: sp.s4,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp.s3,
                    backgroundColor: pal.card,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: pal.hairline,
                    paddingVertical: sp.s3,
                    paddingLeft: sp.s3,
                    paddingRight: sp.s5,
                  },
                  shadow.float,
                ]}
              >
                <View style={{ borderRadius: 6, overflow: "hidden" }}>
                  <PosterImg path={pick.poster_path} width={40} height={60} size="w185" rounded={6} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Serif size={fs.md} bold numberOfLines={1}>
                    {pick.title}
                  </Serif>
                  <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ marginTop: 1 }}>
                    {[pick.director, pick.year != null ? String(pick.year) : null].filter(Boolean).join(" · ") || "—"}
                  </Ui>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <Ui size={fs.xs} weight="700">
                      {pick.takescore != null ? `${Math.round(pick.takescore)} ${t("nav.takescore")}` : `${t("nav.takescore")} —`}
                    </Ui>
                    {pick.availability !== "none" ? (
                      <>
                        <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: pal.subtle }} />
                        <Ui size={fs.xs} weight="600" color={pick.availability === "sub" ? brand.teal : GOLD}>
                          {pick.availability === "sub" ? `▶ ${t("nav.playNow")}` : t("nav.rent")}
                        </Ui>
                      </>
                    ) : null}
                  </View>
                </View>
                <Tactile
                  onPress={() => {
                    const slug = pick.slug;
                    setPick(null);
                    router.push({ pathname: "/film/[slug]", params: { slug } });
                  }}
                >
                  <View style={{ backgroundColor: pal.ink, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 }}>
                    <Ui size={fs.xs} weight="700" color={pal.bg} numberOfLines={1}>
                      {t("nav.open")}
                    </Ui>
                  </View>
                </Tactile>
                <Tactile onPress={() => setPick(null)} hitSlop={8} style={{ position: "absolute", top: 4, right: 6 }}>
                  <Ionicons name="close" size={16} color={pal.subtle} />
                </Tactile>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {/* ═══════════ BOTTOM SHEET — collapsible: peek → full trip meter ═══════════ */}
      <View
        style={{
          backgroundColor: pal.card,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingTop: sp.s3,
          paddingHorizontal: sp.s4,
          paddingBottom: insets.bottom + sp.s4,
          marginTop: -14,
          ...shadow.float,
        }}
      >
        {/* PEEK — tap to expand/collapse */}
        <Tactile onPress={() => setSheetOpen((o) => !o)}>
          <View>
            <View style={{ width: 38, height: 5, borderRadius: 99, backgroundColor: pal.hairline2, alignSelf: "center", marginBottom: sp.s3 }} />

            {/* headline: time remaining + N films + pace + expand chevron */}
            <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: sp.s2 }}>
              <Ui size={fs.x2} weight="700">
                {arrived ? "0:00" : fmtDur(data.runtimeRemaining)}
              </Ui>
              <Ui size={fs.md} weight="700" color={brand.accent}>
                {t("nav.filmsN", { n: data.remaining })}
              </Ui>
              <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ui size={fs.xs} weight="600" color={pal.muted}>
                  {sheetOpen
                    ? t("nav.remainingTime") + (data.etaWeeks ? ` · ${t("nav.pace", { n: data.etaWeeks })}` : "")
                    : t("nav.moreDetails")}
                </Ui>
                <Ionicons name={sheetOpen ? "chevron-down" : "chevron-up"} size={16} color={pal.subtle} />
              </View>
            </View>

            {/* thin progress bar (always visible in peek) */}
            <View style={{ height: 9, borderRadius: 99, backgroundColor: pal.surface, overflow: "hidden", flexDirection: "row", marginTop: sp.s3 }}>
              <View style={{ width: `${Math.round(doneFrac * 100)}%`, height: "100%", backgroundColor: GOLD }} />
            </View>
          </View>
        </Tactile>

        {sheetOpen ? (
          <>
            {/* traveled / remaining meter labels */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: sp.s2 }}>
              <View>
                <Ui size={fs.xs - 2} weight="700" color={pal.subtle}>
                  {t("nav.traveled").toUpperCase()}
                </Ui>
                <Ui size={fs.xs} weight="700" color={GOLD}>
                  {t("nav.filmsN", { n: data.seenCount })} · {fmtHM(data.runtimeTraveled)}
                </Ui>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Ui size={fs.xs - 2} weight="700" color={pal.subtle}>
                  {t("nav.remainingLane").toUpperCase()}
                </Ui>
                <Ui size={fs.xs} weight="700" color={brand.accent}>
                  {t("nav.filmsN", { n: data.remaining })} · {fmtHM(data.runtimeRemaining)}
                </Ui>
              </View>
            </View>

            {/* route-pref switch (fewest / fastest / no tolls) */}
            <View style={{ flexDirection: "row", gap: sp.s2, marginTop: sp.s4 }}>
              {PREFS.map((p) => {
                const on = pref === p;
                const label = p === "fewest" ? t("nav.prefFewest") : p === "fastest" ? t("nav.prefFastest") : t("nav.prefNoTolls");
                const tolls = data.routes[p].tollCount;
                return (
                  <Tactile key={p} onPress={() => setPref(p)} style={{ flex: 1 }}>
                    <View
                      style={{
                        borderRadius: radius.sm,
                        paddingVertical: 9,
                        alignItems: "center",
                        backgroundColor: on ? pal.ink : pal.surface,
                        borderWidth: on ? 0 : 1,
                        borderColor: pal.hairline,
                      }}
                    >
                      <Ui size={fs.sm} weight="700" color={on ? pal.bg : pal.ink}>
                        {label}
                      </Ui>
                      {p === "no_tolls" && tolls > 0 ? (
                        <Ui size={fs.xs - 2} weight="600" color={on ? "rgba(255,255,255,0.75)" : GOLD}>
                          {t("nav.tollN", { n: tolls })}
                        </Ui>
                      ) : null}
                    </View>
                  </Tactile>
                );
              })}
            </View>

            {/* actions: mark seen (advance) · skip this turn */}
            {!arrived && head ? (
              <View style={{ flexDirection: "row", gap: sp.s2, marginTop: sp.s2 }}>
                <Tactile onPress={() => onMarkSeen(head.slug)} style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: radius.sm,
                      paddingVertical: 11,
                      backgroundColor: pal.surface,
                      borderWidth: 1,
                      borderColor: pal.hairline,
                    }}
                  >
                    <Ionicons name="checkmark" size={16} color={brand.teal} />
                    <Ui size={fs.sm} weight="700">
                      {t("nav.markSeen")}
                    </Ui>
                  </View>
                </Tactile>
                <Tactile onPress={() => onSkip(head.slug)} style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: radius.sm,
                      paddingVertical: 11,
                      backgroundColor: pal.surface,
                      borderWidth: 1,
                      borderColor: pal.hairline,
                    }}
                  >
                    <Ionicons name="play-skip-forward-outline" size={15} color={pal.ink} />
                    <Ui size={fs.sm} weight="700">
                      {t("nav.skip")}
                    </Ui>
                  </View>
                </Tactile>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {/* floating chrome — back + share; destination title chip */}
      <View
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        pointerEvents="box-none"
      >
        <Disc icon="chevron-back" onPress={back} />
        <View
          style={[
            { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pal.chrome, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
            shadow.card,
          ]}
        >
          <Ionicons name="navigate" size={13} color={brand.accent} />
          <Ui size={fs.sm} weight="700" numberOfLines={1} style={{ maxWidth: winW * 0.42 }}>
            {data.label}
          </Ui>
        </View>
        <Disc icon="share-outline" onPress={() => Share.share({ message: webUrl })} />
      </View>

      {/* reroute toast */}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: insets.top + 96,
            alignItems: "center",
          }}
        >
          <View style={[{ backgroundColor: pal.ink, borderRadius: radius.pill, paddingHorizontal: sp.s4, paddingVertical: 9 }, shadow.float]}>
            <Ui size={fs.sm} weight="600" color={pal.bg}>
              {toast}
            </Ui>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
