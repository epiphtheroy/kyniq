"use client";
/** Takes — write & manage your readings (/room/takes, v3 successor of /room/write).
 *  Spec §3.13. REAL data: list = me_authored_takes (paged server-side via
 *  loadRanged); attach search = film_search RPC (Tier-1 only); persistence =
 *  save_take (server-side sanitize_user_html, author_id=auth.uid(), source='human').
 *
 *  v3 changes vs the old WriteWorkspace:
 *  - editor = TakeEditor (Selection/Range command layer — execCommand is gone);
 *  - real draft safety: per-draft-key debounced localStorage + beforeunload when
 *    dirty; honest pill states Saved to server / Draft on this device / Unsaved;
 *  - server writes unchanged: explicit Save draft / Publish; Archive =
 *    unpublish via save_take(p_publish:false) stays the soft action, and
 *    §8-R5b delete_take is the hard delete (inline two-step confirm);
 *  - list rail: status chip + upvotes + date (the constant ×1.5 tag is gone from
 *    rows — its one explanation lives in the attach rail);
 *  - stats header = me_takes_stats() aggregate (§8-R8), fetched by the server
 *    page and passed down as a prop;
 *  - attach rail = inline right column ≥1180px, inspector below. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import { num } from "@/lib/room/format";
import { STR } from "./strings";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import TakeEditor from "./TakeEditor";
import { FRAMEWORKS, FAMILIES, fw, type Framework } from "@/lib/frameworks";

export type TakeRow = {
  take_id: string;
  title: string | null;
  framework: string | null;
  register: string | null;
  body: string | null;
  status: string | null;
  is_public: boolean;
  film_slug: string | null;
  film_title: string | null;
  figure_slug: string | null;
  figure_label: string | null;
  meta_take_slug: string | null;
  meta_take_title: string | null;
  upvotes: number | null;
  created_at: string;
};

type ComposerType = "free" | "comment" | "misreading" | "trope";
type FilmHit = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };
type AttachedFilm = { slug: string; title: string; year: number | null };
type TakeStatus = "draft" | "published";

const TYPE_META: Record<ComposerType, { label: string; icon: string; title: string }> = {
  free: { label: "Free note", icon: "ti-note", title: "A free-standing note — not tied to any film" },
  comment: { label: "Film comment", icon: "ti-message", title: "A short comment that docks under one film" },
  misreading: { label: "Misreading", icon: "ti-quote", title: "A strong misreading — read a figure against its intent" },
  trope: { label: "Trope note", icon: "ti-affiliate", title: "A note on a pattern that crosses several films" },
};
const PH: Record<ComposerType, string> = {
  free: "Write your take here. It doesn't have to be tied to a film — attach films, a framework or tropes from the rail afterwards.",
  comment: "One thing this film left you with. It docks under a specific film — attach the film in the rail.",
  misreading: "Read this figure the wrong way, on purpose. Push your own interpretation against the film's intent.",
  trope: "Name a pattern that recurs across films. Which works belong to one strand — and why?",
};

const LS_PREFIX = "mt_take_draft:";

/** A composer draft. Seeded from a real authored take, a localStorage restore,
 *  or blank. serverSnap = the last content known to be on the server. */
type Draft = {
  id: string;
  type: ComposerType;
  title: string;
  body: string;
  films: AttachedFilm[];
  framework: string | null;
  fromTakeId: string | null;
  status: TakeStatus;
  serverSnap: string;
  /** true once the debounced localStorage write landed for the current content. */
  localSaved: boolean;
};

const snapOf = (d: Pick<Draft, "title" | "body" | "framework">) =>
  JSON.stringify({ t: d.title, b: d.body, f: d.framework });

function newDraft(id?: string): Draft {
  const d: Draft = {
    id: id ?? `d-${Date.now()}`, type: "free", title: "", body: "", films: [],
    framework: null, fromTakeId: null, status: "draft", serverSnap: "", localSaved: false,
  };
  return d;
}

function draftFromTake(t: TakeRow): Draft {
  const type: ComposerType = t.figure_slug ? "misreading" : t.meta_take_slug ? "trope" : t.film_slug ? "comment" : "free";
  const base = {
    id: t.take_id, type, title: t.title ?? "", body: t.body ?? "",
    films: t.film_slug && t.film_title ? [{ slug: t.film_slug, title: t.film_title, year: null }] : [],
    framework: t.framework, fromTakeId: t.take_id,
    status: (t.status === "published" ? "published" : "draft") as TakeStatus,
    localSaved: true,
  };
  return { ...base, serverSnap: snapOf(base) };
}

/** Unsaved-to-server? New drafts count once they hold anything. */
const isDirty = (d: Draft) =>
  d.fromTakeId ? snapOf(d) !== d.serverSnap : !(d.title === "" && d.body === "" && d.framework == null);

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
const wordsOf = (html: string) => { const t = plain(html); return t ? t.split(" ").length : 0; };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** §8-R8 me_takes_stats() row — whole-set counts, aggregated server-side. */
export type TakesStats = { published: number; drafts: number; upvotes: number };

export default function TakesWorkspace({ takes, uid, stats }: { takes: TakeRow[]; uid: string; stats: TakesStats | null }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { supabase, say } = useRoomActions();

  /* Draft keys are uid-scoped (mt_take_draft:{uid}:{draftId}) so a shared
     browser never restores another account's drafts. */
  const lsPrefix = `${LS_PREFIX}${uid}:`;

  const [drafts, setDrafts] = useState<Draft[]>(() => (takes.length ? [] : [newDraft()]));
  const [curId, setCurId] = useState<string | null>(() => (takes.length ? null : drafts[0]?.id ?? null));
  const [listQ, setListQ] = useState("");
  const [listFilt, setListFilt] = useState<"all" | "pub" | "dra">("all");
  const [saving, setSaving] = useState(false);
  /* §8-R5b delete: server rows removed this session (takes is an immutable
     prop, so removal is an overlay), plus the inline two-step confirm state. */
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cur: Draft | null = useMemo(() => drafts.find((d) => d.id === curId) ?? null, [drafts, curId]);

  /* Delete confirm is per-selection — switching takes disarms it. */
  useEffect(() => { setConfirmDel(false); }, [curId]);

  /* ── localStorage restore (mount only; client-side so no hydration mismatch) ── */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const restored: Draft[] = [];
    try {
      /* Snapshot the keys first — removeItem inside the loop would shift live
         indices and skip the next key. Legacy unscoped and other users' keys
         are skipped, never restored. */
      const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
      for (const k of keys) {
        if (!k || !k.startsWith(lsPrefix)) continue;
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const v = JSON.parse(raw) as Partial<Draft>;
        if (typeof v.id !== "string") continue;
        const t = takes.find((x) => x.take_id === v.id || x.take_id === v.fromTakeId);
        const base = t ? draftFromTake(t) : newDraft(v.id);
        const d: Draft = {
          ...base,
          title: typeof v.title === "string" ? v.title : base.title,
          body: typeof v.body === "string" ? v.body : base.body,
          framework: v.framework !== undefined ? (v.framework as string | null) : base.framework,
          type: (v.type as ComposerType) ?? base.type,
          films: Array.isArray(v.films) ? (v.films as AttachedFilm[]) : base.films,
          localSaved: true,
        };
        if (t && snapOf(d) === d.serverSnap) { localStorage.removeItem(k); continue; } // local copy = server → stale overlay, drop it
        restored.push(d);
      }
    } catch { /* localStorage unavailable — drafts stay session-only */ }
    if (!restored.length) return;
    /* This runs once at mount, so prior state is the initializer: either []
       (takes exist) or one pristine scratch draft (no takes). Pristine scratch
       is not dirty → dropped; a restored draft takes the selection instead. */
    setDrafts((prev) => {
      const kept = prev.filter((d) => !restored.some((r) => r.id === d.id) && isDirty(d));
      return [...kept, ...restored];
    });
    if (takes.length === 0) setCurId(restored[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── debounced per-draft localStorage persistence ── */
  useEffect(() => {
    if (!cur || cur.localSaved || !isDirty(cur)) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(lsPrefix + cur.id, JSON.stringify({
          id: cur.id, fromTakeId: cur.fromTakeId, type: cur.type, title: cur.title,
          body: cur.body, framework: cur.framework, films: cur.films, savedAt: Date.now(),
        }));
        setDrafts((ds) => ds.map((d) => (d.id === cur.id ? { ...d, localSaved: true } : d)));
      } catch { /* quota/unavailable → pill stays "Unsaved" (honest) */ }
    }, 600);
    return () => clearTimeout(t);
  }, [cur, lsPrefix]);

  /* ── beforeunload guard while any draft is dirty (spec §3.13-1) ── */
  const dirtyAny = drafts.some(isDirty);
  useEffect(() => {
    if (!dirtyAny) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyAny]);

  const patchCur = useCallback((p: Partial<Draft>) => {
    setDrafts((ds) => ds.map((d) => (d.id === curId ? { ...d, ...p, localSaved: false } : d)));
  }, [curId]);

  const selectItem = (id: string, real: boolean) => {
    if (real) {
      const t = takes.find((x) => x.take_id === id);
      if (t) {
        setDrafts((ds) => (ds.some((d) => d.id === id) ? ds : [...ds, draftFromTake(t)]));
        setCurId(id);
      }
    } else setCurId(id);
  };

  const addDraft = () => { const d = newDraft(); setDrafts((ds) => [...ds, d]); setCurId(d.id); };

  /* ── server writes: save_take, unchanged contract (explicit Save/Publish) ── */
  const persist = useCallback(async (publish: boolean, doneMsg: string) => {
    if (!cur) return;
    setConfirmDel(false); // a save/publish disarms a pending delete confirm
    setSaving(true);
    const sent = snapOf(cur); // exact content shipped to the server
    const { data, error } = await supabase.rpc("save_take", {
      p_take_id: cur.fromTakeId,
      p_title: cur.title || null,
      p_body_html: cur.body,
      p_framework: cur.framework,
      p_publish: publish,
    });
    setSaving(false);
    if (error) { say(STR.toast.saveFail(error.message)); return; }
    const row = ((data as { take_id: string; status: string }[] | null) ?? [])[0];
    if (row?.take_id) {
      setDrafts((ds) => ds.map((d) => {
        if (d.id !== cur.id) return d;
        const clean = snapOf(d) === sent; // no keystrokes arrived mid-flight
        if (clean) { try { localStorage.removeItem(lsPrefix + cur.id); } catch { /* fine */ } }
        return { ...d, fromTakeId: row.take_id, status: publish ? "published" : "draft", serverSnap: sent, localSaved: clean ? true : d.localSaved };
      }));
      say(doneMsg);
    }
  }, [cur, supabase, say, lsPrefix]);

  const saveDraft = () => persist(false, "Draft saved to the server");
  const publish = () => persist(true, "Published — live on your profile");
  /** Archive = unpublish → draft: the soft action next to hard Delete. */
  const archive = () => persist(false, "Archived — unpublished, back in drafts");

  /** §8-R5b delete_take — hard delete of my own take. Every row this screen
   *  lists is source='human' (save_take writes them), which is exactly what
   *  the RPC's `source='human'` guard deletes. Optimistic removal with
   *  rollback on failure (house pattern, ShelfWorkspace setPub); the
   *  localStorage draft is cleared only after the server confirms, so a
   *  rollback never costs local work. */
  const deleteTake = useCallback(() => {
    if (!cur?.fromTakeId || deleting || saving) return;
    const takeId = cur.fromTakeId;
    // Drafts riding on this take: the seeded editor copy (id === takeId) and/or
    // a new-draft shell that was saved to it (fromTakeId === takeId).
    const removed = drafts.filter((d) => d.id === takeId || d.fromTakeId === takeId);
    setConfirmDel(false);
    setDeleting(true);
    setDeletedIds((p) => { const n = new Set(p); n.add(takeId); return n; });
    setDrafts((ds) => ds.filter((d) => !removed.some((r) => r.id === d.id)));
    setCurId(null);
    supabase.rpc("delete_take", { p_take_id: takeId }).then(({ data, error }) => {
      setDeleting(false);
      const gone = (((data as { take_id: string }[] | null) ?? []).length) > 0;
      if (error || !gone) {
        // Rollback — the row is still on the server (RPC error, or 0 rows
        // deleted because the guard didn't match).
        setDeletedIds((p) => { const n = new Set(p); n.delete(takeId); return n; });
        if (removed.length) setDrafts((ds) => [...ds, ...removed.filter((r) => !ds.some((d) => d.id === r.id))]);
        say(STR.toast.saveFail(error ? error.message : "the take wasn't deleted"));
        return;
      }
      for (const d of removed) { try { localStorage.removeItem(lsPrefix + d.id); } catch { /* fine */ } }
      say("Deleted forever — the take is gone from the server");
    });
  }, [cur, deleting, saving, drafts, supabase, say, lsPrefix]);

  /* ── list rail items: server takes (with live draft overlay) + new drafts.
        takes is a prop, so §8-R5b deletions are subtracted here. ── */
  const listItems = useMemo(() => {
    const live = takes.filter((t) => !deletedIds.has(t.take_id));
    const dm = new Map(drafts.map((d) => [d.id, d]));
    const takeIds = new Set(live.map((t) => t.take_id));
    const takeItems = live.map((t) => {
      const d = dm.get(t.take_id);
      const status: TakeStatus = d ? d.status : t.status === "published" ? "published" : "draft";
      return {
        id: t.take_id, real: true,
        title: (d ? d.title : t.title) || "Untitled take",
        snippet: plain(d ? d.body : t.body ?? ""),
        status, up: num(t.upvotes), date: t.created_at as string | null,
      };
    });
    const draftItems = drafts
      .filter((d) => !takeIds.has(d.id) && !(d.fromTakeId && takeIds.has(d.fromTakeId)))
      .map((d) => ({
        id: d.id, real: false, title: d.title || "Untitled take",
        snippet: plain(d.body), status: d.status, up: null as number | null, date: null as string | null,
      }));
    return [...draftItems, ...takeItems].filter((it) => {
      if (listFilt === "pub" && it.status !== "published") return false;
      if (listFilt === "dra" && it.status === "published") return false;
      if (listQ && !(it.title + it.snippet).toLowerCase().includes(listQ.toLowerCase())) return false;
      return true;
    });
  }, [takes, drafts, deletedIds, listFilt, listQ]);

  /* ── attach rail: inline column ≥1180px; inspector below (CSS decides) ── */
  const onAddFilm = useCallback((id: string, f: AttachedFilm) => {
    setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, films: x.films.some((y) => y.slug === f.slug) ? x.films : [...x.films, f], localSaved: false } : x)));
  }, []);
  const onRmFilm = useCallback((id: string, slug: string) => {
    setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, films: x.films.filter((y) => y.slug !== slug), localSaved: false } : x)));
  }, []);
  const onFramework = useCallback((id: string, k: string) => {
    setDrafts((ds) => ds.map((x) => (x.id === id
      ? { ...x, framework: x.framework === k ? null : k, type: x.type === "free" ? "misreading" : x.type, localSaved: false }
      : x)));
  }, []);

  const railNode = useCallback((d: Draft) => (
    <AttachRail
      draft={d}
      onAddFilm={(f) => onAddFilm(d.id, f)}
      onRmFilm={(s) => onRmFilm(d.id, s)}
      onFramework={(k) => onFramework(d.id, k)}
      supabase={supabase}
    />
  ), [onAddFilm, onRmFilm, onFramework, supabase]);

  /* Inspector variant (<1180px): open on demand, live-refresh while open. */
  const [railFor, setRailFor] = useState<string | null>(null);
  const openRail = useCallback(() => {
    if (!cur) return;
    setRailFor(cur.id);
    insp.select(railNode(cur), "Attach · Connect");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, railNode]);
  useEffect(() => {
    if (railFor && insp.open && cur && cur.id === railFor) insp.select(railNode(cur), "Attach · Connect");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur?.films, cur?.framework, cur?.type]);
  useEffect(() => { if (!insp.open) setRailFor(null); }, [insp.open]);

  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-feather" title="Takes">
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.6 }}>
            Write and manage your readings. Save draft / Publish writes to the server;
            everything else persists on this device only. Attach films and a framework
            from the rail (or the Attach button on narrow screens).
          </div>
        </ICard>
        <ICard icon="ti-device-floppy" title="Draft safety">
          <KV k="Saved to server" v="on the server" />
          <KV k="Draft on this device" v="localStorage" />
          <KV k="Unsaved" v="this tab only" />
        </ICard>
      </div>
    );
  }, [setDefault]);

  const routeLabel = (d: Draft) => {
    if (d.type === "misreading" && d.framework) return `· as a ${fw(d.framework).label} misreading`;
    return "· to your public profile";
  };

  const pill = !cur ? null
    : !isDirty(cur) && cur.fromTakeId ? { cls: "srv", icon: "ti-cloud-check", label: "Saved to server" }
    : cur.localSaved ? { cls: "loc", icon: "ti-device-floppy", label: "Draft on this device" }
    : { cls: "un", icon: "ti-alert-triangle", label: "Unsaved" };

  return (
    <div className="tk-page">
      {/* STATS HEADER — me_takes_stats() whole-set aggregate (§8-R8), fetched
          by the server page. Em-dash when the RPC failed — no fabricated 0s. */}
      <div className="tk-stats">
        <span className="eb">Takes</span>
        <span className="ts"><b>{stats ? stats.published : "—"}</b> published</span>
        <span className="ts"><b>{stats ? stats.drafts : "—"}</b> drafts</span>
        <span className="ts" title="Total upvotes across your takes"><i className="ti ti-arrow-big-up" /> <b>{stats ? stats.upvotes : "—"}</b> upvotes</span>
        <span className="tsnote">Not reviews. Not ratings. Readings.</span>
      </div>

      <div className="tk-wrap">
        {/* LIST RAIL */}
        <aside className="nlist">
          <div className="nlhd">
            <div className="tk-srch"><i className="ti ti-search" /><input value={listQ} onChange={(e) => setListQ(e.target.value)} placeholder="Search my takes" /></div>
            <button className="newbtn" onClick={addDraft} title="Start a new take"><i className="ti ti-plus" /> New</button>
          </div>
          <div className="nlfilt">
            {(["all", "pub", "dra"] as const).map((f) => (
              <button key={f} className={listFilt === f ? "on" : ""} onClick={() => setListFilt(f)}>
                {f === "all" ? "All" : f === "pub" ? "Published" : "Drafts"}
              </button>
            ))}
          </div>
          <div className="nlitems">
            {listItems.length ? listItems.map((it) => (
              <div key={it.id} className={`li${it.id === curId ? " on" : ""}`}
                role="button" tabIndex={0} onClick={() => selectItem(it.id, it.real)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); selectItem(it.id, it.real); } }}>
                <div className="lt">{it.title}</div>
                <div className="sn">{it.snippet || "…"}</div>
                <div className="lm">
                  <span className={`tk-st ${it.status === "published" ? "pub" : "dra"}`}>{it.status === "published" ? "Published" : "Draft"}</span>
                  {it.up != null ? <span className="tk-up" title="Upvotes"><i className="ti ti-arrow-big-up" />{it.up}</span> : null}
                  <span className="ld">{it.date ? fmtDate(it.date) : "local"}</span>
                </div>
              </div>
            )) : (
              <div className="nlempty">
                {takes.length === 0 ? STR.empty.takes : "Nothing matches this filter."}
              </div>
            )}
          </div>
        </aside>

        {/* EDITOR */}
        <section className="ed">
          <div className="edbar">
            <div className="tk-seg">
              {(Object.keys(TYPE_META) as ComposerType[]).map((t) => (
                <button key={t} className={cur?.type === t ? "on" : ""} title={TYPE_META[t].title} onClick={() => patchCur({ type: t })} disabled={!cur}>
                  <i className={`ti ${TYPE_META[t].icon}`} /> {TYPE_META[t].label}
                </button>
              ))}
            </div>
            <button className="newbtn tk-attachbtn" onClick={openRail} disabled={!cur} title="Attach films & framework">
              <i className="ti ti-paperclip" /> Attach
            </button>
            {pill ? (
              <span className={`tk-pill ${pill.cls}`} title="Where the latest edit of this take lives">
                <i className={`ti ${saving ? "ti-loader-2" : pill.icon}`} /> {saving ? "Saving…" : pill.label}
              </span>
            ) : null}
            {/* §8-R5b hard delete — only for takes that exist on the server
                (all source='human' here). Inline two-step confirm, no
                window.confirm; Archive below stays the soft path. */}
            {cur?.fromTakeId ? (
              confirmDel ? (
                <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                  <button className="savebtn" style={{ background: "var(--red)" }} onClick={deleteTake} disabled={deleting}
                    title="Permanently delete this take from the server — there is no undo">
                    <i className="ti ti-trash" /> Delete forever?
                  </button>
                  <button className="savebtn ghost" onClick={() => setConfirmDel(false)} disabled={deleting}>
                    Keep
                  </button>
                </span>
              ) : (
                <button className="savebtn arch" style={{ color: "var(--red)" }} onClick={() => setConfirmDel(true)}
                  disabled={deleting || saving} title="Delete this take permanently — asks once more before it acts">
                  <i className="ti ti-trash" /> Delete
                </button>
              )
            ) : null}
            {cur?.status === "published" ? (
              <>
                <button className="savebtn arch" onClick={archive} disabled={!cur || saving} title="Unpublish — the take returns to drafts">
                  <i className="ti ti-archive" /> Archive
                </button>
                <button className="savebtn pub" onClick={publish} disabled={!cur || saving}>
                  <i className="ti ti-world" /> Publish changes <span className="where">{cur ? routeLabel(cur) : ""}</span>
                </button>
              </>
            ) : (
              <>
                <button className="savebtn ghost" onClick={saveDraft} disabled={!cur || saving} title="Save to the server as a private draft">
                  <i className="ti ti-check" /> Save draft
                </button>
                <button className="savebtn pub" onClick={publish} disabled={!cur || saving}>
                  <i className="ti ti-world" /> Publish <span className="where">{cur ? routeLabel(cur) : ""}</span>
                </button>
              </>
            )}
          </div>

          <div className="tk-canvas">
            <div className="inner">
              {cur && cur.type !== "free" ? (
                <div className="hintbanner">
                  {cur.type === "misreading"
                    ? <><b>Strong misreading</b> — pick a framework and read against the intent. {cur.framework ? <>Publishing under the <b>{fw(cur.framework).label}</b> frame.</> : "Pick a framework in the attach rail."}</>
                    : cur.type === "comment"
                      ? <><b>Film comment</b> — docks under one film. {cur.films.length ? <>Will dock under <b>{cur.films[0].title}</b> once film attachments persist — for now it publishes to your profile.</> : "Attach the film in the rail."}</>
                      : <><b>Trope note</b> — a pattern across films. Attach the films it crosses in the rail.</>}
                </div>
              ) : null}

              {cur ? (
                <>
                  <input className="titlein" value={cur.title} onChange={(e) => patchCur({ title: e.target.value })} placeholder="Untitled take — start writing right here" />
                  <TakeEditor draftKey={cur.id} html={cur.body} placeholder={PH[cur.type]} onChange={(body) => patchCur({ body })} />
                  <div className="tk-foot">
                    <span className="wc">{wordsOf(cur.body)} words</span>
                    <span>Save draft / Publish writes to the server (body passes the server-side HTML whitelist). Unsaved edits persist on this device only.</span>
                  </div>
                </>
              ) : (
                <div className="tk-noneopen">
                  <i className="ti ti-feather" />
                  <div>Pick a take on the left, or start a new one.</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ATTACH RAIL — inline right column ≥1180px (inspector below that width) */}
        <aside className="tk-rail">
          {cur ? railNode(cur) : (
            <div className="tk-railempty">Select or start a take — film and framework attachments dock here.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ── attach/connect rail (inline column or inspector content) ── */
function AttachRail({ draft, onAddFilm, onRmFilm, onFramework, supabase }: {
  draft: Draft;
  onAddFilm: (f: AttachedFilm) => void;
  onRmFilm: (slug: string) => void;
  onFramework: (key: string) => void;
  supabase: ReturnType<typeof createClient>;
}) {
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FilmHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFw, setShowFw] = useState(false);

  useEffect(() => {
    if (!searching) return;
    const term = q.trim();
    if (term.length < 1) { setHits([]); return; }
    let alive = true;
    setLoading(true);
    const h = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 8 });
      // room = Tier-1 only (film_search v2 returns Tier-2 catalog rows, flagged)
      if (alive) { setHits((((data as (FilmHit & { is_catalog?: boolean })[] | null) ?? [])).filter((x) => x.is_catalog !== true)); setLoading(false); }
    }, 220);
    return () => { alive = false; clearTimeout(h); };
  }, [q, searching, supabase]);

  const freshHits = hits.filter((h) => !draft.films.some((f) => f.slug === h.slug));

  return (
    <div>
      <ICard icon="ti-paperclip" title="Attached to this take">
        {/* films */}
        <div className="arow">
          {/* literal colors, not island vars — this rail also renders inside the inspector */}
          <div className="arlbl"><span className="d" style={{ background: "#ECEAE5" }} />Films<span className="ct">{draft.films.length}</span></div>
          <div className="achips">
            {draft.films.map((f) => (
              <span className="achip film" key={f.slug}>{f.title}{f.year ? <span className="yr">&apos;{String(f.year).slice(2)}</span> : null}<i className="ti ti-x x" onClick={() => onRmFilm(f.slug)} /></span>
            ))}
            {searching ? (
              <span className="asrch">
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Film title" onBlur={() => setTimeout(() => setSearching(false), 180)} />
                <div className="adrop">
                  {loading ? <div className="ai busy">Searching…</div>
                    : freshHits.length
                      ? freshHits.map((h) => (
                        <div className="ai" key={h.slug} onMouseDown={(e) => { e.preventDefault(); onAddFilm({ slug: h.slug, title: h.title, year: h.year }); setQ(""); }}>
                          {h.title}<div className="m">{[h.director, h.year].filter(Boolean).join(" · ")}</div>
                        </div>))
                      : <div className="ai busy">{q.trim() ? "No results" : "Type a title"}</div>}
                </div>
              </span>
            ) : (
              <span className="addbtn" onClick={() => { setSearching(true); setQ(""); }}><i className="ti ti-plus" /> Attach film</span>
            )}
          </div>
          <div className="tk-coming">Film attachments don&apos;t persist to the server yet — page routing is forming.</div>
        </div>

        {/* framework */}
        <div className="arow">
          <div className="arlbl"><span className="d" style={{ background: "#E8B23A" }} />Framework<span className="ct">{draft.framework ? 1 : 0}</span></div>
          <div className="achips">
            {draft.framework ? (
              <span className="achip misread">{fw(draft.framework).label}<i className="ti ti-x x" onClick={() => onFramework(draft.framework!)} /></span>
            ) : null}
            <span className="addbtn" onClick={() => setShowFw((s) => !s)}><i className="ti ti-quote" /> {draft.framework ? "Change frame" : "Pick a framework"}</span>
          </div>
          {showFw ? (
            <div style={{ marginTop: 8 }}>
              {FAMILIES.map((fam) => {
                const fws = FRAMEWORKS.filter((f) => f.family === fam.key && f.key !== "INVITATION");
                if (!fws.length) return null;
                return (
                  <div key={fam.key}>
                    <div className="fwfam">{fam.label}</div>
                    <div className="fwpick">
                      {fws.map((f: Framework) => (
                        <button key={f.key} className={`fwchip${draft.framework === f.key ? " on" : ""}`}
                          style={draft.framework === f.key ? { background: f.color, borderColor: f.color } : undefined}
                          onClick={() => { onFramework(f.key); setShowFw(false); }} title={f.short}>
                          <span className="d" style={{ background: f.color }} />{f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* tropes & figures — honest "coming", no fake affordance */}
        <div className="arow">
          <div className="arlbl"><span className="d" style={{ background: "#1FB286" }} />Tropes · Figures<span className="ct">0</span></div>
          <div className="tk-coming">Attaching tropes &amp; figures: coming.</div>
        </div>
      </ICard>

      {/* THE one ×1.5 explanation (removed from list rows — zero-information there) */}
      <ICard icon="ti-flame" title="Taste contribution">
        <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
          Your own words are the strongest taste signal — this take&apos;s embedding adds to
          your taste vector at <b style={{ color: "#f2a39f" }}>×1.5</b>, stronger than any star or watch.
        </div>
        <KV k="Taste vector boost" v="×1.5" />
        <KV k="Visibility" v={draft.status === "published" ? "Published" : "Draft"} />
      </ICard>

      {/* neutral attach chips — .rsn reason chips are reserved for server-sent codes */}
      <ICard icon="ti-tags" title="Publish routing">
        <div className="achips">
          {draft.framework ? <span className="achip misread">framework · {fw(draft.framework).label}</span> : null}
          {draft.films.length ? <span className="achip film">{draft.films.length} film{draft.films.length > 1 ? "s" : ""}</span> : null}
          {!draft.framework && !draft.films.length ? <span style={{ color: "var(--sub)", fontSize: 11 }}>Nothing attached yet — add entities above.</span> : null}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>
          Type and attachments route a published take to film pages, framework lines or your profile.
        </div>
      </ICard>
    </div>
  );
}
