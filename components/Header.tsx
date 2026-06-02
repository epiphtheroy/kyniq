import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="Kyniq home">
        <picture>
          <source
            srcSet="/kyniq-wordmark-dark.svg"
            media="(prefers-color-scheme: dark)"
          />
          <Image
            src="/kyniq-wordmark.svg"
            alt="Kyniq"
            width={80}
            height={26}
            priority
            style={{ height: 26, width: "auto" }}
          />
        </picture>
      </Link>

      <div className="field search" style={{ flex: 1, maxWidth: 380 }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        Search a film…
      </div>

      <Link href="/login" className="action-secondary">
        Sign in
      </Link>
    </header>
  );
}
