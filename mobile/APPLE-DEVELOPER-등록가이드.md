# Apple Developer Program 등록 — 그대로 따라 하기 (2026-07-18)

> 등록 자체(Apple ID·본인확인·결제)는 오너만 할 수 있습니다. 이 문서는 **화면에 뜨는 버튼 그대로** 따라 하도록 만든 가이드이고, 앱 생성 때 입력할 값은 §5에 **우리 코드 실측값**으로 미리 채워뒀습니다. 등록이 끝나면 **Team ID 하나만 저에게 알려주시면** 나머지(AASA 교체·앱 생성·빌드)는 제가 이어서 처리합니다. 이후 전체 순서는 `LAUNCH-RUNBOOK.md`.

---

## §0. 시작 전 준비물 (5분)

- [ ] **Apple ID** — 개인적으로 쓰시는 것 하나. 이걸로 개발자 계정이 묶입니다(나중에 바꾸기 번거로우니 오래 쓸 계정으로).
- [ ] **2단계 인증(2FA) 켜짐** — 필수. 아이폰 설정 ▸ [내 이름] ▸ 로그인 및 보안 ▸ 2단계 인증이 "켬"인지 확인. 꺼져 있으면 먼저 켜세요.
- [ ] **신용/체크카드** — $99/년(약 14만 원, 자동 갱신). 갱신 원치 않으면 나중에 끌 수 있음.
- [ ] **신분증** — 신형 개인 등록은 여권/운전면허 등 정부 신분증 스캔 + 셀피 본인확인을 요구할 수 있습니다(앱이 안내). 미리 곁에 두세요.
- [ ] **소요 시간** — 결제까지 10~15분. 승인은 **보통 몇 분~48시간**(개인은 대체로 빠름). 승인 메일 "Welcome to the Apple Developer Program" 오면 완료.

---

## §1. 먼저 결정: 개인(Individual) vs 조직(Organization)

**권고: 개인(Individual / Sole Proprietor)** — 지금은 이걸로 하세요.

| | 개인(Individual) ✅권장 | 조직(Organization) |
|---|---|---|
| 비용 | $99/년 | $99/년 |
| 추가 요건 | 없음 | **D-U-N-S 번호**(사업자 식별번호) 필요 — 무료지만 발급에 며칠~몇 주 |
| 속도 | 빠름(당일~2일) | 느림(D-U-N-S 대기) |
| App Store "판매자(Seller)" 표기 | **본인 법적 이름**(예: Wonwoo Yoon) | 회사명(Metatake) |
| 앱 이름 표기 | **Metatake** (동일) | **Metatake** (동일) |

⚠️ 유일한 실질 차이는 리스팅 하단의 작은 **"Seller(판매자)" 줄**입니다 — 개인은 본인 이름, 조직은 회사명. **앱 이름은 둘 다 "Metatake"로 동일**하게 나갑니다. 나중에 개인→조직 전환도 가능합니다. **속도가 중요하니 개인으로 시작**하시길 권합니다. (회사명을 판매자로 꼭 노출해야 한다면 조직 + D-U-N-S 먼저 발급 → 별건.)

---

## §2. 등록 절차 A — 아이폰 "Apple Developer" 앱 (⭐권장·가장 쉬움)

애플이 개인 등록을 이 경로로 유도하고, Face ID·기존 결제수단으로 제일 매끄럽습니다.

1. 아이폰 **App Store** → 검색창에 **`Apple Developer`** → 파란 제작도구 아이콘의 **Apple Developer**(제공: Apple) 설치.
2. 앱 열기 → 우측 하단 **`계정(Account)`** 탭 → 위 §0의 Apple ID로 **로그인**. (2FA 코드 입력)
3. 계정 화면에서 **`등록(Enroll)`** 또는 **`Apple Developer Program 가입`** 배너 탭.
4. **`시작하기(Get Started)`** → 개체 유형에서 **`개인 / 1인 사업자(Individual / Sole Proprietor)`** 선택.
5. **개인 정보 확인** — 이름·주소가 **정부 신분증과 일치**해야 합니다(이게 판매자명이 됨). 영문 이름 표기 권장.
6. **Apple Developer 계약** 검토 → **동의**.
7. **본인 확인(요청 시)** — 앱이 카메라로 신분증 앞/뒤 + 셀피를 스캔하도록 안내. 그대로 진행.
8. **결제** — **$99/년** 인앱 결제(Apple ID 결제수단). Face ID/암호로 승인.
9. **완료 대기** — 화면에 "심사 중" 표시. 승인되면 메일 도착. 그 전엔 아무것도 안 하셔도 됩니다.

---

## §3. 등록 절차 B — 웹 (앱이 안 되면 이 경로)

1. 브라우저에서 **https://developer.apple.com/programs/enroll/** 접속 → **`Start Your Enrollment`**.
2. Apple ID로 **Sign In**(2FA).
3. **Entity Type**에서 **`Individual / Sole Proprietor`** 선택 → Continue.
4. 개인정보 입력 → 약관 동의 → (요청 시) 본인확인 → **$99** 결제.
5. 승인 메일 대기.

> 웹 결제가 막히거나 "We were unable to complete your purchase" 뜨면 → §6 참고, 또는 아이폰 앱(§2)으로 시도하면 대부분 해결됩니다.

---

## §4. 승인된 뒤 — 딱 한 가지만 저에게 주세요

승인 메일이 오면:

1. 브라우저 **https://developer.apple.com/account** 로그인.
2. 왼쪽/상단 **`Membership details`**(멤버십 세부정보) 클릭.
3. **`Team ID`** 항목의 **10자리 값**(예: `AB12CD34EF`)을 복사.
4. 👉 **그 Team ID를 저에게 알려주세요.** 제가 바로 처리합니다:
   - `public/.well-known/apple-app-site-association`의 `TEAMID` → 실제 값 교체(딥링크 활성화)
   - 이후 `LAUNCH-RUNBOOK.md §1`의 나머지(eas init·앱 레코드·빌드) 진행

그 다음 App Store Connect에서 **앱 생성**을 하실 때 아래 §5 값을 그대로 입력하시면 됩니다.

---

## §5. 앱 생성 시 입력값 (제가 실측해 채워둔 값 — 그대로 붙여넣기)

App Store Connect(appstoreconnect.apple.com) ▸ **My Apps ▸ ➕ ▸ New App** 에서:

| 필드 | 입력값 | 비고 |
|---|---|---|
| Platform | **iOS** | |
| Name | **Metatake** | 스토어 표시 이름. 선점됐으면 `mobile/store/listing-en.md`의 대안명 |
| Primary Language | **English (U.S.)** | 미국 기본 스토어프론트 |
| Bundle ID | **net.metatake.app** | ⚠️앱 코드(`app.json`)와 **정확히 일치해야 함**. 목록에 없으면 "Register a new bundle ID"로 이 값 등록 후 선택 |
| SKU | **metatake-app** | 아무 고유 문자열이면 됨(스토어 비노출). 이 값 권장 |
| User Access | Full Access | 혼자면 그대로 |

- 앱 버전: **1.0.0** (코드 현재값)
- 리스팅 텍스트·스크린샷·연령등급·심사노트·개인정보라벨은 전부 준비돼 있습니다: `mobile/store/`(listing-en.md·listing-ko.md·ASSETS.md·REVIEW-NOTES.md·PRIVACY-LABELS.md·shots/).
- 한국 스토어프론트: 앱 생성 후 **Pricing and Availability**에서 대한민국 체크 + 한국어 현지화 메타데이터에 `listing-ko.md` 입력(추가 비용 없음).

---

## §6. 자주 막히는 지점

- **"2FA를 켜라"** → 등록 전 Apple ID에 2단계 인증 필수(§0).
- **본인확인 실패** → 신분증 이름과 입력한 개인정보(이름 철자·생년) 일치 확인. 밝은 곳에서 재시도.
- **결제 오류** → 카드 해외결제 허용 확인, 아이폰 앱 경로(§2)로 재시도가 가장 잘 됨.
- **승인이 48시간 넘게 지연** → 스팸함 확인 후, developer.apple.com 우하단 **Contact Us**로 문의.
- **개인 이름이 판매자로 노출되는 게 싫다** → 조직 등록(D-U-N-S) 필요 — 별건. 우선 개인으로 출시하고 나중에 전환 가능.

---

## 요약: 오너가 할 일 3줄

1. 아이폰 **Apple Developer 앱** 설치 → **개인(Individual)**으로 등록 → **$99** 결제(§2).
2. 승인 메일 후 **Team ID 10자리**를 복사(§4).
3. 그 Team ID를 저에게 알려주세요 — 나머지는 제가 이어서 합니다.
