"use client";

import { useEffect, useState } from "react";

const ITEMS: [string, string][] = [
  ["definition", "Definition"],
  ["tropes", "Tropes"],
  ["films", "Films"],
  ["theorist", "The theorist"],
  ["map", "Connection map"],
  ["related", "Related concepts"],
];

// Sticky sub-nav with scroll-spy (ported from the concept mockup).
export default function ConceptSubnav({ items }: { items?: [string, string][] }) {
  const list = items ?? ITEMS;
  const [active, setActive] = useState(list[0][0]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          if (e.isIntersecting) setActive((e.target as HTMLElement).id);
        });
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    list.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [list]);

  return (
    <nav className="subnav">
      <div className="wrap">
        {list.map(([id, label]) => (
          <a key={id} href={`#${id}`} className={id === active ? "on" : ""}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
