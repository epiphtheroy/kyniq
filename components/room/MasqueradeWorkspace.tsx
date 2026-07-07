"use client";
/** /room/masquerade — Masquerade (slow pair · one masked partner a day · midnight-KST rotation).
 *  REAL: me_today_pair() — deterministic daily matching (consistent both ways) · sync = cosine of
 *  the two v_loved vectors · only the intersection (shared anchors / shared lineages) is exposed,
 *  and that partial exposure is ENFORCED AT THE RPC LEVEL: the server never returns names,
 *  individual ratings, full taste, or the partner's uuid.
 *  "Remove your mask" = me_pair_reveal() — mutual consent; the partner's public profile opens only
 *  when both unmask AND their portfolio is public. No partner → no fake one (honest empty).
 *  v3 (spec §3.14): single card above the fold, ONE labeled primary button for the whole reveal
 *  state machine, rules copy collapsed into one "How this works" brief card, memoized countdown. */
import { useMemo, useState, useEffect, useCallback, memo } from "react";
import { num } from "@/lib/room/format";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import FormingCard from "./FormingCard";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import ActBar, { type Act } from "./insp/ActBar";

export type TodayPair = {
  has_partner: boolean;
  reason?: string; // forming | ineligible | odd_out
  sync_pct?: number | string | null;
  shared_anchors?: { label: string; films: number }[] | null;
  shared_lineages?: { label: string; films: number }[] | null;
  my_consent?: boolean;
  partner_consent?: boolean;
  revealed?: { username?: string; display_name?: string; public?: boolean } | null;
  loved_n: number;
  forming: boolean;
  candidates: number;
};
export type SigRow = { kind: string; label: string; films: number };
export type PairHist = { day: string; sync_pct: number | string | null; top_anchor: string | null };

/* ── midnight-KST countdown (isolated: the 1s tick re-renders ONLY this leaf) ── */

function pad(n: number) { return (n < 10 ? "0" : "") + n; }
function kstCountdown(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 3600000);
  const next = new Date(kst.getFullYear(), kst.getMonth(), kst.getDate() + 1, 0, 0, 0);
  const diff = Math.max(0, next.getTime() - kst.getTime());
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const MidnightCountdown = memo(function MidnightCountdown() {
  const [txt, setTxt] = useState(kstCountdown);
  useEffect(() => {
    const t = setInterval(() => setTxt(kstCountdown()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="mq-cd">{txt}</span>;
});

/* ── mask glyphs ── */

function MaskSvg({ dashed = false }: { dashed?: boolean }) {
  return dashed ? (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <ellipse cx="38" cy="38" rx="30" ry="34" fill="#1c1c20" stroke="var(--sub)" strokeWidth="1.3" strokeDasharray="4 3" />
      <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
      <path d="M24 51 Q38 51 52 51" fill="none" stroke="var(--sub)" strokeWidth="1.2" />
    </svg>
  ) : (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
      <ellipse cx="38" cy="38" rx="30" ry="34" fill="var(--masque-iris)" stroke="var(--masque)" strokeWidth="1.3" />
      <ellipse cx="27" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" /><ellipse cx="49" cy="34" rx="6.5" ry="4.5" fill="#0A0A0B" />
      <path d="M24 50 Q38 56 52 50" fill="none" stroke="var(--masque)" strokeWidth="1.2" />
    </svg>
  );
}

/* ── 30-day sync trend (me_pair_history; days without a recorded sync are skipped — no fake points) ── */

const SyncTrend = memo(function SyncTrend({ hist }: { hist: PairHist[] }) {
  const pts = hist
    .map((h) => ({ day: h.day, s: num(h.sync_pct) }))
    .filter((p): p is { day: string; s: number } => p.s != null)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (pts.length < 2) {
    return (
      <div className="mq-trend">
        <span className="lbl">Sync trend · 30d</span>
        <span className="none">Not enough history for a trend yet.</span>
      </div>
    );
  }
  const w = 220, h = 36, padPx = 3;
  const min = Math.min(...pts.map((p) => p.s));
  const max = Math.max(...pts.map((p) => p.s));
  const span = Math.max(1, max - min);
  const d = pts
    .map((p, i) => {
      const x = padPx + (i * (w - padPx * 2)) / (pts.length - 1);
      const y = h - padPx - ((p.s - min) / span) * (h - padPx * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="mq-trend">
      <span className="lbl">Sync trend · 30d</span>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path d={d} fill="none" stroke="var(--masque)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="rng">{Math.round(min)}–{Math.round(max)}</span>
    </div>
  );
});

/* ── workspace ── */

export default function MasqueradeWorkspace({ initial, sig, hist }: { initial: TodayPair; sig: SigRow[]; hist: PairHist[] }) {
  const { setDefault } = useInspector();
  const { supabase, say } = useRoomActions();
  const [pair, setPair] = useState<TodayPair>(initial);
  const [revealing, setRevealing] = useState(false);

  const anchors = useMemo(() => sig.filter((s) => s.kind === "anchor"), [sig]);
  const lineages = useMemo(() => sig.filter((s) => s.kind === "lineage"), [sig]);
  const hasPartner = pair.has_partner;
  const forming = pair.forming;
  const sync = num(pair.sync_pct);
  const sharedAnchors = pair.shared_anchors ?? [];
  const sharedLineages = pair.shared_lineages ?? [];
  const revealedUser = pair.revealed?.username ?? null;
  const revealedName = pair.revealed?.display_name ?? revealedUser;
  const revealedBlocked = pair.revealed != null && pair.revealed.public === false;
  const oddOut = pair.reason === "odd_out";

  /* Record MY consent. The profile opens only on mutual consent + a public partner profile. */
  const doReveal = useCallback(async () => {
    if (revealing) return;
    setRevealing(true);
    const { data, error } = await supabase.rpc("me_pair_reveal");
    setRevealing(false);
    if (error) { say(`Couldn't record consent — ${error.message}`); return; }
    const next = data as TodayPair | null;
    if (!next) return;
    setPair(next);
    if (next.revealed?.username) say("Both masks are off — the public profile is open.");
    else if (next.revealed && next.revealed.public === false) say("Both unmasked, but their profile is private — the rules stop here.");
    else if (next.my_consent && !next.partner_consent) say("Your mask is off — when they unmask too, the public profile opens.");
  }, [supabase, revealing, say]);

  /* Page brief — the triple-duplicated rules copy of v2, collapsed into ONE
     "How this works" card (spec §3.14.1), plus my measured sync material. */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-masks-theater" title="How this works">
          <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>
            One person a day, matched on taste. You pass the day together behind masks — not a DM, not public. Rotates at midnight (KST).
          </div>
          <div style={{ marginTop: 9 }}>
            <KV k="Sync + shared anchors" v={<span style={{ color: "var(--safe)" }}>Shown</span>} />
            <KV k="Shared lineages (titles only)" v={<span style={{ color: "var(--safe)" }}>Shown</span>} />
            <KV k="Names · photos" v={<span style={{ color: "var(--sub)", fontStyle: "italic" }}>Hidden</span>} />
            <KV k="Individual ratings · full taste" v={<span style={{ color: "var(--sub)", fontStyle: "italic" }}>Hidden</span>} />
          </div>
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, lineHeight: 1.5 }}>
            Partial exposure is enforced at the <b style={{ color: "var(--mut)" }}>RPC level</b>, not the screen — the server never returns names, individual ratings, or full taste. Unmasking is <b style={{ color: "var(--mut)" }}>mutual consent + a public profile</b> only. Sync = cosine of the two v_loved vectors; when a vector sample is too thin, you see {"“"}forming{"”"} instead of a hard number.
          </div>
        </ICard>
        <ICard icon="ti-fingerprint" title="My sync material · v_loved" right="measured">
          {forming ? (
            <div style={{ fontSize: 11.5, color: "var(--forming)", fontStyle: "italic" }}>Taste vector forming (loved {pair.loved_n}/8) — you enter the pool at 8.</div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--safe)" }}>Taste vector locked · {pair.loved_n} loved films — you are in the pool.</div>
          )}
          {anchors.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 9 }}>
              {anchors.map((a) => <span key={a.label} className="anchorchip" title={`Recurs across ${a.films} of your loved films`}>{a.label}</span>)}
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--sub)", fontStyle: "italic", marginTop: 9 }}>No anchors yet — rate more films ★4.5+.</div>
          )}
          {lineages.length ? (
            <div style={{ marginTop: 9 }}>
              {lineages.map((l) => <KV key={l.label} k={<span style={{ fontFamily: "var(--ser)", fontSize: 12.5 }}>{l.label}</span>} v={`${l.films} films`} />)}
            </div>
          ) : null}
          <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8 }}>Only the overlap with your partner ever surfaces — the rest stays masked.</div>
        </ICard>
      </div>
    );
  }, [setDefault, forming, pair.loved_n, anchors, lineages]);

  /* Reveal state machine → ONE labeled button (red primary only when actionable). */
  const revealAct: Act = !hasPartner
    ? {
        label: <><i className="ti ti-mask-off" /> {oddOut ? "No partner today (odd one out)" : "No partner today"}</>,
        disabled: true,
        title: "The pool reshuffles at midnight (KST).",
      }
    : revealedUser
      ? {
          label: <><i className="ti ti-mask-off" /> Both unmasked — view profile</>,
          href: `/u/${revealedUser}`,
          primary: true,
          title: `Open ${revealedName}'s public profile`,
        }
      : revealedBlocked
        ? {
            label: <><i className="ti ti-mask-off" /> Mutual, but their profile is private</>,
            disabled: true,
            title: "Reveal opens a public profile only — the rules stop here.",
          }
        : pair.my_consent
          ? {
              label: <><i className="ti ti-mask-off" /> Waiting for them (you{"’"}re unmasked)</>,
              disabled: true,
              title: "Your consent is recorded — the profile opens when they unmask too.",
            }
          : {
              label: <><i className="ti ti-mask-off" /> {revealing ? "Recording…" : "Remove your mask"}</>,
              primary: true,
              onClick: doReveal,
              title: "Mutual consent only — the public profile opens when both unmask.",
            };

  /* Forming gate — Masquerade opens at 8 loved films. */
  if (forming) {
    return (
      <div className="mainpad">
        <h1 className="secttl">Masquerade</h1>
        <p className="secsub">One masked partner a day, matched on taste. Rotates at midnight (KST).</p>
        <FormingCard feature="Masquerade" need={8} have={pair.loved_n} unit="loved films (★4.5+)">
          One person a day, matched on your loved films. Sync = cosine of two v_loved vectors — it needs 8 loved films to form. No fake partners before that.
        </FormingCard>
      </div>
    );
  }

  return (
    <div className="mainpad">
      <h1 className="secttl">Masquerade</h1>
      <p className="secsub">
        One masked partner a day. <span className="gloss" title="Sync — cosine similarity of the two v_loved vectors (0–100)">Sync</span> = the cosine of two loved-film vectors. Only the intersection is ever shown; names, ratings and full taste stay masked. Rotates at midnight (KST).
      </p>

      <div className="mq-card">
        {hasPartner ? (
          <>
            {/* Two masks + sync — the whole story above the fold */}
            <div className="mq-pair">
              <div className="mq-mask">
                <MaskSvg />
                <div className="nm">You</div>
                <div className="rl">{pair.my_consent ? "Unmasked" : "Masked"}</div>
              </div>
              <div className="mq-sync">
                <div className={`pv${sync == null ? " empty" : ""}`}>{sync != null ? sync : "forming"}</div>
                <div className="pl">SYNC</div>
                <div className="fm">v_loved cosine</div>
              </div>
              <div className="mq-mask">
                <MaskSvg />
                <div className="nm">{revealedUser ? revealedName : "Partner"}</div>
                <div className="rl">
                  {revealedUser ? "Unmasked · public profile"
                    : revealedBlocked ? "Unmasked · profile private"
                    : pair.partner_consent ? "Unmasked · waiting for you"
                    : "Masked"}
                </div>
              </div>
            </div>

            {/* Intersection — only the overlap, server-enforced */}
            <div className="mq-ident">
              <div className="lbl">Shared anchors · only the overlap (server-enforced)</div>
              {sharedAnchors.length ? (
                <div className="chips">
                  {sharedAnchors.map((a) => (
                    <span key={a.label} className="anchorchip" title={`Crosses ${a.films} loved films between you`}>
                      {a.label} <span className="n">{a.films}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mq-none">No overlapping anchors — two different readers today. That{"’"}s an answer too.</div>
              )}
              {sharedLineages.length ? (
                <div style={{ marginTop: 10 }}>
                  <div className="lbl">Shared lineages (titles only)</div>
                  {sharedLineages.map((l) => (
                    <div className="mq-row" key={l.label}>
                      <span className="nm" title={l.label}>{l.label}</span>
                      <span className="ct">{l.films} films</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <ActBar acts={[revealAct]} style={{ marginTop: 14 }} />
            <SyncTrend hist={hist} />
          </>
        ) : (
          /* No-partner empty — one dashed mask + one line, no full scaffolding. */
          <div className="mq-empty">
            <MaskSvg dashed />
            <div className="line">
              {oddOut
                ? "Odd headcount today — one person sits out. The pool reshuffles at midnight (KST)."
                : "No partner yet — one appears at midnight (KST) once another viewer locks a taste vector. No fake numbers."}
            </div>
            <ActBar acts={[revealAct]} style={{ marginTop: 12 }} />
          </div>
        )}

        {/* Card footer: veil chips + rotation countdown */}
        <div className="mq-foot">
          {hasPartner ? (
            <div className="mq-veil" title="Masquerade · partial-exposure rules — details in the Brief">
              <span className="vc show"><i className="ti ti-eye" /> Sync</span>
              <span className="vc show"><i className="ti ti-eye" /> Shared anchors</span>
              <span className="vc show"><i className="ti ti-eye" /> Shared lineages</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> Names · photos</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> Individual ratings</span>
              <span className="vc hide"><i className="ti ti-eye-off" /> Full taste</span>
            </div>
          ) : null}
          <div className="mq-rotate">
            <i className="ti ti-clock-hour-12" /> New partner at midnight (KST) · <MidnightCountdown />
          </div>
        </div>
      </div>
    </div>
  );
}
