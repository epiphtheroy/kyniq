/** Inspector primitive — labeled mini progress bar (.crow): label · track · value.
 *  null value renders an empty track and an em dash (no fake numbers). */

export default function CRow({ label, value, max = 100, color, text }: {
  label: string;
  /** 0..max, or null for "not measured". */
  value: number | null;
  max?: number;
  /** CSS color for the fill (defaults to var(--safe)). */
  color?: string;
  /** Override for the value text (e.g. "0.82"); default = rounded value. */
  text?: string;
}) {
  const pct = value == null || max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="crow">
      <span className="cl">{label}</span>
      <span className="cbar"><i style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} /></span>
      <span className="cvv">{text ?? (value == null ? "—" : Math.round(value))}</span>
    </div>
  );
}
