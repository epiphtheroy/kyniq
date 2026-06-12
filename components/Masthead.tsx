"use client";

/**
 * Masthead — Economist-style mobile chrome.
 * Sticky white header: hamburger · red-box wordmark · search · CTA.
 * Below: horizontally scrollable section nav strip.
 * Hamburger opens a full-screen drawer; magnifier toggles a search bar.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SearchTypeahead from "./SearchTypeahead";
import UserMenu from "./UserMenu";

type User = {
  id: string;
  username: string;
  display_name: string;
  role: string;
} | null;

const NAV = [
  { href: "/", label: "The latest" },
  { href: "/film", label: "Films" },
  { href: "/director", label: "Directors" },
  { href: "/frames", label: "Questions" },
  { href: "/ask", label: "Ask a question" },
  { href: "/about", label: "About" },
];

function IconMenu() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M2.5 5.5h17M2.5 11h17M2.5 16.5h17" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M4.5 4.5l13 13M17.5 4.5l-13 13" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="21" height="21" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="9.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14.5 14.5L20 20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function LogoBox() {
  return (
    <Link href="/" className="logobox" aria-label="FilmCurio home">
      <span className="logobox__line">Film</span>
      <span className="logobox__line">Curio</span>
    </Link>
  );
}

export default function Masthead({ user }: { user: User }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeAll = () => {
    setMenuOpen(false);
    setSearchOpen(false);
  };

  return (
    <>
      <header className="masthead">
        <div className="masthead__row">
          <button
            className="iconbtn"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <IconMenu />
          </button>

          <LogoBox />

          <div className="masthead__spacer" />

          <button
            className="iconbtn"
            aria-label="Search"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <IconSearch />
          </button>

          <Link href="/ask" className="btn-cta">
            Ask
          </Link>

          {user ? (
            <UserMenu
              username={user.username}
              displayName={user.display_name}
              role={user.role}
            />
          ) : (
            <Link href="/login" className="masthead__signin">
              Log in
            </Link>
          )}
        </div>

        <nav className="navstrip" aria-label="Sections">
          <div className="navstrip__inner">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                data-active={
                  n.href === "/"
                    ? pathname === "/"
                    : pathname === n.href || pathname.startsWith(n.href + "/")
                }
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>

        {searchOpen && (
          <div className="searchbar">
            <div className="searchbar__inner">
              <SearchTypeahead autoFocus onNavigate={closeAll} />
            </div>
          </div>
        )}
      </header>

      {menuOpen && (
        <div className="drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="drawer__head">
            <button
              className="iconbtn"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <IconClose />
            </button>
            <LogoBox />
            <div className="masthead__spacer" />
            <Link href="/ask" className="btn-cta" onClick={closeAll}>
              Ask
            </Link>
          </div>

          <div className="drawer__body">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="drawer__link"
                onClick={closeAll}
              >
                {n.label}
                <span className="chev">›</span>
              </Link>
            ))}

            <div className="drawer__label">Account</div>
            {user ? (
              <>
                <Link href={`/u/${user.username}`} className="drawer__sub" onClick={closeAll}>
                  Profile — {user.display_name || user.username}
                </Link>
                <Link href="/settings" className="drawer__sub" onClick={closeAll}>
                  Settings
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="drawer__sub" onClick={closeAll}>
                  Log in
                </Link>
                <Link href="/signup" className="drawer__sub" onClick={closeAll}>
                  Create an account
                </Link>
              </>
            )}

            <div className="drawer__label">More</div>
            <Link href="/contact" className="drawer__sub" onClick={closeAll}>
              Contact
            </Link>
            <Link href="/guidelines" className="drawer__sub" onClick={closeAll}>
              Community guidelines
            </Link>
            <Link href="/terms" className="drawer__sub" onClick={closeAll}>
              Terms
            </Link>
            <Link href="/privacy" className="drawer__sub" onClick={closeAll}>
              Privacy
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
