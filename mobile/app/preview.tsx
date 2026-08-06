// Screen index for previewing the app on a laptop. DEV + web only.
//
// Expo Go and the simulator give you the tab bar and nothing else: the film
// page, the drive, a list, onboarding, the reader — every screen you reach by
// tapping through data — needs a slug you have to know. On web there is a URL
// bar, but only if you know the URL. This is that list, clickable.
//
// It also carries the language switch, because the reason to look at these
// screens side by side is usually to check whether they speak Korean.
//
// Never ships: `__DEV__` is false in any release build, and the route renders
// nothing but a note there. Nothing else imports it.
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Hairline, Screen, SectionTitle, Serif, Tactile, Ui } from "../src/components/ui";
import { UI_LOCALES, type UILocale } from "../src/editions";
import { usePrefs } from "../src/state/prefs";
import { brand, fs, radius, sp, usePalette } from "../src/theme";

/** Slugs verified present in production (2026-08-06). A preview index that
 *  links to a 404 is worse than no index — you cannot tell a broken screen
 *  from a missing row. */
const GROUPS: { title: string; note?: string; items: { label: string; sub?: string; href: string }[] }[] = [
  {
    title: "탭",
    items: [
      { label: "오늘 밤", sub: "덱 · 한 줄 초대문", href: "/" },
      { label: "탐색", sub: "장르 · 연대 · 컬렉션", href: "/search" },
      { label: "내비게이터", sub: "목적지 · 목록 검색", href: "/navigator" },
      { label: "나", sub: "원장 · 설정", href: "/my" },
      { label: "지도", sub: "탭에서는 내려온 화면", href: "/map" },
    ],
  },
  {
    title: "영화",
    note: "《동경 이야기》는 title_ko가 없는 영화 — 폴백이 어떻게 보이는지 확인용",
    items: [
      { label: "기생충", sub: "초대문 · 계보 · 촬영지 · 생애", href: "/film/parasite-2019" },
      { label: "화양연화", href: "/film/in-the-mood-for-love-2000" },
      { label: "잠입자", href: "/film/stalker-1979" },
      { label: "Tokyo Story", sub: "한국어 제목 없음", href: "/film/tokyo-story-1953" },
    ],
  },
  {
    title: "감독",
    note: "알모도바르는 픽 세트가 두 벌 — 추천이 두 번씩 보이는 데이터 문제",
    items: [
      { label: "봉준호", sub: "초상 · 어디서 시작할까 · 생애 13", href: "/director/bong-joon-ho" },
      { label: "왕가위", href: "/director/wong-kar-wai" },
      { label: "오즈 야스지로", href: "/director/yasujiro-ozu" },
      { label: "페드로 알모도바르", sub: "중복 픽", href: "/director/pedro-almodovar" },
    ],
  },
  {
    title: "목록 · 주행",
    items: [
      { label: "황금종려상", sub: "리스트 화면", href: "/list/cannes?label=Palme%20d%27Or" },
      { label: "BFI 영국 영화 100선", href: "/list/national-gb-bfi-100-british?label=BFI%20Top%20100%20British%20Films" },
      { label: "주행 — 황금종려상", sub: "턴바이턴", href: "/navigator/drive?lineage=cannes&label=Palme%20d%27Or" },
      { label: "주행 — 봉준호", sub: "감독 정복", href: "/navigator/drive?dir=bong-joon-ho" },
    ],
  },
  {
    title: "흐름",
    items: [
      { label: "온보딩", sub: "환영 · 로그인 · 국가 · 언어", href: "/onboarding" },
      { label: "기록 가져오기", sub: "Letterboxd · IMDb · Netflix", href: "/connect" },
      { label: "리더", sub: "웹 페이지 — 한국어면 /ko/로 연다", href: "/read?path=%2Ffilm%2Fparasite-2019" },
    ],
  },
];

export default function PreviewIndex() {
  const router = useRouter();
  const pal = usePalette();
  const { locale, contentLang, country, set } = usePrefs();

  // Warm every route chunk while you are reading the list.
  //
  // The dev server serves the app with lazy=true on a 10MB bundle, so the FIRST
  // press on a tab fetches and transforms that route on demand — several seconds
  // during which the screen simply does not change, which reads as a dead tab
  // rather than as loading. (It is not broken; it is cold.) Prefetching here
  // means the taps after this page are the taps a phone would give you.
  //
  // Dynamic routes need a real parameter to resolve to a chunk, hence the slugs.
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== "web") return;
    const routes = [
      "/", "/search", "/navigator", "/my", "/map",
      "/film/parasite-2019", "/director/bong-joon-ho",
      "/list/cannes", "/navigator/drive", "/connect", "/onboarding", "/read",
    ];
    // Serially and idly: firing twelve chunk builds at once makes Metro slower
    // than the thing being avoided.
    let i = 0;
    const id = setInterval(() => {
      if (i >= routes.length) return clearInterval(id);
      try {
        router.prefetch(routes[i] as never);
      } catch {
        // a route that will not prefetch still navigates; this is an optimisation
      }
      i++;
    }, 250);
    return () => clearInterval(id);
  }, [router]);

  if (!__DEV__ || Platform.OS !== "web") {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", padding: sp.s5 }}>
        <Ui color={pal.muted} style={{ textAlign: "center" }}>
          This index only exists in a web dev build.
        </Ui>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: sp.s6 }}>
        <View style={{ padding: sp.s4, gap: sp.s2 }}>
          <Serif size={fs.x2} bold>
            화면 목록
          </Serif>
          <Ui size={fs.sm} color={pal.muted}>
            개발용. 앱 언어 {locale} · 제목 {contentLang} · 국가 {country}
          </Ui>
        </View>

        {/* The switch that makes this page worth having. */}
        <SectionTitle sub="바꾸면 이 자리에서 바로 반영됩니다">앱 언어</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp.s2, paddingHorizontal: sp.s4 }}>
          {UI_LOCALES.map((l) => {
            const on = l.code === locale;
            return (
              <Tactile key={l.code} onPress={() => set({ locale: l.code as UILocale })}>
                <View
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: on ? brand.accent : pal.hairline,
                    backgroundColor: on ? brand.accent : "transparent",
                  }}
                >
                  <Ui size={fs.sm} weight="600" color={on ? "#fff" : pal.ink}>
                    {l.label}
                  </Ui>
                </View>
              </Tactile>
            );
          })}
        </View>

        {GROUPS.map((g) => (
          <View key={g.title} style={{ marginTop: sp.s5 }}>
            <SectionTitle sub={g.note}>{g.title}</SectionTitle>
            <View
              style={{
                marginHorizontal: sp.s4,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: pal.hairline,
                backgroundColor: pal.card,
                overflow: "hidden",
              }}
            >
              {g.items.map((it, i) => (
                <View key={it.href}>
                  {i > 0 ? <Hairline /> : null}
                  <Tactile onPress={() => router.push(it.href as never)}>
                    <View style={{ paddingVertical: sp.s3, paddingHorizontal: sp.s4, gap: 2 }}>
                      <Ui size={fs.md} weight="600">
                        {it.label}
                      </Ui>
                      {it.sub ? (
                        <Ui size={fs.xs} color={pal.muted}>
                          {it.sub}
                        </Ui>
                      ) : null}
                      <Ui size={fs.xs} color={pal.subtle}>
                        {it.href}
                      </Ui>
                    </View>
                  </Tactile>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ padding: sp.s4, marginTop: sp.s4 }}>
          <Ui size={fs.xs} color={pal.subtle}>
            돌아오려면 주소창에 /preview. 앱은 프로덕션 API(metatake.net)를 봅니다 — 서버가 번역하는
            산문은 웹 배포가 main에 닿은 뒤에 한국어로 바뀝니다.
          </Ui>
        </View>
      </ScrollView>
    </Screen>
  );
}
