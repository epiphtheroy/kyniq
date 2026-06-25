"use client";

/**
 * SaveChip — tiny bookmark toggle for a non-film entity (a take / Strong Misreading, trope, etc.)
 * that reads from UserSavesProvider, so a page full of cards costs ONE load, not one query per chip.
 * Use SaveButton instead for a single standalone entity (director / lineage hub).
 */
import { useUserSaves } from "@/components/UserSavesProvider";

export default function SaveChip({
  entityType, entityRef, title = "Save this reading",
}: { entityType: string; entityRef: string; title?: string }) {
  const ctx = useUserSaves();
  if (!ctx || !ctx.ready) return <span className="svc svc--ph" aria-hidden="true" />;
  const on = ctx.has(entityType, entityRef);
  return (
    <button
      type="button"
      className={`svc${on ? " on" : ""}`}
      aria-pressed={on}
      title={on ? "Saved" : title}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); ctx.toggle(entityType, entityRef); }}
    >
      <span className="svc-ic">{on ? "🔖" : "+"}</span>{on ? "Saved" : "Save"}
    </button>
  );
}
