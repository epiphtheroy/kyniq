/**
 * TermHighlight — makes the page's own subject (a concept, a theorist) pop
 * inside reading cards (2026-07-08 theory-layer pitch pass). Pure render, no
 * client state — safe in both server and client trees. Case-insensitive,
 * whole-string split; styling lives in read.css (mark.term-hl).
 */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export default function TermHighlight({ text, terms }: { text: string | null | undefined; terms: string[] }) {
  if (!text) return null;
  const clean = terms.map((t) => t.trim()).filter((t) => t.length >= 3);
  if (!clean.length) return <>{text}</>;
  const re = new RegExp(`(${clean.map(esc).join("|")})`, "gi");
  const lower = new Set(clean.map((t) => t.toLowerCase()));
  return (
    <>
      {text.split(re).map((part, i) =>
        lower.has(part.toLowerCase())
          ? <mark key={i} className="term-hl">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}
