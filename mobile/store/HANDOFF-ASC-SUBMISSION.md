# HANDOFF — App Store Connect 1.0 제출 (실행 지시서)

이 파일 하나만 읽고 끝까지 실행할 수 있게 썼다. 사실은 전부 실측(ASC API 읽기 /
ipa 열어보기 / 라이브 엔드포인트 호출)으로 확인했다.
최초 작성 2026-07-30 · **최종 실측 2026-07-31 22:5x KST**

절대경로 기준: `/Users/jerryje/Developer/MetaTake`

---

## 0. 지금 상태 (2026-07-31 ASC API로 실측)

```
앱          Metatake · ASC app id 6792487455 · bundle net.metatake.app
Apple Team  AYDX65J9H4
버전 1.0    appStoreState = PREPARE_FOR_SUBMISSION   ← 제출 안 됨
en-US       description 1,923자 ✅ · keywords ✅ · 스크린샷 6장 (⚠️ 구버전, §3 참조)
빌드        17 attached ✅
앱 정보     subtitle "Judge films before you watch" ✅ · 카테고리 Entertainment/Reference ✅
            privacyPolicyUrl ❌ MISSING
```

**아직 비어서 제출 버튼이 안 눌리는 것 — 이게 남은 전부다:**

| 항목 | 넣을 값 |
|---|---|
| 개인정보처리방침 URL | `https://metatake.net/privacy` (200 확인함) |
| 연령 등급 설문 | §6.1 |
| 가격 | 무료 |
| 출시 국가 | 전체 |
| 심사 연락처 | 오너 이름·전화·이메일 |
| 데모 계정 + **비밀번호** | §5.7 |
| 스크린샷 교체 | §3 — 현재 올라간 6장은 은퇴한 탭을 보여준다 |

ASC API 키는 **읽기 + 빌드 업로드 전용**이라 리스팅 필드 PATCH가 403이다.
위 항목은 전부 웹 콘솔에서 손으로 넣어야 한다.

## 1. 반드시 지킬 3가지

1. **빌드는 17을 선택한다.**
   빌드 15에는 서버용 Google Maps 키(애플리케이션 제한 없는 키)가 박혀 나갔다.
   16부터 번들ID 제한된 앱 전용 키가 들어갔고(ipa Info.plist 확인: 15 = GMSApiKey
   …9SM4 / 16 = …lsgc), **17이 현재 정본**이며 이미 ASC에 attach되어 있다.
2. **"심사 제출"(Submit for Review) 버튼은 누르지 않는다.** 오너가 누른다.
3. **로그인·비밀번호·2단계 인증은 대신 하지 않는다.** 오너가 직접 로그인한 뒤
   시작한다. Apple ID는 `wonwoo@metatake.net`.

## 2. ASC API로는 메타데이터를 못 쓴다 (실측)

`PATCH /v1/appInfoLocalizations/<id>` → **403 "The API key in use does not allow
this request"**. 이 ASC 키는 **읽기 + 빌드 업로드 전용**이다. 따라서 리스팅 입력은
**웹 UI에서 손으로** 해야 한다. API는 검증에만 쓴다(§8).

---

## 3. 파일 위치 (전부 절대경로)

| 내용 | 경로 |
|---|---|
| 모든 필드 값 (영어+한국어, 글자수 실측) | `/Users/jerryje/Developer/MetaTake/mobile/store/ASC-PASTE.md` |
| 영어 리스팅 원본 | `/Users/jerryje/Developer/MetaTake/mobile/store/listing-en.md` |
| 한국어 리스팅 원본 | `/Users/jerryje/Developer/MetaTake/mobile/store/listing-ko.md` |
| **심사 노트** (App Review Information → 메모) | `/Users/jerryje/Developer/MetaTake/mobile/store/REVIEW-NOTES.md` |
| **App Privacy 답변 근거** | `/Users/jerryje/Developer/MetaTake/mobile/store/PRIVACY-LABELS.md` |
| 연령 등급 문항별 답 | `/Users/jerryje/Developer/MetaTake/mobile/store/listing-en.md` 의 `### Age rating` 표 |
| **스크린샷 6장 (6.9″ = 1290×2796)** | `/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/` |
| 같은 6장 (6.5″ = 1284×2778) | `/Users/jerryje/Developer/MetaTake/mobile/store/shots-65/` |

스크린샷 파일명 (이 순서로 업로드):
```
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/01-tonight.png
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/02-brief.png
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/03-where-to-watch.png
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/04-locations.png
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/05-metatake-tv.png
/Users/jerryje/Developer/MetaTake/mobile/store/shots-69/06-explore.png
```

각 장이 보여주는 것 (심사자가 앱에서 그대로 찾을 수 있어야 하므로 실제 화면·실제
데이터다):

| # | 화면 | 담긴 것 |
|---|---|---|
| 01 | Tonight | TakeScore 정렬 · 연도 · On my services 칩 · 국가/서비스 선택 · 판정 덱 |
| 02 | 영화 브리프 | TakeScore 73 링 · #63 of 6978 · An Invitation · to.W 큐레이터 코멘트 |
| 03 | Where to watch | 내 서비스 기준 시청처 · JustWatch 표기 · Lineage(정전 순위) |
| 04 | Locations | 실제 구글 지도 + 핀 · Open in Google Maps · 촬영지 목록 |
| 05 | Metatake TV | 18챕터 영상 · Also playing in · The full page on Metatake |
| 06 | Explore | "114 lists — canons, prizes, festivals, national cinemas" · For you |

⚠️ **`shots-retired/`의 옛 6장은 절대 올리지 않는다.** 은퇴한 Map·Shelf 탭이 찍혀
있어서 지금 앱과 다르다. 심사자가 Map 탭을 찾다가 못 찾으면 "스크린샷이 앱을
정확히 반영하지 않음"으로 반려된다. 지금 ASC에 올라가 있는 6장이 바로 그 옛 판본이니
**반드시 교체**해야 한다.

ℹ️ 이 6장은 앱 번들을 그대로 react-native-web으로 렌더해 정확히 1290×2796으로 캡처한
것이다(코드·데이터 모두 실물). 다만 **Navigator 드라이브의 오버월드 지도는 이 렌더러
에서 그려지지 않아 뺐다** — 빈 지도를 올리는 건 옛 스크린샷과 같은 종류의 거짓이기
때문이다. 서비스의 제1기능이므로, 오너가 아이폰에서 `/navigator` 한 장을 찍어 넣으면
7번째 장으로 추가하는 것이 가장 좋다.

⚠️ `REVIEW-NOTES.md`는 2026-07-30에 고쳤다(커밋 000e4088). 그 전 판본에는 심사자를
없는 화면으로 보내는 오류 4개가 있었다: 코드가 6자리(실제 8자리)·retired된 Map 탭·
"My 탭"(현재 You)·온보딩 순서. **반드시 현재 파일을 쓸 것.**

---

## 4. 입력 순서 — 앱 정보 (앱 단위)

URL: https://appstoreconnect.apple.com/apps/6792487455/distribution/info

| 필드 | 값 |
|---|---|
| 부제 (Subtitle) | `Judge films before you watch` |
| 개인정보 처리방침 URL | `https://metatake.net/privacy` |
| 기본 카테고리 | Entertainment (엔터테인먼트) |
| 보조 카테고리 | Reference (참고) |

→ 저장

## 5. 입력 순서 — 버전 1.0 (App Store 탭)

URL: https://appstoreconnect.apple.com/apps/6792487455/distribution/ios/version/inflight

### 5.1 프로모션 텍스트 (152자 / 170)
```
Know if a film is worth your evening: TakeScore, a spoiler-free critical lead, and where it streams on your services - one screen before you press play.
```

### 5.2 설명 (1923자 / 4000)
```
Every night ends the same way: thirty minutes of scrolling, then a rerun. Metatake is built for the five minutes before you press play - it helps you judge a film before you watch it, not log it after.

Open a film and you get a judgment brief:

- TakeScore, an original 13-dimension critical score by Metatake Editorial, built from each film's critical and scholarly record. Not an average of user stars.
- An Invitation, a spoiler-free critical lead that tells you what kind of film this is and why it might deserve your evening.
- One judgment bar: want, pass, or seen. After you watch, rate it, and Metatake tells you how the score held up for you - a Find, Aligned, or a Letdown.

Then it helps you actually watch:

- A living queue: your watchlist crossed with the streaming services you pay for. Queues age honestly here - films are marked Fresh, Aging, or Stale, so the list stays a plan instead of a graveyard.
- Situation picks: Safe bet, Hidden gems, 90 in 90 min, Bold pick. Chips for the evening you are actually having.
- Where to watch, on your services, in your country. Editions for multiple countries: switch country and availability follows.
- 17,000 filming locations on a map, including "Near me" when you are out walking.
- Director cards: a filmography with availability dots, so "watch everything by her" becomes a plan.

The catalog is a curated body of about 7,000 films with full critical treatment - chosen, not scraped. If a film is not in it yet, search still finds it and points you to the wider record.

Metatake is free. No ads, no third-party trackers. Browsing needs no account; an account exists only to keep your queue and judgments, and you can delete it inside the app. Criticism and scores are by Metatake Editorial at metatake.net.

Streaming availability powered by JustWatch. Film metadata and images from TMDB. This app uses the TMDB API but is not endorsed or certified by TMDB.
```

### 5.3 키워드 (100자 / 100 — 공백 없음)
```
movies,streaming,watchlist,critic,scores,reviews,cinephile,arthouse,locations,tonight,queue,director
```

### 5.4 URL·저작권
| 필드 | 값 |
|---|---|
| 지원 URL | `https://metatake.net/about` |
| 마케팅 URL | `https://metatake.net/app` |
| 저작권 | `© 2026 Metatake` |

### 5.5 스크린샷
**기존 6장을 먼저 지운다** (은퇴한 탭이 찍힌 옛 판본이다 — §3 경고).
그다음 **iPhone 6.9" 디스플레이** 슬롯에 `shots-69/`의 6장을 파일명 순서대로 올린다.
다른 크기 슬롯은 비워도 된다(Apple이 축소해 쓴다). ASC가 6.5″를 따로 요구하면
`shots-65/`의 같은 6장을 쓴다.

### 5.6 빌드
"빌드" 섹션 → **17**이 이미 붙어 있다. 그대로 둔다.
수출 규정 질문은 뜨지 않는 게 정상 — `ITSAppUsesNonExemptEncryption=false`가 빌드에 있다.

### 5.7 앱 심사 정보
- **로그인 필요: 예** — 심사자가 계정·비밀번호를 요구했다. 2026-07-31 빌드부터
  이메일+비밀번호 로그인이 들어갔고, 이 계정은 실제로 만들어져 있다:
  ```
  사용자 이름   appstore.review@metatake.net
  비밀번호      Review-IEsheX0CHD47
  ```
  (계정 없이도 Tonight·Explore·영화 브리프는 전부 볼 수 있다. 계정은 찜·본 영화
  기록을 확인할 때만 필요하다 — 그 문장을 메모에 남겨두면 심사가 빨라진다.)
- **메모**: `REVIEW-NOTES.md` 전문을 붙여넣는다
- 연락처: 오너 이름·전화·이메일 (지금 **전부 비어 있다**)

---

## 6. 연령 등급 & App Privacy (오너 확인 후 저장)

법적 신고 성격이므로 **입력 후 오너에게 화면을 보여주고 확인받는다.**

### 6.1 연령 등급
**Infrequent/Mild (드물게/약함)** — 이 6개만:
사실적 폭력 · 성적 콘텐츠/노출 · 욕설/저속한 유머 · 성인·선정적 주제 ·
공포/공포 테마 · 알코올·담배·약물 사용 또는 언급

**나머지 전부 None**, **제한 없는 웹 접근 = 아니요**
(근거: 영화 포스터·스틸과 인용된 비평문. 인앱 리더는 metatake.net만 연다.)

→ 예상 **12+**. 17+로 계산되면 성적 콘텐츠·성인 주제 두 항목을 재검토.

### 6.2 App Privacy
최상위: **데이터 수집함 / 추적하지 않음**

**사용자에게 연결된 데이터 (Data Linked to You)**
| 데이터 유형 | 목적 |
|---|---|
| 연락처 정보 → 이메일 주소 | 앱 기능 |
| 사용자 콘텐츠 → 기타 사용자 콘텐츠 (찜·본 영화·평점) | 앱 기능 |
| 식별자 → 사용자 ID | 앱 기능 |
| 식별자 → 기기 ID (푸시 토큰, 알림 켤 때만) | 앱 기능 |
| 기타 데이터 → 국가·언어·서비스 설정 | 앱 기능 |

**연결되지 않은 데이터 (Data Not Linked to You)**
| 사용 데이터 → 제품 상호작용 (서버 요청 로그) | 분석 |

**위치: 수집하지 않음** — "내 주변"은 기기 안에서만 동작하고 좌표를 전송하지 않는다
(Apple의 "수집"은 기기 밖 전송을 뜻함).
**추적에 사용: 아니요** — 광고·서드파티 분석 SDK가 하나도 없다.

상세 근거는 `PRIVACY-LABELS.md`.

---

## 7. 한국어 현지화 (선택, 한국 스토어용)

우상단 언어 추가 → 한국어

| 필드 | 값 |
|---|---|
| 부제 (10자) | `보기 전에, 판단.` |
| 키워드 (61자) | `영화,영화추천,오늘뭐보지,스트리밍,왓치리스트,평점,영화비평,시네필,예술영화,촬영지,감독,명작,고전영화,인생영화` |

프로모션 텍스트 (77자):
```
재생 버튼을 누르기 전 5분을 위한 앱. 테이크스코어, 스포일러 없는 비평 리드, 내 구독 서비스의 시청 가능 여부까지 한 화면에서 본다.
```

설명 (1097자):
```
밤마다 같은 일이 반복된다. 30분을 스크롤하다가 결국 봤던 걸 또 튼다. Metatake는 재생 버튼을 누르기 전 5분을 위해 만든 앱이다. 본 뒤에 기록하는 게 아니라, 보기 전에 판단한다.

영화 하나를 열면 판단에 필요한 것이 한 화면에 모인다.

- 테이크스코어(TakeScore) — Metatake Editorial이 영화의 비평·학술 기록을 토대로 매기는 13차원 비평 점수. 별점 평균이 아니다.
- 인비테이션(An Invitation) — 스포일러 없는 비평 리드. 이 영화가 어떤 영화이고 왜 오늘 밤을 걸 만한지 알려준다.
- 판단 바 하나 — 찜 / 패스 / 봤다. 보고 나서 점수를 매기면, 그 판단이 나에게 맞았는지 알려준다. 발견(Find), 일치(Aligned), 실망(Letdown).

그리고 실제로 보게 만든다.

- 살아 있는 큐 — 왓치리스트를 내가 실제로 구독하는 서비스와 교차한다. 큐는 정직하게 나이 든다. Fresh / Aging / Stale 표시 덕에 리스트가 무덤이 아니라 계획으로 남는다.
- 상황별 추천 칩 — 안전한 선택, 숨은 수작, 90분 안에 90점, 과감한 선택. 오늘 저녁의 상태에 맞춰 고른다.
- 어디서 보나 — 내 나라, 내 서비스 기준. 다국가 에디션이라 설정에서 국가만 바꾸면 시청 가능 정보가 그 나라로 따라온다.
- 촬영지 17,000곳 — 지도 위에서. 산책 중이라면 "내 주변" 촬영지도 찾아준다.
- 감독 카드 — 시청 가능 여부가 점으로 찍힌 필모그래피. "이 감독 전작 보기"가 계획이 된다.

카탈로그는 온전한 비평을 갖춘 약 7,000편의 선별작이다. 긁어모은 목록이 아니라 고른 목록이다. 아직 없는 영화도 검색은 찾아주고, 더 넓은 기록으로 연결한다.

Metatake는 무료다. 광고 없음, 서드파티 트래커 없음. 둘러보는 데 계정은 필요 없다. 계정은 큐와 판단 기록을 보관하는 용도이며, 앱 안에서 삭제할 수 있다. 비평과 점수는 metatake.net의 Metatake Editorial이 만든다.

스트리밍 정보 제공: JustWatch. 영화 메타데이터·이미지: TMDB. 이 앱은 TMDB API를 사용하지만 TMDB의 보증·인증을 받은 것은 아닙니다.
```

---

## 8. 검증 (API 읽기 — 입력 후 실행)

ASC 키: `/Users/jerryje/Downloads/AuthKey_65Y5238S83.p8`
key id `65Y5238S83` · issuer `c8e610f8-b12a-47e9-ade5-b193a2e84d01`

⚠️ ES256 서명은 node crypto에서 **`dsaEncoding: 'ieee-p1363'`** 이 필수(안 주면 서명이 거부됨).
node는 PATH에 없다 → `export PATH="$HOME/.local/node/bin:$PATH"`.

```bash
export PATH="$HOME/.local/node/bin:$PATH"
node -e "
const fs=require('fs'), crypto=require('crypto');
const p8=fs.readFileSync('/Users/jerryje/Downloads/AuthKey_65Y5238S83.p8','utf8');
const now=Math.floor(Date.now()/1000);
const b64=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const h=b64({alg:'ES256',kid:'65Y5238S83',typ:'JWT'});
const b=b64({iss:'c8e610f8-b12a-47e9-ade5-b193a2e84d01',iat:now,exp:now+600,aud:'appstoreconnect-v1'});
const sig=crypto.createSign('SHA256').update(h+'.'+b).sign({key:p8,dsaEncoding:'ieee-p1363'}).toString('base64url');
const jwt=h+'.'+b+'.'+sig;
const g=async u=>(await fetch('https://api.appstoreconnect.apple.com'+u,{headers:{authorization:'Bearer '+jwt}})).json();
(async()=>{
  const vs=await g('/v1/apps/6792487455/appStoreVersions?limit=1');
  const v=vs.data[0];
  console.log('state:', v.attributes.appStoreState);
  const L=await g('/v1/appStoreVersions/'+v.id+'/appStoreVersionLocalizations');
  for(const l of L.data){
    const ss=await g('/v1/appStoreVersionLocalizations/'+l.id+'/appScreenshotSets');
    let n=0; for(const s of ss.data){const x=await g('/v1/appScreenshotSets/'+s.id+'/appScreenshots'); n+=x.data.length;}
    console.log(l.attributes.locale, '| desc', l.attributes.description?.length||0, '| kw', !!l.attributes.keywords, '| shots', n);
  }
  const bld=await g('/v1/appStoreVersions/'+v.id+'/build');
  console.log('build:', bld.data? bld.data.attributes.version : 'NONE');
  // 제출을 막고 있는 것들 — 비어 있으면 제출 버튼이 안 눌린다
  const rd=await g('/v1/appStoreVersions/'+v.id+'/appStoreReviewDetail');
  const a=rd.data?rd.data.attributes:{};
  console.log('demo:', a.demoAccountName||'(없음)', '/', a.demoAccountPassword?'비번있음':'비번없음');
  console.log('contact:', [a.contactFirstName,a.contactLastName,a.contactEmail,a.contactPhone].join('|'));
  const ai=await g('/v1/apps/6792487455/appInfos');
  const full=await g('/v1/appInfos/'+ai.data[0].id);
  console.log('ageRating:', full.data.attributes.appStoreAgeRating||'미설정');
  const ail=await g('/v1/appInfos/'+ai.data[0].id+'/appInfoLocalizations');
  console.log('privacyUrl:', ail.data[0].attributes.privacyPolicyUrl||'미설정');
})();
"
```

**합격 기준**: `desc` 1900+ · `kw true` · `shots 6`(새 6장으로 교체된 것) ·
`build 17` · `demo 비번있음` · `contact` 4칸 다 참 · `ageRating` 값 있음 ·
`privacyUrl` 값 있음. 여기에 가격(무료)·출시 국가까지 저장되면 제출 버튼이 열린다.
그 뒤 오너가 심사 제출을 누르면 state가 `PREPARE_FOR_SUBMISSION` →
`WAITING_FOR_REVIEW`로 바뀐다.

---

---

## 9. TestFlight 배포 상태 (2026-07-31 실측)

```
Internal(내부)  테스터 wonwoo@metatake.net        빌드 17,16,15,14,9,8,7,6
Friends(외부)   테스터 wonjah@gmail.com           빌드 9  ← 여기서 멈춰 있다
빌드 17 외부심사(Beta App Review)                  제출 안 됨
```

**wonjah@gmail.com은 이미 테스터로 등록되어 있다.** 추가할 필요가 없다. 문제는
그 사람이 속한 외부 그룹에 **빌드 9만** 배포되어 있다는 것이다. 빌드 9는 OTA(JS)
업데이트는 계속 받으므로 화면·로직은 최신이지만, **네이티브가 바뀐 것은 못 받는다**
— 인앱 구글 지도, 새 앱 아이콘, Apple 로그인 버튼이 전부 빠져 있다.

빌드 17을 외부 그룹에 주려면 **TestFlight Beta App Review**를 한 번 통과해야 한다
(외부 테스터는 심사 없이 못 받는다. 내부 테스터는 즉시 받는다 — 그래서 오너만
17을 쓰고 있는 것이다).

ASC API 키로는 둘 다 403이다(읽기+빌드업로드 전용). 웹 콘솔에서 해야 한다:

**App Store Connect → TestFlight**
1. 왼쪽 **그룹 → Friends**
2. **빌드** 탭 → `+` → **17** 선택
3. 외부 그룹이라 "베타 심사 정보"를 물어본다 → 연락처·데모계정(§5.7 값)·
   "무엇을 테스트하나" 한 줄 → **제출**
4. 승인되면(보통 하루 안) wonjah@gmail.com에게 자동으로 알림이 간다

즉시 받게 하려면 대신 **내부 테스터**로 올릴 수도 있다(심사 없음). 다만
`사용자 및 액세스`에서 팀 사용자로 초대해야 하고, 그 사람이 ASC 계정 권한을 갖게
된다 — 친구 테스트 목적이라면 위 외부 경로가 맞다.
