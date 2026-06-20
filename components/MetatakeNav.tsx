import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import AccountMenu from "@/components/AccountMenu";
import RandomMenu from "@/components/RandomMenu";

/** Light wiki-style top nav for the Metatake pages. */
export default function MetatakeNav({ active }: { active?: "films" | "directors" | "takes" | "genres" | "latest" | "trending" | "tropes" | "ask" | "chat" | "rag" | "concepts" | "blog" }) {
  const item = (k: string, href: string, label: string) => (
    <Link href={href} className={active === k ? "active" : undefined}>{label}</Link>
  );
  return (
    <div className="mt-nav">
      <Link href="/" className="brand">metatake</Link>
      <nav style={{ display: "flex", gap: 14 }}>
        {item("ask", "/ask", "Ask")}
        {item("chat", "/chat", "💬 Chat")}
        {item("latest", "/latest", "Latest")}
        {item("trending", "/trending", "Trending")}
        {item("films", "/film", "Films")}
        {item("directors", "/director", "Directors")}
        {item("tropes", "/tropes", "Tropes")}
        {item("concepts", "/concept", "Concepts")}
        {item("takes", "/meta-takes", "Meta takes")}
        {item("blog", "/blog", "Blog")}
      </nav>
      <span style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center", color: "var(--subtle)", fontSize: 13 }}>
        <SearchBox variant="nav" />
        <RandomMenu />
        <AccountMenu />
      </span>
    </div>
  );
}
