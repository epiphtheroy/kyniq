# Cinecodex Anchor Set v1 — 50편 + 평가 키 (Evaluation Key)

> 이 50편은 **(획득가치 V × 위험도 R) 평면의 네 사분면 + 시대·국가·장르·난이도**를 고르게 덮도록 선별했다.
> 각 영화의 `예상 V/R`은 **비평적 합의에 기반한 나의 사전 기대치(prior)** — *정답이 아니라 채점 대상 AI를 평가하는 기준선*이다.
> 4개의 시금석(★)은 평가자에게 **기준작으로 주지 않는다**(블라인드 검증). 5개 기준작(reference anchors)은 프롬프트에 별도로 박혀 자를 고정한다.

## 선별 논리 (왜 이 구성인가)
- **사분면 균형:** 각 사분면 12~13편 — 한쪽으로 쏠리면 지수가 그 영역만 잘 구분하고 나머지는 뭉갠다.
- **극단 정박작(consensus extremes):** 누구나 동의하는 최상/최하를 넣어 자의 양 끝을 고정(표면타당도 + 자 표류 감지).
- **분열성 시험작:** 옹호자·반대자가 분명히 갈리는 작품(안티크라이스트, 라스트 제다이, 조커)을 넣어 *위험축이 실제로 작동하는지* 본다.
- **같은 감독 대조쌍:** 샤젤(라라랜드/바빌론), 아로노프스키(mother!-기준작/파운틴) — 감독 명성이 아니라 작품을 본다는 증거.
- **비서구·여성·흑인 감독 포함:** 오즈·구로사와·왕가위·봉준호·미야자키·파라디·키아로스타미·아커만(여)·시아마(여)·젱킨스(흑인) — 서구·남성 편향 방어.
- **난이도(C) 분산:** 12 Angry Men(저C)부터 Jeanne Dielman(고C)까지 — C축도 분별되는지 확인.

---

## 사분면 A — 高가치·低위험 ("안전한 걸작": 실패 두려운 사람의 입문)
| # | 영화 | 감독 | 연도 | 예상 V | 예상 R |
|---|---|---|---|---|---|
| 1 | Poetry (시) ★ | Lee Chang-dong | 2010 | 90 | 15 |
| 2 | La La Land ★ | Damien Chazelle | 2016 | 78 | 28 |
| 3 | Seven Samurai | Akira Kurosawa | 1954 | 93 | 12 |
| 4 | In the Mood for Love | Wong Kar-wai | 2000 | 90 | 18 |
| 5 | Parasite | Bong Joon-ho | 2019 | 85 | 20 |
| 6 | City Lights | Charlie Chaplin | 1931 | 88 | 12 |
| 7 | Spirited Away | Hayao Miyazaki | 2001 | 85 | 15 |
| 8 | The Godfather | Francis Ford Coppola | 1972 | 90 | 12 |
| 9 | 12 Angry Men | Sidney Lumet | 1957 | 80 | 12 |
| 10 | A Separation | Asghar Farhadi | 2011 | 86 | 16 |
| 11 | Portrait of a Lady on Fire | Céline Sciamma | 2019 | 84 | 22 |
| 12 | Moonlight | Barry Jenkins | 2016 | 83 | 24 |

## 사분면 B — 高가치·高위험 ("고위험 고수익": 준비된 모험가)
| # | 영화 | 감독 | 연도 | 예상 V | 예상 R |
|---|---|---|---|---|---|
| 13 | 2001: A Space Odyssey | Stanley Kubrick | 1968 | 92 | 45 |
| 14 | The Tree of Life | Terrence Malick | 2011 | 82 | 65 |
| 15 | Mulholland Drive | David Lynch | 2001 | 88 | 50 |
| 16 | Synecdoche, New York | Charlie Kaufman | 2008 | 80 | 62 |
| 17 | Jeanne Dielman | Chantal Akerman | 1975 | 85 | 70 |
| 18 | Antichrist | Lars von Trier | 2009 | 58 | 80 |
| 19 | Holy Motors | Leos Carax | 2012 | 78 | 68 |
| 20 | Uncut Gems | Safdie Brothers | 2019 | 74 | 55 |
| 21 | Beau Is Afraid | Ari Aster | 2023 | 60 | 72 |
| 22 | Close-Up | Abbas Kiarostami | 1990 | 86 | 48 |
| 23 | Enemy | Denis Villeneuve | 2013 | 70 | 55 |
| 24 | Climax | Gaspar Noé | 2018 | 55 | 78 |

## 사분면 C — 低가치·低위험 ("안전하나 수확 적음": 편안한 오락)
| # | 영화 | 감독 | 연도 | 예상 V | 예상 R |
|---|---|---|---|---|---|
| 25 | Batman Returns ★ | Tim Burton | 1992 | 35 | 25 |
| 26 | Top Gun: Maverick | Joseph Kosinski | 2022 | 42 | 18 |
| 27 | Ocean's Eleven | Steven Soderbergh | 2001 | 40 | 15 |
| 28 | Ant-Man | Peyton Reed | 2015 | 25 | 22 |
| 29 | John Wick | Chad Stahelski | 2014 | 38 | 25 |
| 30 | Crazy Rich Asians | Jon M. Chu | 2018 | 30 | 20 |
| 31 | The Hangover | Todd Phillips | 2009 | 28 | 28 |
| 32 | Jurassic World | Colin Trevorrow | 2015 | 20 | 28 |
| 33 | Knives Out | Rian Johnson | 2019 | 52 | 22 |
| 34 | The Intouchables | Nakache/Toledano | 2011 | 40 | 30 |
| 35 | Free Guy | Shawn Levy | 2021 | 28 | 26 |

## 사분면 D — 低가치·高위험 ("야심 찬/공허한 분열작": 지뢰밭)
| # | 영화 | 감독 | 연도 | 예상 V | 예상 R |
|---|---|---|---|---|---|
| 36 | Babylon ★ | Damien Chazelle | 2022 | 52 | 65 |
| 37 | Cloud Atlas | Wachowskis/Tykwer | 2012 | 48 | 68 |
| 38 | The Counselor | Ridley Scott | 2013 | 38 | 70 |
| 39 | Joker | Todd Phillips | 2019 | 55 | 62 |
| 40 | Don't Look Up | Adam McKay | 2021 | 40 | 66 |
| 41 | Star Wars: The Last Jedi | Rian Johnson | 2017 | 50 | 70 |
| 42 | Sucker Punch | Zack Snyder | 2011 | 22 | 62 |
| 43 | Spring Breakers | Harmony Korine | 2012 | 50 | 72 |
| 44 | The Fountain | Darren Aronofsky | 2006 | 55 | 64 |
| 45 | Southland Tales | Richard Kelly | 2006 | 35 | 75 |
| 46 | Suicide Squad | David Ayer | 2016 | 18 | 55 |
| 47 | Vox Lux | Brady Corbet | 2018 | 52 | 66 |
| 48 | Avatar: The Way of Water | James Cameron | 2022 | 45 | 45 |
| 49 | Mamma Mia! | Phyllida Lloyd | 2008 | 20 | 30 |
| 50 | Now You See Me | Louis Leterrier | 2013 | 22 | 32 |

*(주의: #49–50은 사실 低가치·低위험에 가깝다 — 경계 사례로 일부러 섞어 모델의 분별력을 시험.)*

---

## 채점 통과 기준 (control-tower QC)
1. **시금석 4개 제약:** V(시) > V(배트맨); V(라라랜드) > V(바빌론); R(바빌론) > R(라라랜드); 배트맨·바빌론 모두 U 하위권.
2. **기준작 순응:** 프롬프트에 박은 5개 기준작 인근 영화가 그 자를 따르는가.
3. **극단 표면타당도:** Seven Samurai/Godfather/Tokyo급은 V 상위; Jurassic World/Mamma Mia급은 V 하위; Antichrist/Climax/Southland Tales는 R 상위.
4. **일관성(가장 중요):** 3 평가자 간 영화별 V·R 표준편차 평균 ≤ ~8 (목표 ≤6), 평가자 쌍 간 V 상관 ≥ 0.90.
5. **상관 구조:** V와 흥행/인기는 낮은 상관(판별타당도), V와 C는 약한 양의 상관은 허용하되 *C가 V를 결정하면 실패*(난이도=가치 오염).
