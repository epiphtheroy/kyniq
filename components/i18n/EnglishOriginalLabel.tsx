import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/** The "영어 원문" marker for a block left in English on a projected page.
 *  (정본: HANDOFF-KO프로젝션-한국어사이트.md §1.1 decision ②)
 *
 *  Renders a small inline label — nothing else, so it can sit inside any section
 *  without a wrapping <div> that would disturb a grid or flex layout. The section
 *  it heads separately carries lang="en" (set on the existing <section> element),
 *  so a browser's "translate" reaches only that block, not the Korean chrome
 *  around it. On the source locale it renders nothing.
 *
 *  The site cannot toggle Chrome's built-in translation from a page (no browser
 *  API; Google's website widget is retired for commercial sites) — lang + this
 *  label are the supported affordance and they are enough.
 */
export default function EnglishOriginalLabel({ locale }: { locale: Locale }) {
  if (locale === DEFAULT_LOCALE) return null;
  return (
    <span
      className="i18n-en-orig"
      lang={locale}
      title={t(locale, "This section is in English — your browser can translate it.")}
    >
      {t(locale, "English original")}
    </span>
  );
}
