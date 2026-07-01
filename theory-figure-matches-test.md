# 이론가 ↔ Figure 임베딩 매칭 (테스트, 8명)

생성일 2026-06-26 · 대상 figures 18,168개(전부 임베딩 보유) · DB: `kyniq`(jvgarcqrtsmgfimdcwgo)

---

## 어떻게 뽑았나 (방법)

1. **질의 벡터**: 이론가마다 핵심 개념을 1~2문장 영문 *gloss*로 압축해, figures와 **같은 모델**(`text-embedding-3-small`, 1536차원)으로 임베딩했습니다. 영화 figure의 설명이 영어라 영문 gloss가 같은 의미공간에 더 잘 정렬됩니다.
2. **검색**: 그 벡터와 18,168개 figure 임베딩 간 **코사인 유사도**(pgvector `<=>`)로 정렬해 상위 후보를 뽑고, 보일러플레이트(설명 40자 미만, "The film as a whole" 등)는 제외했습니다.
3. **큐레이션**: 후보 12개 중 주제적으로 가장 맞는 **10개**를 제가 골라 *왜* 뽑혔는지 근거를 붙였습니다.

### 점수(sim) 읽는 법
- **상대 순위**가 의미입니다. 절댓값은 낮게 나옵니다(text-embedding-3-small의 교차도메인 매칭 특성). 0.40이면 매우 강한 공명, 0.27~0.33은 느슨한 공명입니다.
- 따라서 "top 10"은 **깔끔한 경계가 아니라 후보군**입니다. 1위와 10위 차이가 크지 않습니다.

### 한계 (반드시 감안)
- **gloss가 결과를 좌우합니다.** 개념 요약을 어떻게 쓰느냐로 매칭이 바뀝니다(garbage-in-garbage-out).
- **어휘 공명**이라 표층 단어에 끌릴 수 있습니다. 예: Hirschman에서 *Decision to Leave*가 제목의 "Leave"(이탈) 때문에 상위에 떴는데, 내용은 이탈 개념과 무관해 **제외**했습니다. 이런 제목·단어성 오탐이 섞입니다.
- **이론별 편차가 큽니다.** 죽음정치(Mbembe)·소멸(Abbas)·금융위기(Tooze)·시민권(Ong)·이탈/항의(Hirschman)처럼 **구체적 모티프로 영화에 나타나는 개념**은 매칭이 강하고, **Adam Smith의 '보이지 않는 손'·분업**처럼 추상적 경제 개념은 직접 묘사되는 figure가 드물어 약합니다(아래 Smith 섹션 sim 0.27~0.31).

---

## 1. Achille Mbembe — Necropolitics · On the Postcolony · Racial Sovereignty

> gloss: *죽음과 주권의 정치 — 누가 살고 누가 죽음으로 내몰리는가. 식민 점령, 인종적 예속, 그리고 인구 전체가 '산 죽음' 상태로 유지되는 죽음-세계의 창출. 죽일 권리로서의 주권.*

매칭이 매우 강합니다. 죽음의 **행정·계산·집행**을 보여주는 figure들이 정확히 모였습니다.

1. **The legal and social status of the deceased** — *Still Life* · trope · 0.389 — 홀로 죽은 이들이 사건 파일·미수령 유품·주소로만 존재. 죽음이 관료적 처리 대상이 되는 "죽음의 행정".
2. **The bodies in the snow** — *Society of the Snow* · object · 0.382 — 시신이 생존자의 양식이 되며 표시·논쟁·소진되는, 삶과 죽음의 문턱.
3. **The crew's death-vote** — *Sunshine* · trope · 0.371 — 남은 산소로 몇 명이 살 수 있는지 소리 내어 계산하며 누가 '소모 가능'인지 정하는 장면. 악의가 아니라 **산술이 죽음을 결정**.
4. **The Gallows Chamber** — *Death by Hanging* · location · 0.368 — 영화 전체가 처형 시설(올가미·관찰실) 안에서 전개. **국가의 살해 장치 = 주권의 핵심**.
5. **Dr. Dibs** — *High Life* · character · 0.367 — 수형자의 신체를 번식 실험에 동원하는 의사. 보살핌과 포식이 겹치는 생명정치적 통제.
6. **The colour switch (Technicolor Earth / monochrome Heaven)** — *A Matter of Life and Death* · form · 0.356 — 산 자의 세계와 사후 세계를 색으로 분리. 문자 그대로 "누가 살 수 있는가"의 시각화.
7. **Lavrentiy Beria** — *The Death of Stalin* · character · 0.325 — 명단과 경비를 쥐고 체포·사면을 미소 띤 친밀함으로 분배. **죽음에 대한 주권적 자의(恣意)**.
8. **The film's narrative structure and central moral dilemma** — *The Killing of a Sacred Deer* · form · 0.324 — 가족 중 하나를 죽이지 않으면 모두 잃는다. 이미 선고된 죽음의 논리로 전개되는 서사.
9. **The land-survey contract** — *The Settlers* · object · 0.324 — 경계 측량·항로 개척이라는 공식 목적이 식민지 **살해를 승인·은폐**하는 서류. 식민-죽음정치의 정확한 예.
10. **The film's overall narrative structure** — *The Wailing* · form · 0.324 — 누가 선이고 누가 처단될 악인지 끝내 보류. 감염·죽음·판결 불가능성이 마을을 뒤덮음.

---

## 2. Ackbar Abbas — Culture of Disappearance

> gloss: *사라짐의 문화 — 장소가 소멸하는 순간에야 비로소 보인다. 식민주의와 가속 자본주의 아래 출현과 소멸이 뒤얽힘. déjà disparu(이미 사라져버림), 새로움이 늘 이미 지나간 것으로, 클리셰와 이미지로 지각됨.*

상위가 0.44~0.54로 8명 중 **가장 선명한 매칭**입니다. 소멸·사라짐·흔적이 일관됩니다.

1. **The rest stop / gas station** — *The Vanishing* · location · 0.539 — 대낮 붐비는 휴게소에서 사람이 사라짐. **가장 공개적인 장소가 소거의 현장**이 되는 사라짐의 핵심.
2. **Daylight flatness** — *The Vanishing* · form · 0.444 — 납치가 그림자도 위협도 없는 평범한 밝은 빛 속에서 진행. 소멸의 *déjà disparu*적 평면성.
3. **The Pasted Mural** — *Faces Places* · trope · 0.441 — 평범한 사람의 대형 사진을 붙였다 풍화·박락되게 둠. 출현→소멸의 순환.
4. **The demolished slum of Fontainhas** — *Colossal Youth* · location · 0.421 — 철거 중인 이민자 구역이 폐허·기억의 방으로만 존재. 지워지는 장소.
5. **The slum and its half-built construction sites** — *Los Olvidados* · location · 0.419 — 공터·쓰레기터·반쯤 지어진 골조. 멀리 광고판이 약속하는 근대의 사라지는 변두리.
6. **Distant trains and loudspeakers** — *Platform* · trope · 0.401 — 멀리 보이는 기차와 정체불명의 방송. **닿지 않는 곳에 머무는 근대성**의 신호.
7. **The advertising hand and the beach billboard** — *L'Age d'Or* · object · 0.396 — 광고 사진이 실제 여자로 녹아들고 상업 단편이 얼굴을 흐림. "클리셰와 이미지로 지각되는" 세계.
8. **Moved Objects** — *Presence* · trope · 0.394 — 쓰러진 책, 옮겨진 사진 등 흔적으로만 감지되는 존재. 보이지 않는 것의 출현.
9. **The recurring imagery of the ocean and drowning** — *Atlantics* · location · 0.391 — 사라진(익사한) 자들이 바다와 결부된 현존으로 귀환. 부재와 현존의 얽힘.
10. **Paula, the missing girl** — *Shirley* · trope · 0.388 — 사라진 학생이 숲 속 형상·이미지로 영화를 떠돎. 소멸한 것이 이미지로만 출몰.

---

## 3. Adam Smith — The Invisible Hand · Division of Labour · The Wealth of Nations

> gloss: *보이지 않는 손에 의해 조율되는 자유시장 — 사익을 좇는 개인이 의도치 않게 공익을 증진. 분업이 생산성을 배가하고, 부는 특화·교역·자기조정 시장에서 나온다.*

**가장 약한 세트입니다(sim 0.27~0.31).** '보이지 않는 손'이나 '분업' 같은 추상 개념은 영화에 직접 묘사되는 figure가 드뭅니다. 그래서 모델은 **시장·탐욕·기업·자기조정 질서**를 다루는 장면으로 우회 수렴했습니다. 참고용으로 보세요.

1. **The "Greed is good" speech scene** — *Wall Street* · form · 0.313 — 사익(탐욕)이 진화의 본질을 포착한다는 게코의 연설. **사익→질서**라는 Smith 명제의 이데올로기적 변주.
2. **Arthur Jensen's boardroom sermon** — *Network* · trope · 0.306 — 국가·이념은 환상이고 오직 국제 통화 시스템만 실재한다는 설교. **시장이 곧 세계 질서**.
3. **The cultural reception and legacy of Gordon Gekko** — *Wall Street* · trope · 0.295 — 악당으로 그려졌으나 사익 예찬의 우상이 된 게코. 사익 옹호의 사회적 수용.
4. **The Matchmaking Agency** — *Materialists* · location · 0.296 — 인간의 갈망이 고객 파일·피칭으로 처리되는 사무실. **친밀성마저 분업·상품화**되는 시장.
5. **Central character conflict: Gekko vs Carl Fox** — *Wall Street* · trope · 0.276 — 회사를 해체하려는 약탈자 vs 일자리를 지키려는 노조. 상충하는 가치체계로서의 시장.
6. **The all-encompassing Buy n Large corporation** — *WALL·E* · trope · 0.267 — 모든 것에 찍힌 단일 기업 로고. 보이지 않는 손이 독점으로 굳은 극단.
7. **Madeleine White** — *Inside Man* · character · 0.267 — 시장·권력 사이를 마찰 없이 오가는 부유층 해결사. 레버리지로 움직이는 행위자.
8. **The Nine Eyes Surveillance Network** — *Spectre* · trope · 0.288 — 회원국을 하나의 데이터 장치로 병합하는 시스템. 자기조정을 가장한 거대 질서.
9. **The Recruited Accomplices** — *The Mastermind* · character · 0.268 — 각기 다른 역할의 조무래기 조력자를 모은 강도단. **분업**(역할 특화)의 희극적 변주.
10. **Jason Bourne's self-sufficiency and hyper-competence** — *The Bourne Identity* · trope · 0.267 — 제도 없이 다언어·다통화로 자립하는 인물. 자기조정적 개인 행위자의 상.

---

## 4. Adam Tooze — Financial Power Maps · Global Capitalism · Polycrisis

> gloss: *글로벌 금융 권력의 구조와 맞물린 위기들(폴리크라이시스) — 화폐·부채·중앙은행·지정학이 국가들을 묶고, 경제 충격이 세계 경제로 연쇄한다.*

금융·시스템·연쇄위기 매칭이 강합니다. 특히 *The Big Short* 계열이 정확합니다.

1. **Montage of global news and military escalation** — *Arrival* · form · 0.418 — 방송·폭락·군사동원이 12개 착륙지 전역에서 교차 편집. **충격의 전 지구적 연쇄 = 폴리크라이시스**의 동학.
2. **Arthur Jensen's boardroom sermon** — *Network* · trope · 0.416 — 국가·이념은 없고 국제 자본 시스템만 있다는 설교. Tooze식 **글로벌 자본의 우주론**.
3. **Jenga Tower CDO Metaphor** — *The Big Short* · trope · 0.374 — 젠가로 CDO의 적층과 붕괴를 시연. **시스템적 취약성·연쇄붕괴**의 시각적 정의.
4. **Las Vegas Investigation Sequence** — *The Big Short* · form · 0.362 — 모기지 브로커·CDO 매니저를 인터뷰하며 드러나는 금융 기계의 내부.
5. **Zsa-zsa Korda's shoebox ledgers** — *The Phoenician Scheme* · object · 0.356 — 갭 파이낸싱 인프라 거래가 신발상자 속 IOU·뇌물로 손에서 손으로. **자본 흐름의 물질성**.
6. **The Nine Eyes Surveillance Network** — *Spectre* · trope · 0.350 — 국가들을 하나의 장치로 병합하는 **권력 지도(power map)**의 픽션적 형상.
7. **Protagonists as "Heroic" Outsiders** — *The Big Short* · character · 0.349 — 시스템을 읽어낸 회의주의자들이 그 균열로 이익을 봄. 위기를 해독하는 시선.
8. **The War Room table** — *Dr. Strangelove* · location · 0.340 — 거대한 테이블에서 **세계 종말을 관리**하는 지정학적 의사결정의 무대.
9. **The gilded transit of investors** — *The Phoenician Scheme* · location · 0.339 — 전용 열차·선박·저택을 오가는 거의 동일한 방들. **초국적 자본의 순환 회로**.
10. **The Ferris wheel money handoff** — *Broker* · trope · 0.334 — 현금과 거래가 반복적으로 손바뀜하는 안무. 거래의 (불)성립이라는 미시 금융.

---

## 5. Adrienne Massanari — Participatory Culture

> gloss: *참여적 온라인 문화와 플랫폼 공동체 — 사용자가 콘텐츠를 공동 생산하고, 플랫폼 설계·알고리즘이 독성 테크문화·괴롭힘·트롤링·네트워크 공중을 배양(예: Reddit).*

플랫폼·소셜미디어·매개된 공중 매칭이 잘 모였습니다(후반부는 다소 느슨).

1. **The "Facemash" sequence / creation of Facebook** — *The Social Network* · form · 0.363 — 기숙사 사진을 해킹해 여성 외모를 순위 매기는 사이트 제작. **참여 플랫폼의 독성 기원**.
2. **The smartphone and tweet** — *Non-Fiction* · object · 0.354 — 팔로워 수·바이럴 게시물을 논거로 들이대는 인물들. 플랫폼 지표가 사회적 화폐.
3. **The e-book and digital disruption debate** — *Non-Fiction* · trope · 0.349 — 블로그·트윗·알고리즘이 문화를 잠식하는지 끝없이 토론. 플랫폼발 교란.
4. **The robot and the new tech world** — *Caught by the Tides* · object · 0.332 — 자동화·서비스 로봇의 매끈한 팬데믹 이후 풍경. 테크 포화된 일상.
5. **The Livestream Phone Screen** — *Eddington* · form · 0.330 — 캠페인 영상·시위 라이브·음모 클립이 화면으로 매개. **네트워크 공중**의 시각화.
6. **Therapy-speak** — *Bodies Bodies Bodies* · trope · 0.327 — 'gaslighting/toxic/triggering' 같은 온라인 담론 어휘가 오프라인에서 무기화. 플랫폼 언어의 이식.
7. **The media broadcast** — *Contact* · trope · 0.312 — 24시간 뉴스·토크쇼가 사건을 스펙터클로. 네트워크화된 주의(attention) 경제.
8. **The marketing job** — *Friendship* · location · 0.308 — 앱을 **최대한 중독적으로 최적화**하는 직장. 플랫폼 설계의 어두운 의도.
9. **The Monopoly / Lana Del Rey lecture** — *Heretic* · trope · 0.305 — 원본 대 표절(모노폴리·팝송)로 짜는 논증. 리믹스·참여문화의 복제 논리.
10. **The extreme close-up** — *The Substance* · form · 0.313 — 피부·입·주사 자리를 압도적으로 촉각화. *(약한 매칭: 신체 호러에 가까움 — 화면-매개된 친밀성의 미학으로만 느슨히 연결)*.

---

## 6. Aihwa Ong — Flexible Citizenship

> gloss: *유연한 시민권 — 이동하는 글로벌 주체(초국적 엘리트·이주민)가 국적·여권·자본·국경을 전략적으로 항행. 시장과 이동성을 통해 협상되는 유동적 소속.*

시민권·국경·이동성·이주노동 매칭이 강합니다.

1. **The Contract Signing** — *The Man Who Sold His Skin* · trope · 0.349 — 비자·작품·재판매 계약이 Sam의 **몸을 타인의 재산권에 결박**. 시민권의 시장적 협상.
2. **The creation of the composite protagonist, Fern** — *Nomadland* · character · 0.383 — 떠도는 전(前) 노동자 Fern. 이동성으로 재편되는 불안정 시민-주체.
3. **The recurring presence of North African migrants** — *Happy End* · trope · 0.339 — 칼레의 이주민이 거리·하인으로 가장자리에 출몰. **차등적 소속**의 풍경.
4. **Cluj under renovation** — *Kontinental 25* · location · 0.337 — 신개발·긱 배달·EU 자금의 근대가 옛 동네 위에 적층. 초국적 자본·노동의 도시.
5. **Sam Ali's Tattooed Back** — *The Man Who Sold His Skin* · object · 0.331 — 셰겐 비자를 등에 문신. **난민의 살아있는 몸이 전시·판매 가능한 작품**이 되는 유연 시민권의 극단.
6. **The German handyman scene** — *Origin* · trope · 0.315 — 친절한 노동자가 드러내는 토착주의적 반감. "누가 속하는가"의 긴장.
7. **The multilingual narration** — *Grand Tour* · form · 0.314 — 국경을 건널 때마다 바뀌는 다언어 보이스오버. 이동성의 청각적 형상.
8. **Amazon CamperForce warehouse scenes** — *Nomadland* · trope · 0.311 — 아마존 물류센터의 계절 노동. 이동하는 노동력으로서의 시민.
9. **The repeated push-back** — *Green Border* · trope · 0.310 — 난민이 철조망 너머로 반복해 내던져짐. **시민권의 폭력적 경계**, 누가 받아들여지는가.
10. **The metadata diagram** — *Citizenfour* · object · 0.308 — 통화·메시지를 수집하는 감시 아키텍처. 이동하는 주체를 추적하는 **국가 장치** *(시민권의 통제 측면으로 연결)*.

---

## 7. Alain Badiou — The Event

> gloss: *사건 — 기존 질서를 깨고 새로운 진리를 여는 단절, 주체에게 충실성을 요구함. 예측 불가능한 균열, 급진적 충실성, 그리고 이전에 없던 진리에 대한 충실함으로 구성되는 주체.*

모델은 'Event'를 **형식적 단절·파열**로 해석해, 서사·장치가 찢어지는 figure로 수렴했습니다(개념의 형식적 측면에 강함).

1. **The film burning through** — *Persona* · form · 0.427 — 아크등이 켜지고 필름이 녹고 찢어지는 장치의 자기-파열. **재현 질서의 균열 = 사건**.
2. **The break in the performance** — *Four Daughters* · form · 0.406 — 재연이 무너지는 순간(배우의 멈춤, 실제 인물의 눈물)을 진리로 삼음. **파열 자체가 진리**.
3. **The toasts and table rituals** — *The Celebration* · trope · 0.381 — 만찬의 의례 기계 속으로 (폭로라는) 진리가 분출. 질서와 그것을 깨는 사건.
4. **The abrupt elliptical cut** — *À nos amours* · form · 0.379 — 해소 전 장면을 끊고 예고 없는 미래로 착지. 장면들 사이에 일어나는 사건.
5. **The Border-Crossing Long Take** — *Ulysses' Gaze* · form · 0.365 — 한 숏 안에서 시대·장소가 바뀜. 끊기지 않는 지속 속의 균열.
6. **The fractured chronology** — *Polytechnique* · form · 0.362 — 같은 순간을 가해자·생존자·방관자 시점으로 되돌려 재구성. 외상적 사건이 시간을 재편.
7. **The cut to the past at the dinner table** — *Audition* · form · 0.356 — 시간이 고리를 이루며 만찬이 환각으로 번짐. 사건을 중심으로 균열되는 연대기.
8. **The film's overall visual and narrative form** — *The Tree of Life* · form · 0.355 — 플롯을 보류한 채 우주적 막간과 사후 해변으로. 명료함을 거두는 형식적 단절.
9. **The Closed Door** — *Trouble in Paradise* · form · 0.355 — 강도·유혹·배신이 닫히는 문 뒤에서. **재현되지 않는 사건**, 외부만 남김.
10. **The car crash** — *Enter the Void* · trope · 0.354 — 부모의 사고가 번쩍이는 삽입으로 반복 귀환. 주체를 정초하는 **창설적 파국(사건)**.

---

## 8. Albert O. Hirschman — Exit, Voice, and Loyalty · Shifting Involvements · The Passions and the Interests

> gloss: *쇠퇴에 대한 반응 — 이탈(떠남), 항의(목소리 내기), 충성(애착으로 머무름). 사익과 공적 참여 사이의 진동, 그리고 상업이 정념을 길들일 수 있다는 발상.*

이탈/항의/충성·공적 참여 매칭이 좋습니다. 특히 *Women Talking*은 거의 일대일입니다.

1. **The Complaint Letters** — *Greenberg* · object · 0.379 — 기업들에 보내는 항의 편지를 소리 내어 읽는 원칙적 분노. **Voice(항의)**의 순수형.
2. **The vote chalked on the wall** — *Women Talking* · trope · 0.367 — 선택지 "Do Nothing / Stay and Fight / Leave"를 벽에 그려 투표. **충성 / 항의 / 이탈**과 거의 정확히 대응. (이 세트의 백미)
3. **The smartphone and tweet** — *Non-Fiction* · object · 0.362 — 팔로워 수·바이럴을 논거로 드는 인물들. **플랫폼 시대의 Voice**.
4. **Therapy-speak** — *Bodies Bodies Bodies* · trope · 0.352 — 고충·비난의 어휘가 무기화. 항의 언어의 인플레이션.
5. **Tyler Durden's anti-consumerist philosophy** — *Fight Club* · trope · 0.333 — 광고·부채·소유에 맞선 독백("소유물이 너를 소유한다"). 소비 질서로부터의 **이탈/항의**, 정념 대 이해(利害).
6. **The BLM Protest Performance** — *Eddington* · trope · 0.330 — 빌려온 구호를 읊는 시위가 '보이기 위한' 수행으로. **Voice의 수행성과 한계**.
7. **Bin, the man who left** — *Caught by the Tides* · character · 0.329 — 도시로 떠난 뒤 변해 돌아오는 연인. 관계·장소로부터의 **Exit(이탈)**.
8. **The characters' performance of toughness** — *The Departed* · trope · 0.328 — 욕설·하대로 우위를 주장하는 조직 내 남자들. 조직에 대한 충성·배신의 역학.
9. **The friend group's loyalties** — *Bodies Bodies Bodies* · trope · 0.328 — 오랜 우정·연애·경쟁이 압박 속에 분열. **Loyalty(충성)**와 그 균열.
10. **Troy Dyer's "slacker" persona and philosophy** — *Reality Bites* · trope · 0.327 — 안정된 일을 거부하고 실업을 주류 거부의 원칙으로 프레이밍. 일종의 원칙적 **Exit/withdrawal**.

> 참고: *Decision to Leave*(산 정상의 추락)가 상위에 떴으나, 제목의 "Leave"에 끌린 **어휘성 오탐**으로 판단해 제외했습니다. 이런 사례가 임베딩 매칭의 전형적 노이즈입니다.

---

## 종합 판단 — 정확한가?

- **발견(discovery) 도구로는 충분히 정확합니다.** 구체적 모티프로 영화에 나타나는 이론(죽음정치·소멸·금융위기·시민권·이탈/항의)은 상위 결과가 직관적으로 설득력 있습니다.
- **추상 경제·철학 개념(Adam Smith)은 약합니다.** sim이 낮고, 직접 매칭보다 인접 주제(시장·기업)로 우회합니다.
- **이것은 "정답 큐레이션"이 아니라 "주제적 후보 추천"입니다.** 어휘성 오탐(제목·단어)이 섞이므로, 최종 사용 전 사람 검수가 권장됩니다.
- **정확도를 더 올리려면**: (a) gloss를 더 길고 구체적으로(이론가의 대표 텍스트·핵심 명제 포함), (b) 개념별로 따로 임베딩(이 테스트는 이론가당 1벡터), (c) top-20을 뽑아 검수 후 10개 확정.

전체 리스트로 확장하시려면 같은 파이프라인을 그대로 돌릴 수 있습니다(이론가당 약 1~2초). DB 테이블로 저장하는 옵션도 가능합니다.
