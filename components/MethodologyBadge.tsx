import Link from "next/link";

/**
 * MethodologyBadge — a tiny circled "?" that links to the methodology docs
 * (optionally a specific doc or anchor). Drop it beside any computed number,
 * ranking, verdict or generated line so a reader can always reach the
 * explanation of how it was made. Styling: .mth-badge in globals.css.
 */
export default function MethodologyBadge({
  href = "/methodology",
  label = "How this is made — methodology",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link href={href} className="mth-badge" aria-label={label} title={label}>
      <span aria-hidden="true">?</span>
    </Link>
  );
}
