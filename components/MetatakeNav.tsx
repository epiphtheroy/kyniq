import Link from "next/link";

/** Light wiki-style top nav for the Metatake pages. */
export default function MetatakeNav({ active }: { active?: "films" | "directors" | "takes" | "genres" }) {
  const item = (k: string, href: string, label: string) => (
    <Link href={href} className={active === k ? "active" : undefined}>{label}</Link>
  );
  return (
    <div className="mt-nav">
      <Link href="/" className="brand">metatake</Link>
      <nav style={{ display: "flex", gap: 14 }}>
        {item("films", "/film", "Films")}
        {item("directors", "/director", "Directors")}
        {item("takes", "/meta-takes", "Meta takes")}
        {item("genres", "/genre", "Genres")}
      </nav>
      <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", color: "var(--subtle)", fontSize: 13 }}>
        <Link href="/random/take" aria-label="Random meta take" style={{ color: "var(--subtle)" }}>Random</Link>
      </span>
    </div>
  );
}
