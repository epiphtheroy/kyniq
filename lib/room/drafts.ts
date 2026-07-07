/** Local take-draft housekeeping. Draft keys are uid-scoped
 *  (mt_take_draft:{uid}:{draftId} — see components/room/TakesWorkspace.tsx);
 *  sign-out purges every draft key (any uid, plus pre-scoping legacy keys) so
 *  a shared browser keeps no plaintext drafts behind. */
export function clearLocalTakeDrafts() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("mt_take_draft:")) localStorage.removeItem(k);
    }
  } catch { /* ignore */ }
}
