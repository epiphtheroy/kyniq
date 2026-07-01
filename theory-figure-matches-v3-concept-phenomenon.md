# 대표개념 1개 × 현상중심 매칭 (v3)

생성일 2026-06-26 · 같은 파이프라인(`text-embedding-3-small`, 1536d, 코사인) · 개수 가변

## 방법

각 이론가의 **가장 대표적인 개념 1개**만 골라, gloss에 *"이 개념이 왜 나왔는가 — 그가 설명하려던 현상은 무엇인가"*를 서술해 임베딩했습니다. 매칭된 figure의 이유도 **그 현상에 직접 연결**해 적었습니다. 개수는 개념별 관련성에 따라 가변(6~10개)으로 뒀습니다.

> **이번 판의 특징:** gloss에서 *이론가 전기(고유명사)*를 빼고 **현상의 작동방식**만 생생히 적었더니, ① 매칭이 현상 자체로 수렴하고 ② 지난 판에서 Hirschman을 망쳤던 "나치 전기" 노이즈가 사라졌습니다. 대신 추상 개념(보이지 않는 손·사건)은 여전히 sim이 낮습니다.

---

## 1. Achille Mbembe — **Necropolitics (네크로폴리틱스)**

> **현상:** 생명을 보호한다는 근대 권력이 왜 끊임없이 *죽음을 목적으로 하는 구역*을 만들고 사람들을 죽도록 방치하는가. '살게 하고 죽게 둔다'로는 식민지·수용소·점령지가 설명되지 않는다. 주권의 본모습 = **누가 소모품인지 결정하고, 죽음을 행정으로 만드는 권력.**

매칭 이유는 모두 "**죽음이 제도·명령·계산으로 집행되는** 장면"이라는 현상에 연결됩니다.

1. **The ringing telephone** — *The Bad Sleep Well* · 0.457 — 수화기를 통해 명령·위협·최종 지시가 흐른다. **죽음이 보이지 않는 권력의 명령으로 전달**되는, 주권적 살해의 관료적 형태.
2. **The crew's death-vote** — *Sunshine* · 0.443 — 남은 산소로 누가 '소모 가능'인지 소리 내어 계산. 악의가 아닌 **산술이 죽음을 결정** = 죽음의 행정화.
3. **The Gallows Chamber** — *Death by Hanging* · 0.427 — 영화 전체가 처형 시설 안에서. **국가의 살해 장치**, 주권=죽일 권리의 직접적 형상.
4. **The prison camp and interrogation rooms** — *Army of Shadows* · 0.402 — 수용소·심문·처형실이라는 제도적 죽음의 공간.
5. **The deaths by accident and incompetence** — *To Live* · 0.399 — 악당이 아니라 **제도적 실패**가 아이들을 죽인다. 통치가 곧 죽음의 분배.
6. **The youth detention center** — *Pixote* · 0.395 — '교화'를 내건 국가 시설이 구타·살해만 생산. 산 죽음의 제도.
7. **The execution by the sea and on the road** — *The Travelling Players* · 0.389 — 총살·보복살해가 빈 해변·길에서 반복 상연. 정치적 살해의 일상화.
8. **The bodies in the snow** — *Society of the Snow* · 0.422 — 시신이 표시·논쟁·소진되는, 삶과 죽음의 문턱.
9. **Dr. Dibs** — *High Life* · 0.407 — 수형자 신체를 동원·수확하는 의사. 생명에 대한 죽음권력.
10. **The National Organ Registry** — *Crimes of the Future* · 0.392 — 신체를 분류·등록·문신하는 국가 장치.

---

## 2. Ackbar Abbas — **Culture of Disappearance (사라짐의 문화)**

> **현상:** 한 장소가 왜 *사라지기 직전에야* 자신을 또렷이 보게 되는가. 여기서 **가시성은 소멸이 만든다** — 사람들은 세계가 빠져나가는 순간에야, 클리셰와 이미지로 그것을 붙든다. **보는 것과 잃는 것이 같은 행위**가 되는 지각방식.

매칭 이유는 "**사라짐·소멸·흐려짐이 곧 보임이 되는** 순간"에 연결됩니다. (이 판은 '홍콩'을 gloss에서 뺀 *순수 현상* 버전이라, 도시 특정성 대신 소멸의 현상학이 모였습니다.)

1. **The rest stop / gas station** — *The Vanishing* · 0.593 — 가장 공개적인 장소에서 사람이 사라진다. **소멸이 사건을 보이게** 하는 정확한 형상. (전 판 통틀어 최고 sim)
2. **Reflections and superimpositions** — *All of Us Strangers* · 0.529 — 얼굴이 유리·거울·디졸브로 겹쳐 사라진다. 현존이 소멸과 포개짐.
3. **The Pasted Mural** — *Faces Places* · 0.488 — 붙인 사진이 풍화·박락되도록 둠. 출현=소멸.
4. **Daylight flatness** — *The Vanishing* · 0.483 — 소멸이 평범한 밝은 빛 속에서. *déjà disparu*의 무심한 표면.
5. **The Ghost-Camera** — *Presence* · 0.482 — 카메라가 보이지 않는 존재로서 떠돈다. **부재가 곧 시점**이 됨.
6. **The fixed long take** — *Somewhere* · 0.470 — 시간이 흘러 사라지는 것을 견디게 하는 지속.
7. **The Photographs of the Reborn Sight** — *Ship of Theseus* · 0.467 — 사라지는 정체성을 이미지가 대신 증언.
8. **"There is still time"** — *I Saw the TV Glow* · 0.456 — 사라지기 전 남은 창(窓)을 약속하는 문구. 소멸을 향한 카운트다운.
9. **The Motorcycle and the Vanishing** — *I'm Not There* · 0.456 — 공인을 무대에서 *사라지게* 하는 기계. 소멸로서의 후퇴.
10. **Augusto's flashes of recognition** — *The Eternal Memory* · 0.446 — 치매로 사라지는 기억이 잠깐씩 번뜩임. 소멸 직전의 가시성, 그 자체.

---

## 3. Adam Smith — **The Invisible Hand (보이지 않는 손)**

> **현상:** 명령하는 왕도 길드도 없는데, 어떻게 사회는 *질서 있게* 먹고 입는가. 각자 사익만 좇는데, 그 사익이 **보이지 않는 손에 이끌려 아무도 의도하지 않은 공공선**을 만든다. 설명하려던 현상 = **설계자 없는 자생적 질서·창발적 조율.**

이 개념은 영화에 직접 묘사가 드물어 sim이 낮습니다(top 0.34). 다만 현상 gloss는 "**계획자 없이 질서가 창발하는**" figure를 끌어왔습니다 — 이전 판의 '월스트리트 탐욕'보다 *개념의 작동방식*에 가깝습니다. 강한 6개만 둡니다.

1. **Kim Young-tak / the resident representative** — *Concrete Utopia* · 0.329 — 재난 후 **주민들이 자발적으로** 순찰·배급 질서를 세운다. 명령자 없이 창발하는 조율 = 보이지 않는 손의 어두운 실험.
2. **The communal feast / shared meal** — *Concrete Utopia* · 0.328 — 음식을 모으고 나누는 자생적 협동의 의례.
3. **The prison as a system** — *A Prophet* · 0.322 — 공식 규칙 위에 파벌·밀거래·교환이 **스스로 하나의 질서**를 이룬다. 설계되지 않은 시장적 질서.
4. **Water and the well** — *Time of the Wolf* · 0.325 — 물이 통화가 되어 분배·교환된다. 결핍 속에서 **자생적으로 형성되는 시장**.
5. **The all-encompassing Buy n Large corporation** — *WALL·E* · 0.339 — 모든 것에 찍힌 단일 기업. 보이지 않는 손이 독점으로 굳은 극단.
6. **Antonio's slap and the crowd** — *Bicycle Thieves* · 0.334 — 시장·거리의 군중이 스스로 모이고 흩어진다. 통제 없는 집합행동.

> 주의: *The Sorrow and the Pity*("우린 몰랐다") 등은 '무관한 개인들'이라는 어휘에 끌린 약한 매칭이라 제외.

---

## 4. Adam Tooze — **Polycrisis (폴리크라이시스)**

> **현상:** 왜 오늘의 재난은 *하나씩 오지 않는가.* 팬데믹이 전쟁으로, 에너지 충격으로, 인플레로, 부채로, 기후붕괴로 번지며 서로를 증폭한다. 세계가 너무 촘촘히 엮여 **충격이 제 차선에 머물지 않는다.** 설명하려던 현상 = **연쇄·동시·상호증폭하는 시스템 붕괴.**

매칭 이유는 "**여러 위기가 맞물려 연쇄·복합**되는" 현상에 연결됩니다.

1. **Montage of global news and military escalation** — *Arrival* · 0.454 — 방송·폭락·군사동원이 12개 지점에서 **동시에 연쇄**. 폴리크라이시스의 시각적 정의.
2. **The 'Verse-Jumping' editing** — *Everything Everywhere All at Once* · 0.402 — 문자 그대로 '모든 것이 한꺼번에'. 동시다발 충격의 형식.
3. **The Cross-Cut Structure** — *Traffic* · 0.362 — 워싱턴·샌디에이고·티후아나가 맞물려 **하나의 시스템**으로 작동. 상호연결성 그 자체.
4. **The multi-car pile-up** — *Trafic* · 0.354 — 연쇄추돌. 하나의 충격이 **연쇄반응**으로 번지는 모형.
5. **The locust plague** — *Days of Heaven* · 0.350 — 메뚜기떼에 이어 들불. **복합·중첩되는 재난**.
6. **The narrative's relentless pace of misfortunes** — *Memories of Matsuko* · 0.356 — 실직·학대·감옥·중독이 쉴 틈 없이 **쌓인다**. 복리로 터지는 위기.
7. **The Television Broadcasts** — *Dawn of the Dead* · 0.366 — 붕괴하는 시스템을 TV로 지켜봄. 위기 인식의 미디어 회로.
8. **Armageddon impact editing** — *Armageddon* · 0.368 — 파리·뉴욕·상하이 동시 타격. 전 지구적 동시 재난.
9. **Family breakdown vs Cuban Missile Crisis** — *The Butcher Boy* · 0.360 — 가정 붕괴와 세계 위기를 교차. **미시·거시 위기의 맞물림**.

---

## 5. Adrienne Massanari — **Toxic Technocultures (독성 테크문화)**

> **현상:** 왜 개방적·참여적이라는 바로 그 인터넷이 *조직적 잔혹*(괴롭힘 떼·여성혐오·브리게이딩)을 끊임없이 배양하는가. 이는 결함이 아니라 **플랫폼 설계의 산물** — 업보트·익명·바이럴이 가장 시끄러운 자를 보상하며 **공중을 떼(swarm)로, 놀이를 무기로** 바꾼다.

매칭 이유는 "**놀이/공동체가 떼의 잔혹으로 전화**되는" 현상에 연결됩니다. (현상 gloss가 'swarm·놀이의 무기화'를 강조해, 온라인뿐 아니라 *집단 잔혹* figure도 끌어왔습니다.)

1. **The "Facemash" sequence** — *The Social Network* · 0.401 — 사진을 해킹해 외모 순위를 매기는 사이트. **설계가 잔혹을 보상**하는 플랫폼의 기원.
2. **Therapy-speak** — *Bodies Bodies Bodies* · 0.392 — 'toxic/gaslighting' 같은 온라인 담론 어휘가 **떼의 무기**로.
3. **The rape-game video at the studio** — *Elle* · 0.386 — 여성을 습격하는 게임을 만드는 스튜디오. 게임문화의 여성혐오(게이머게이트의 공명).
4. **The Pig's Head Helmet Game** — *Monos* · 0.344 — 무리의 **놀이가 집단적 폭력으로** 전화. "놀이가 무기가 된다"의 정확한 형상.
5. **The kangaroo-shooting lesson** — *Snowtown* · 0.345 — 집단 안에서 **점증하는 잔혹**, 동조 속의 폭력.
6. **Miles Bron** — *Glass Onion* · 0.341 — '파괴적 천재'를 자처하는 테크 억만장자. 플랫폼 권력의 인격화.
7. **The Mirando broadcast spectacle** — *Okja* · 0.334 — 라이브스트림·점보트론으로 만드는 스펙터클·여론몰이.

---

## 6. Aihwa Ong — **Flexible Citizenship (유연한 시민권)**

> **현상:** 왜 부유한 가족은 여러 나라 여권과 대륙별 거주권을 들고 *국적을 운명이 아니라 최적화할 포트폴리오*로 다루는가 — 반면 이주민·난민의 몸은 시장이 값을 매겨 들이거나 내쫓는가. 설명하려던 현상 = **시장·이동성을 통해 협상되는, 전략적이고 불균등한 시민권.**

매칭 이유는 "**신분·국경·서류를 전략적으로 항행·연기(演技)하는**" 현상에 연결됩니다.

1. **Jason Bourne's self-sufficiency** — *The Bourne Identity* · 0.443 — 다통화·다언어로 제도 없이 자립하는 **이동하는 전략적 주체**. 유연 시민권의 순수형.
2. **The letters of transit** — *Casablanca* · 0.437 — 도시를 탈출시키는 비자. **이동성이 자산이 되는** 현상.
3. **The Contract Signing** — *The Man Who Sold His Skin* · 0.433 — 비자·계약이 몸을 결박. 시민권의 시장적 거래.
4. **Sam Ali's Tattooed Back** — *The Man Who Sold His Skin* · 0.411 — 등에 새긴 셰겐 비자. **몸에 값이 매겨진** 난민의 극단.
5. **The refugees' fake family papers** — *Dheepan* · 0.374 — 죽은 가족의 신분을 빌려 망명. **수행·패싱되는 정체성**의 정확한 사례.
6. **The exchanged passport photograph** — *The Passenger* · 0.368 — 여권 사진을 바꿔 다른 사람이 됨. 국적의 교환 가능성.
7. **The consulate waiting rooms** — *Transit* · 0.377 — 영사관·선적사무소를 오가며 서류를 협상. 신분의 관료적 항행.
8. **The succession of safe houses and capitals** — *Carlos* · 0.365 — 파리·베이루트·부다페스트를 옮겨다님. 국경 위의 전략적 이동성.
9. **The gilded transit of investors** — *The Phoenician Scheme* · 0.367 — 전용 열차·선박을 도는 초국적 자본의 순환.
10. **Fern** — *Nomadland* · 0.367 — 이동성으로 재편되는 불안정 시민-주체(엘리트의 반대편).

---

## 7. Alain Badiou — **The Event (사건)**

> **현상:** *아무것도 새로 일어날 수 없다*는 냉소의 시대에 맞서, 왜 현실이 때때로 *찢어지는가* — 혁명·사랑·발견·예술이 기존 질서가 셈할 수 없던 것으로 분출하는가. 설명하려던 현상 = **예측 불가능한 단절과, 그것이 요구하는 충실성.**

'사건'은 메타적·추상적이라 sim이 중간이고, 현상 gloss는 주로 **형식적 파열·단절** figure를 끌어옵니다. (v2의 '혁명/마오주의' 결과와 대비 — 그건 전기를 넣었을 때 나온 *정치적* 얼굴이고, 이건 *순수 현상*인 '단절'의 얼굴입니다.) 강한 7개.

1. **The Border-Crossing Long Take** — *Ulysses' Gaze* · 0.399 — 한 숏 안에서 시대·장소가 바뀐다. 질서가 **연속 속에서 찢기는** 단절.
2. **The film burning through** — *Persona* · 0.392 — 필름이 타들어가며 장치 자체가 파열. **재현 질서의 균열 = 사건.**
3. **The abrupt elliptical cut** — *À nos amours* · 0.386 — 해소 전 장면을 끊고 예고 없는 미래로. 장면들 사이에 일어나는 사건.
4. **The fractured chronology** — *Polytechnique* · 0.382 — 외상적 순간을 여러 시점으로 되돌려 시간을 재편. 사건이 연대기를 깨뜨림.
5. **Pete Seeger's diplomacy / the protagonist going electric** — *A Complete Unknown* · 0.382 — 딜런이 포크의 정통성을 깨고 일렉트릭으로 전향 = **예술적 사건과 그에 대한 (불)충실성**. 가장 Badiou적인 매칭.
6. **The conditional voice-over** — *Reprise* · 0.381 — '그러면 이런 일이 일어날 것이다' — 도래할 가능성(사건의 잠재성)을 투사.
7. **The ghost of luck running out** — *The Ballad of a Small Player* · 0.385 — 행운이 초자연적으로 돌변하는 순간. 셈할 수 없는 것의 분출.

---

## 8. Albert O. Hirschman — **Exit, Voice, and Loyalty (이탈·항의·충성)**

> **현상:** 내가 속한 것(회사·정당·국가·결혼)이 *쇠퇴하기 시작할 때* 나는 무엇을 하는가. 떠나거나(Exit), 남아서 목소리를 내거나(Voice) — 그 갈림길을 정하는 건 **애착(Loyalty)**이다. 설명하려던 현상 = **쇠퇴하는 조직 안에서의 떠남·발언·머무름의 선택.**

이번엔 gloss에서 *전기(나치 피신)*를 빼서, 지난 판을 오염시켰던 노이즈가 사라지고 핵심 현상으로 수렴했습니다.

1. **The vote chalked on the wall** — *Women Talking* · 0.390 — 선택지 "**Do Nothing / Stay and Fight / Leave**"를 벽에 그려 투표. **충성·항의·이탈과 거의 일대일.** (노이즈 제거로 다시 1위 복귀)
2. **Lee's final conversation with Patrick** — *Manchester by the Sea* · 0.314 — "난 못 이겨, 떠나야 해." **Exit(이탈)**의 순수형.
3. **The self-destructive divorce proceedings** — *Marriage Story* · 0.334 — 합의 이혼이 소송으로 격화. 결혼이라는 조직에서의 이탈·항의.
4. **The wives and mothers** — *By the Grace of God* · 0.355 — 지지·소진·방어·만류로 갈리는 **반응의 스펙트럼**. 쇠퇴에 대한 각기 다른 대응.
5. **The friend group's loyalties** — *Bodies Bodies Bodies* · 0.328 — 압박 속에 분열하는 우정·동맹. **Loyalty**와 그 균열.
6. **The contested IRA debate scenes** — *The Wind That Shakes the Barley* · 0.307 — 조약을 두고 헛간·법정에서 다툼. **Voice와 분열·이탈**의 정치적 형상.
7. **Ethan's choice over the team's lives** — *Dead Reckoning* · 0.319 — 사랑하는 이들을 거래하지 않겠다는 선택. 조직에 대한 **충성**.
8. **Amin and Kasper** — *Flee* · 0.343 — 떠남·정착·헌신을 둘러싼 긴장. 관계라는 조직에서의 Exit/Loyalty.

> 주의: *Decision to Leave*가 또 상위(0.379)에 떴으나 제목의 "Leave"에 끌린 **어휘성 오탐**이라 제외. 임베딩 매칭의 전형적 노이즈.

---

## 정리 — 이 방식이 준 것

1. **현상중심 gloss는 매칭을 '그 현상 자체'로 묶습니다.** 그래서 매칭 이유를 **개념의 발생 동기**와 자연스럽게 연결해 쓸 수 있습니다(폴리크라이시스=연쇄, 유연시민권=신분 항행, 사라짐=소멸이 곧 가시성).
2. **전기(고유명사)를 빼면 노이즈가 줄어듭니다.** Hirschman이 v2의 '나치 영화 쏠림'에서 벗어나 *Women Talking* 핵심 매칭으로 복귀한 게 그 증거입니다.
3. **개념의 어느 얼굴을 비추느냐가 결과를 정합니다.** Badiou는 '혁명'(전기 포함, v2)이냐 '단절'(순수 현상, v3)이냐에 따라 전혀 다른 figure가 옵니다 — 둘 다 옳은 다른 면.
4. **추상 개념은 여전히 약합니다.** 보이지 않는 손(0.34)·사건(0.40)은 sim이 낮습니다. 다만 현상 gloss 덕에 *틀린 게 아니라 약한* 매칭(창발적 질서·형식적 단절)으로 정확히 갑니다.
5. **남는 노이즈는 제목·단어 어휘성 오탐**(예: *Decision to Leave*의 'Leave'). 최종본은 사람 검수로 걸러야 합니다.
