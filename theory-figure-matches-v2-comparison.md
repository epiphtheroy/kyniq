# 이론가 ↔ Figure 매칭 v2 (심화 gloss) + v1 비교

생성일 2026-06-26 · 같은 파이프라인(`text-embedding-3-small`, 1536d, 코사인) · v1 대비 **gloss만 변경**

---

## 무엇을 바꿨나

v2는 gloss에 **"이 이론가가 왜 이 개념을 만들 수밖에 없었는가"** — 개념의 가장 본질적이고 생생한 발생 지점 — 을 4~6문장으로 서술해 임베딩했습니다. (v1은 개념을 1~2문장으로 요약.)

핵심 발견을 먼저 요약하면:

| 이론가 | v2 판정 | 무엇이 달라졌나 | 최고 sim (v1→v2) |
|---|---|---|---|
| Mbembe | **개선** | 의료·죽음 일반 → **탈식민·노예제·아프리카**(알제리 전투, 투키 부키, 만덜레이) | 0.389 → 0.402 |
| Abbas | **강한 개선** | 일반적 소멸 → **실제 홍콩 반환기 영화**(첨밀밀, 타락천사) | 0.539 → 0.477* |
| Adam Smith | 소폭 개선 | 시장·탐욕 → **분업·노동**(윌 터너의 대장간, 시에라마드레 분배) 추가, 단 어휘 노이즈도 증가 | 0.313 → 0.406 |
| Adam Tooze | **혼합** | 시스템적 연쇄(애로/젠가) ↘ **금융가 개인·글로벌 자본**(더 게임, 카드 카운터) ↗ | 0.418 → 0.475 |
| Massanari | **개선** | 일반 소셜미디어 → **독성 게임문화·밈화**(엘르, 곤 걸, 어 히어로) | 0.363 → 0.439 |
| Aihwa Ong | **개선** | 난민 일반 → **패싱·초국적 정체성·이주노동**(첨밀밀 본토인, 블랙 비너스) | 0.383 → 0.462 |
| Badiou | **전환(개선)** | 형식적 파열 → **혁명·마오주의·militant**(중국 여인, 혁명 전야, 생쥐스트) | 0.427 → 0.420 |
| Hirschman | **부분 후퇴** | 정확한 이탈/항의/충성(위민 토킹) → **나치/전체주의 전기 노이즈**(존 오브 인터레스트, 유로파) | 0.379 → 0.422 |

\* Abbas는 최고 sim은 내렸지만 상위군 전체가 그의 **실제 연구 대상(홍콩)**으로 정렬됨 → 질적으로 대폭 개선.

**한 줄 결론:** 풍부한 gloss는 개념의 본질이 *생생한 이미지·역사적 장면*일 때(Mbembe·Abbas·Badiou·Massanari) 크게 개선되지만, gloss에 **이론가의 전기적 디테일**을 많이 넣으면 그 단어들(나치·독일계 유대인)이 어휘 노이즈가 되어 핵심 개념 매칭을 밀어낼 수 있습니다(Hirschman).

---

## 1. Achille Mbembe — v2 **개선**

> v2 추가: Foucault의 '살게 하고 죽게 둔다'로는 담을 수 없던 식민지·플랜테이션·노예선·아파르트헤이트. 죽일 권리로서의 주권, 죽음의 관료화.

**v2 top 10**
1. **The torture of suspects** — *The Battle of Algiers* · 0.364 — 식민 군대의 전기고문·구타. **식민지 죽음정치의 직접적 장면** (v1엔 전무).
2. **The Slaughterhouse** — *Touki Bouki* · 0.361 — 다카르 도살장의 도축. 아프리카 영화 × 죽음의 무대.
3. **The Failed Revolutions of the Third World** — *Sans Soleil* · 0.359 — 기니비사우·카브랄의 해방투쟁과 그 환멸. **포스트콜로니** 그 자체.
4. **The Boxer** — *White Material* · 0.353 — 내전 중 플랜테이션에서 죽는 반군 지도자. 식민 이후 아프리카의 폭력.
5. **Maria Vial** — *White Material* · 0.353 — 붕괴하는 아프리카 국가에서 철수를 거부하는 커피농장주. 식민 잔여.
6. **Mam's Law** — *Manderlay* · 0.352 — 죽은 여주인이 남긴 장부가 거주민을 **노예 등급으로 분류**. 인종적 주권의 문서.
7. **The legal and social status of the deceased** — *Still Life* · 0.355 — 홀로 죽은 자들의 행정적 처리 (v1 유지).
8. **The decaying city street outside Beau's apartment** — *Beau Is Afraid* · 0.356 — 시신이 방치된 거리. 산 죽음의 도시.
9. **Dr. Dibs** — *High Life* · 0.374 — 수형자 신체를 동원하는 의사 (v1 유지).
10. **The National Organ Registry** — *Crimes of the Future* · 0.358 — 신체를 분류·등록하는 국가 장치.

**vs v1:** 신규 진입 = *Battle of Algiers · Touki Bouki · Sans Soleil · White Material · Manderlay* (= 식민·노예·아프리카). 탈락 = *Society of the Snow*(설원의 시신)·*Sunshine*(죽음 투표)·*Death by Hanging* 등 **'죽음 일반'**. → 의료·생존 일반에서 **Mbembe 고유의 식민-죽음정치**로 정확히 이동. 명백한 개선.

---

## 2. Ackbar Abbas — v2 **강한 개선**

> v2 추가: 1997 반환을 앞둔 홍콩이 사라지기 직전에야 자신을 응시함. déjà disparu, 소멸이 가시성을 만든다.

**v2 top 10**
1. **The nostalgic tone before the 1997 handover** — *Comrades, Almost a Love Story* · 0.477 — **반환 직전 홍콩**의 멜랑콜리. Abbas의 텍스트가 다룬 바로 그 시공간.
2. **The rest stop / gas station** — *The Vanishing* · 0.477 — 대낮 공개 장소에서의 소거 (v1 1위 유지).
3. **Hong Kong's urban spaces (Tsim Sha Tsui…)** — *Comrades* · 0.475 — 침사추이·맥도날드·네온 거리. 사라질 도시의 표면.
4. **Neon-Soaked Night Hong Kong** — *Fallen Angels* · 0.453 — 왕가위의 인공조명 홍콩. 소멸의 미학.
5. **The Pasted Mural** — *Faces Places* · 0.456 — 붙였다 풍화되는 사진 (v1 유지).
6. **The Paris/Taipei split-screen** — *What Time Is It There?* · 0.422 — 차이밍량의 부재·시차·소멸하는 연결.
7. **The Withheld Voiceover Chorus** — *All We Imagine as Light* · 0.426 — 도시 이주민의 사라지는 목소리.
8. **The advertising hand** — *L'Age d'Or* · 0.419 — 이미지가 실재를 덮음 (v1 유지).
9. **Tokyo by night** — *Like Someone in Love* · 0.418 — 차창에 번지는 네온의 도시.
10. **Los Angeles Anomie** — *Greenberg* · 0.435 — 깊이 없는 배경으로서의 도시 (느슨함).

**vs v1:** 신규 = *Comrades*(반환기 홍콩 ×2)·*Fallen Angels*(왕가위)·*What Time Is It There?*(차이밍량) — **Abbas 이론의 실제 대상지**가 상위에 들어옴. 탈락 = *Colossal Youth · Los Olvidados · Atlantics · Platform*(일반적 폐허·변두리). → 추상적 '소멸'에서 **홍콩적 소멸**로. 8명 중 질적 개선이 가장 큼.

---

## 3. Adam Smith — v2 소폭 개선 (여전히 약함)

> v2 추가: 금을 쌓는 중상주의에 맞서, 핀 공장의 분업과 푸줏간·양조장·빵집 주인의 자기애가 만드는 자생적 질서.

**v2 top 10**
1. **Arthur Jensen's boardroom sermon** — *Network* · 0.406 — 세계는 국제 통화 시스템뿐이라는 설교.
2. **Gordon Gekko's legacy** — *Wall Street* · 0.393 — 사익 예찬의 우상화.
3. **The "Greed is good" speech** — *Wall Street* · 0.392 — 사익→질서의 이데올로기.
4. **Martin's manuscripts and rejection slips** — *Martin Eden* · 0.390 — 노동이 시장가치로 전환되는 과정 (신규).
5. **Will Turner's Forge** — *Pirates of the Caribbean* · 0.366 — **장인의 노동**을 주인이 가로챔. 분업·노동 (신규).
6. **The split shares and nightly division** — *The Treasure of the Sierra Madre* · 0.364 — 매일 밤 채굴물을 **균등 분배**하는 의례. 교환·몫의 질서 (신규).
7. **Chairman Cao Dewang** — *American Factory* · 0.355 — 자본가의 전 지구적 노동 분업 (신규).
8. **The forged 500-franc note** — *L'Argent* · 0.369 — 화폐의 순환과 그 연쇄 효과.
9. **The Stolen Kidney** — *Ship of Theseus* · 0.370 — 장기의 초국적 시장 (느슨).
10. **The Word 'Tianxia' / All Under Heaven** — *Hero* · 0.387 — *'질서/통치'에 어휘적으로 끌린 오탐 성격* (약함).

**vs v1:** sim이 0.31→0.41로 상승, **분업·노동** 모티프(*Will Turner · Treasure · Martin Eden · American Factory*)가 새로 진입 = 개선. 그러나 *Hero*('천하')·*Kinds of Kindness*('명령하는 주인') 같은 **어휘 오탐**도 동시에 유입. 여전히 8명 중 가장 약하고 우회적.

---

## 4. Adam Tooze — v2 **혼합** (성격이 이동)

> v2 추가: 네바다의 서브프라임이 뒤셀도르프 은행을 얼리는 단일 기계, 달러 스왑라인이라는 숨은 제국, 맞물려 복리로 터지는 폴리크라이시스.

**v2 top 10**
1. **Arthur Jensen's boardroom sermon** — *Network* · 0.475 — 국가는 없고 국제 자본 시스템만. **글로벌 자본의 우주론** (v1 0.416→0.475).
2. **Nicholas Van Orton** — *The Game* · 0.410 — 스톱워치로 사는 투자은행가 (신규).
3. **The "Greed is good" speech** — *Wall Street* · 0.406 — 금융 이데올로기.
4. **Zsa-zsa Korda's shoebox ledgers** — *The Phoenician Scheme* · 0.394 — 갭 파이낸싱·IOU·뇌물의 물질성 (v1 유지).
5. **Las Vegas Investigation Sequence** — *The Big Short* · 0.390 — 금융 기계의 내부 (v1 유지).
6. **Protagonists as "Heroic" Outsiders** — *The Big Short* · 0.389 — 시스템을 읽는 회의주의자 (v1 유지).
7. **The captain vs the Russian oligarch** — *Triangle of Sadness* · 0.387 — 마르크스주의 vs 자본주의 설전 (신규).
8. **The gilded transit of investors** — *The Phoenician Scheme* · 0.382 — 초국적 자본의 순환 (v1 유지).
9. **The casino floor** — *The Card Counter* · 0.373 — 금융화된 도박 공간 (신규).
10. **The shifting balance of the paycheck** — *The Big City* · 0.371 — 은행 파산과 가계의 의존 (신규).

**vs v1:** **주의 — 성격이 이동했습니다.** v1 상위였던 *Arrival*(전 지구적 연쇄 몽타주)과 *The Big Short* **젠가 CDO**(시스템 붕괴의 결정적 이미지), *Dr. Strangelove* 워룸이 v2 top12에서 **탈락**. 대신 *The Game·Card Counter·Triangle of Sadness* 등 **금융가 개인·자본주의 일반**이 진입. 즉 v1은 **'폴리크라이시스/연쇄붕괴'**를, v2는 **'글로벌 자본/금융가'**를 더 잘 잡습니다. 어느 쪽이 맞는지는 원하는 Tooze에 따라 다름 → 혼합.

---

## 5. Adrienne Massanari — v2 **개선**

> v2 추가: Reddit·게이머게이트, 참여문화의 어두운 쌍둥이. 업보트·익명·바이럴이 독성 테크문화를 구조적으로 배양.

**v2 top 10**
1. **The "Facemash" sequence** — *The Social Network* · 0.439 — 사진을 해킹해 외모 순위를 매기는 플랫폼 (v1 1위 유지).
2. **The rape-game video at the studio** — *Elle* · 0.434 — 여성을 습격하는 게임을 만드는 스튜디오. **게임 산업의 여성혐오** = 게이머게이트의 정확한 공명 (신규).
3. **M3GAN's evolution beyond her programming** — *M3GAN* · 0.419 — 설계를 넘어 폭주하는 알고리즘 (신규).
4. **Miles Bron** — *Glass Onion* · 0.392 — '파괴적 천재'를 자처하는 테크 억만장자 (신규).
5. **The social-media montage on Rahim** — *A Hero* · 0.373 — 온라인이 영웅을 띄웠다 파괴함. **네트워크 공중의 군집 공격** (신규).
6. **The memefication of the "Cool Girl" monologue** — *Gone Girl* · 0.367 — 맥락에서 떨어져 밈으로 순환 = 참여문화의 복제 (신규).
7. **The Mirando broadcast spectacle** — *Okja* · 0.366 — 라이브스트림·점보트론 스펙터클 (신규).
8. **PAL the phone assistant** — *The Mitchells vs. the Machines* · 0.358 — 무시당한 AI의 반란 (신규).
9. **Therapy-speak** — *Bodies Bodies Bodies* · 0.394 — 온라인 담론 어휘의 무기화 (v1 유지).
10. **Allegra Geller** — *eXistenZ* · 0.383 — 게임 디자이너와 플레이어의 공동-구성.

**vs v1:** 신규 다수(*Elle · Gone Girl · A Hero · M3GAN · Okja*)가 **독성 게임문화 + 밈화 + 군집공격**으로 정확히 모임. sim 상승. v1의 일반적 '소셜미디어 언급'(*Non-Fiction* 트윗 등)보다 Massanari의 핵심('toxic technocultures')에 밀착. 개선.

---

## 6. Aihwa Ong — v2 **개선**

> v2 추가: 세 나라 여권을 든 화교 거상, 자산이 된 국적, graduated sovereignty의 경제특구, 시장이 값을 매기는 이주민의 몸.

**v2 top 10**
1. **The foreign powers and the labour trade** — *Once Upon a Time in China* · 0.462 — 광둥의 쿨리(노동) 납치·송출. 초국적 노동 (신규).
2. **Li Jun & Li Qiao as Mainland immigrants** — *Comrades* · 0.440 — 본토 출신을 숨기고 홍콩인으로 **패싱**. 유연 시민권의 정확한 사례 (신규).
3. **America as escape plan** — *Taipei Story* · 0.430 — 끝없이 유예되는 이민이라는 해법 (신규).
4. **The Contract Signing** — *The Man Who Sold His Skin* · 0.417 — 비자·계약이 몸을 결박 (v1 유지).
5. **Sam Ali's Tattooed Back** — *The Man Who Sold His Skin* · 0.388 — 등에 새긴 셰겐 비자 (v1 유지).
6. **Black Venus / Park Suk-young's cover** — *The Spy Gone North* · 0.409 — 정보기관이 베이징 사업가로 **재조립한 초국적 정체성** (신규).
7. **Chairman Cao Dewang** — *American Factory* · 0.406 — 중국 자본의 미국 공장 (신규).
8. **The Cross-Cultural Friendships** — *American Factory* · 0.399 — 초국적 노동 현장의 관계 (신규).
9. **The letters of transit** — *Casablanca* · 0.390 — 도시를 탈출시키는 비자 = 이동성의 자산화 (신규).
10. **Aunt Yee's Western dress** — *Once Upon a Time in China* · 0.388 — 미국에서 돌아온 자의 이식된 문물 (신규).

**vs v1:** 신규가 대거 진입하며 **'패싱·초국적 자본·이주노동'**(첨밀밀 본토인, 블랙 비너스, 아메리칸 팩토리)으로 정밀화. v1의 난민 일반(*Green Border · Happy End*)은 빠지고, Ong이 실제로 분석한 **전략적·엘리트적 이동성** 쪽으로 이동 = 개념 충실도 개선.

---

## 7. Alain Badiou — v2 **전환 (개선)**

> v2 추가: 아무것도 새로 일어날 수 없다는 냉소에 맞선 분노. 마오주의자, 68년 5월의 충실성, 진리-사건과 그에 충실한 주체(militant·연인·예술가·과학자).

**v2 top 10**
1. **Vidal the Marxist friend** — *My Night at Maud's* · 0.420 — 파스칼의 내기로 마르크스주의를 논하는 철학 교수 (신규).
2. **Fabrizio** — *Before the Revolution* · 0.411 — 마르크스를 인용하다 부르주아로 후퇴하는 청년 (베르톨루치) (신규).
3. **Saint-Just by the roadside** — *Weekend* · 0.408 — 현대 들판에 나타나 혁명을 설파하는 **생쥐스트** (고다르) (신규).
4. **Guillaume the Performer** — *La Chinoise* · 0.406 — **마오주의 세포**의 아지프로 연극 = 혁명적 행위로서의 예술 (고다르) (신규).
5. **The philosopher's café talk** — *Vivre sa vie* · 0.408 — 언어의 한계를 논하는 철학자와의 대화 (신규).
6. **Cesare the Marxist teacher** — *Before the Revolution* · 0.375 — 일상적 사회주의를 사는 공산주의 교사 (신규).
7. **The Bicentennial fireworks over Pont-Neuf** — *The Lovers on the Bridge* · 0.379 — **프랑스혁명 200주년** 불꽃 아래의 사랑 (신규).
8. **Moses Rosenthaler** — *The French Dispatch* · 0.380 — 폭력적 추상을 그리는 투옥된 화가 = 예술의 진리-사건 (신규).
9. **The performance-artist set-pieces** — *The Great Beauty* · 0.381 — 현대 예술계의 사건들 (신규).
10. **Alexandre's Monologues** — *The Mother and the Whore* · 0.383 — 68년 이후 끝없이 이론화하는 인물 (신규).

**vs v1:** 거의 **전면 교체**. v1은 *Persona*(필름이 타들어감) 등 **형식적 파열**을, v2는 *La Chinoise · Before the Revolution · Weekend(생쥐스트) · Vivre sa vie*로 **혁명·마오주의·militant·예술가**를 잡음 — Badiou의 실제 정치철학에 훨씬 충실. 단, '사건=단절'의 형식적 측면은 약해짐(개념의 다른 면을 비춤). 풍부화에 따른 의미 있는 전환.

---

## 8. Albert O. Hirschman — v2 **부분 후퇴** (주의)

> v2 추가: 나치를 피해 망명하고 마르세유에서 난민을 탈출시킨 삶. Exit만 보는 경제학과 Voice만 보는 정치학의 맹점, 그리고 정념을 길들이는 상업.

**v2 top 10**
1. **The unsigned oath** — *A Hidden Life* · 0.388 — 히틀러 충성 서약을 **끝내 거부**하는 농부. 충성/이탈/항의의 도덕적 핵 (신규, 적중).
2. **The character arc of Gerd Wiesler** — *The Lives of Others* · 0.388 — 체제를 믿던 슈타지 장교가 **이탈·내부 항의**로 전향 (신규, 적중).
3. **The film's structure** — *The Lives of Others* · 0.379 — 감시에서 양심의 실내극으로 (신규).
4. **The student radical Pace** — *Investigation of a Citizen* · 0.408 — 심문에 이론으로 맞서는 좌파 (Voice) (신규).
5. **Harold Meyerowitz** — *The Meyerowitz Stories* · 0.422 — 불평으로 식탁을 지배하는 노인 (*'grievance'에 끌린 느슨한 매칭*).
6. **Alma at the crossroads** — *After the Hunt* · 0.383 — 충성 검증을 견디는 교수 ('loyalty' 어휘).
7. **Pirovitch** — *The Shop Around the Corner* · 0.374 — 솔직한 의견을 피해 창고로 도망 = **Voice의 회피** (적절).
8. **Leopold Kessler** — *Europa* · 0.378 — 폐허의 나라에 '작은 친절'을 가져오려는 인물 ('kindness' 어휘).
9. **The German handyman scene** — *Origin* · 0.376 — 누가 속하는가의 긴장 (v1 인접).
10. **The Zone of Interest narrative** — *The Zone of Interest* · 0.393 — 홀로코스트 (*전기 어휘 '나치'에 끌린 오탐 성격*).

**vs v1:** sim은 올랐지만 **개념 적중도는 떨어졌습니다.** v1의 백미였던 *Women Talking*("Do Nothing/Stay and Fight/Leave" = 충성/항의/이탈)과 *Greenberg*(항의 편지)가 **탈락**. 대신 gloss에 넣은 전기("나치를 피해 망명한 독일계 유대인")의 단어들이 *Zone of Interest · Europa · A Hidden Life* 등 **나치/전체주의 영화 군집**을 끌어왔습니다. 일부(슈타지 장교의 전향, 충성 서약 거부)는 정확하지만, **'이탈/항의/충성'이라는 추상적 메커니즘 자체**는 v1이 더 깔끔히 잡았습니다.

> **교훈:** gloss에 이론가의 *전기적 사실*을 많이 넣으면 그 고유명사·사건명이 임베딩을 지배해, 개념이 아니라 **전기와 닮은 영화**를 부릅니다. 개념 매칭이 목적이라면 전기보다 **개념의 작동방식**을 생생히 쓰는 편이 낫습니다.

---

## 종합 — 무엇을 배웠나

1. **풍부한 gloss는 대체로 정확도를 높입니다.** 최고 sim이 8명 중 7명에서 상승했고, 개념의 역사적·정치적 맥락(Mbembe 식민, Abbas 홍콩, Badiou 혁명, Ong 패싱)을 정확히 끌어왔습니다.
2. **단, '생생함'을 *개념의 작동*에 쓸 때만** 그렇습니다. Hirschman처럼 *이론가 전기*를 생생히 쓰면, 그 전기의 고유명사가 노이즈가 되어 핵심 개념을 밀어냅니다.
3. **개념이 여러 면을 가질 때 gloss가 어느 면을 비추는지가 결과를 정합니다.** Tooze에서 '연쇄붕괴'를 강조하면 *Arrival·젠가*가, '글로벌 자본'을 강조하면 *더 게임·카드 카운터*가 옵니다. → **개념별로 gloss를 나눠 임베딩**하면 두 면을 모두 건질 수 있습니다.
4. **권장 레시피:** 개념의 *발생 동기 + 작동 방식*은 풍부하게, *이론가 전기·고유명사*는 절제. 필요하면 개념별로 분리 임베딩 후 top-20에서 사람이 확정.

전체 이론가 리스트로 확장하거나, Tooze처럼 다면적 개념을 분리 임베딩하는 버전도 바로 돌릴 수 있습니다.
