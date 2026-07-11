"use client";

// TVListPicker — the YouTube-style "Save to…" sheet. Given one or more program
// slugs, it lists the visitor's personal TV lists with checkboxes (checked when
// every given slug is already in the list), toggles membership, and can create
// a new list containing the slugs. Signed-out visitors get a login link.
import { useEffect, useState } from "react";
import { addToList, createList, fetchMyLists, removeFromList, type TVUserList } from "@/lib/tvUserLists";

export default function TVListPicker({ slugs, onClose, onChanged }: {
  slugs: string[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [lists, setLists] = useState<TVUserList[] | null | undefined>(undefined); // undefined=loading, null=signed out
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMyLists().then((l) => { if (alive) setLists(l); });
    return () => { alive = false; };
  }, []);

  const hasAll = (l: TVUserList) => slugs.every((s) => l.slugs.includes(s));

  const toggle = async (l: TVUserList) => {
    if (busy) return;
    setBusy(l.id);
    const on = hasAll(l);
    const ok = on ? await removeFromList(l.id, slugs) : await addToList(l.id, slugs);
    if (ok) {
      setLists((cur) => (cur ?? []).map((x) => x.id !== l.id ? x : {
        ...x,
        slugs: on ? x.slugs.filter((s) => !slugs.includes(s)) : [...x.slugs, ...slugs.filter((s) => !x.slugs.includes(s))],
      }));
      onChanged?.();
    }
    setBusy(null);
  };

  const make = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy("new");
    const l = await createList(t, slugs);
    if (l) {
      setLists((cur) => [{ ...l }, ...(cur ?? [])]);
      setTitle("");
      onChanged?.();
    }
    setBusy(null);
  };

  return (
    <div className="tvlp-veil" onClick={onClose} role="dialog" aria-label="Save to list">
      <div className="tvlp" onClick={(e) => e.stopPropagation()}>
        <div className="tvlp-h">
          <span>Save {slugs.length > 1 ? `${slugs.length} programs` : ""} to…</span>
          <button className="tvlp-x" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {lists === undefined ? (
          <p className="tvlp-note">Loading your lists…</p>
        ) : lists === null ? (
          <p className="tvlp-note">
            <a href={`/login?next=${encodeURIComponent("/tv")}`}>Sign in</a> to save programs into your own lists.
          </p>
        ) : (
          <>
            <ul className="tvlp-list">
              {lists.map((l) => (
                <li key={l.id}>
                  <label className={busy === l.id ? "busy" : ""}>
                    <input type="checkbox" checked={hasAll(l)} onChange={() => toggle(l)} disabled={busy != null} />
                    <span className="tvlp-t">{l.title}</span>
                    <span className="tvlp-n">{l.slugs.length}</span>
                  </label>
                </li>
              ))}
              {!lists.length ? <li className="tvlp-note">No lists yet — make one below.</li> : null}
            </ul>
            <div className="tvlp-new">
              <input
                type="text" placeholder="New list name…" value={title} maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") make(); }}
              />
              <button onClick={make} disabled={!title.trim() || busy != null}>Create</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
