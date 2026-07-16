import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import SetHtmlLang from "@/components/i18n/SetHtmlLang";

/** Korean subtree layout — wave 1 of the locale projection (§4.3, §6.4).
 *  Declares the locale to client chrome (LocaleProvider) and flips <html lang>
 *  on the client (SetHtmlLang). No markup of its own: the projection reuses the
 *  same components as EN, never a fork. A new language copies this file. */
export default function KoLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider locale="ko">
      <SetHtmlLang lang="ko" />
      {children}
    </LocaleProvider>
  );
}
