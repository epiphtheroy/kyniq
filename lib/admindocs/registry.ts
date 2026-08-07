/**
 * Admin Docs — internal, admin-only document library (single source of truth).
 *
 * Mirrors lib/docs/registry.ts but scoped to /admin/docs so it never touches the
 * public methodology registry, sitemap, or nav. Drives the /admin/docs index and
 * the /admin/docs/[slug] reader's metadata. Document BODIES live separately in
 * lib/admindocs/content/*.ts (markdown strings, rendered by lib/docs/md.ts).
 *
 * To add a doc: (1) add a lib/admindocs/content/<slug>.ts file exporting a
 * markdown string (no backticks / no ${...} — md.ts contract), (2) wire it into
 * lib/admindocs/content/index.ts, (3) add one ADMIN_DOCS row here.
 */

export type AdminDocCategory = {
  key: string;
  label: string;
  blurb: string;
};

export type AdminDocMeta = {
  slug: string;
  nav: string; // short label for the index list
  title: string; // H1 + <title> lead
  desc: string; // standfirst + description
  category: string; // AdminDocCategory.key
  updated?: string; // ISO date, shown in the reader
};

export const ADMIN_DOC_CATEGORIES: AdminDocCategory[] = [
  { key: "growth", label: "성장 · BD", blurb: "배포·발견 병목을 푸는 비즈니스 접점과 파트너십." },
  { key: "strategy", label: "전략", blurb: "제품 방향·수익화·포지셔닝." },
  { key: "ops", label: "운영", blurb: "파이프라인·데이터·운영 노트." },
];

export const ADMIN_DOCS: AdminDocMeta[] = [
  {
    slug: "talk-layer",
    category: "strategy",
    nav: "쌍방향성 · Talk 레이어",
    title: "쌍방향성 기획 — Talk 레이어",
    desc: "대화의 주소는 영화·figure·감독, 우리 글은 인용 임베드·@ 첨부(주소는 세계, 첨부는 글). Talk·Quote·광장 3층 + 상주 캐스트는 Tray만 가동(정보 딜리버리 전용·무인사·LLM-0, Draft/Prism 보류)과 콜드스타트·안전·기술 설계 + 공개 프로필(/u)·마이룸 접속점. 오너 결정 D1~D9 대기.",
    updated: "2026-08-07",
  },
  {
    slug: "business-touchpoints",
    category: "growth",
    nav: "비즈니스 접점 지도",
    title: "비즈니스 접점 지도",
    desc: "콘텐츠·로직 자산을 지렛대로, 오너가 컨택 가능한 13개 클러스터·약 48개 그룹과 각 그룹의 명분·접점 유형(복수)을 정리한 지도.",
    updated: "2026-07-14",
  },
];

export function adminDocHref(slug: string): string {
  return `/admin/docs/${slug}`;
}

export function adminDocBySlug(slug: string): AdminDocMeta | undefined {
  return ADMIN_DOCS.find((d) => d.slug === slug);
}

export function adminCategoryBySlug(slug: string): AdminDocCategory | undefined {
  const d = adminDocBySlug(slug);
  return d ? ADMIN_DOC_CATEGORIES.find((c) => c.key === d.category) : undefined;
}

export function adminDocsInCategory(key: string): AdminDocMeta[] {
  return ADMIN_DOCS.filter((d) => d.category === key);
}
