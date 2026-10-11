# 회귀 주입 (TG6 6.2, SR-8.9) — 2026-10-11 15:40~15:55 KST

주입은 워킹트리가 아니라 **임시 사본**에서 했다 — 워크트리를 스크래치패드로 `rsync`(node_modules·build·.gradle·.git·dist 제외, `portal-fe/node_modules` 는 원본 심링크 — 락파일 동일 확인)한 트리다. 주입은 한 곳 정확히 일치할 때만 바꾸는 치환 스크립트로 넣었고, 주입마다 원본 파일을 되돌렸다. 끝에 사본의 주입 대상 7개 파일이 워크트리와 같은지 `cmp` 로 확인했다. 주입은 모두 컴파일되는 회귀다(FE 사본 `npx tsc -b` 0 · Gradle 은 컴파일 통과 후 테스트 실패).

## 1. 단위 게이트

FE 명령: 사본에서 `npx tsc -b` → `npx vitest run src/pages/place/__tests__/cardFacts.test.ts src/pages/place/__tests__/PlacePage src/pages/place/__tests__/AttractionPage.actionBar.test.tsx`(178건).
Gradle 명령: `./gradlew :search:app:test --tests '*SearchAttractionServiceTest' --rerun` · `./gradlew :analytics:app:test --tests '*ClickHouseAttractionPopularityAdapterTest' --rerun`. 빨강 이름은 vitest `FAIL` 줄 · JUnit XML 실패 테스트 이름 그대로다.

| # | 주입 (파일) | tsc / 컴파일 | 결과 | 빨강을 낸 테스트 |
|---|---|---|---|---|
| R1 | `sigunguName = if (summarize) null else region?.sigunguName` (`SearchAttractionService.kt`) | 통과 | 77 중 1 실패 | Then: region 은 null 이어도 sigunguName 은 싣는다 |
| R2 (변형 1) | `weekdayOf` 를 `new Date().getDay()` 로 — 인자 무시, 시계 사용 (`placeAttributes.ts`) | 0 | 178 중 3 실패 | cardFacts — KST 날짜 경계 > 요일은 인자 날짜로만 정한다 — 시스템 시계(수요일)와 기기 시간대가 달라도 같은 판정 · cardFacts — 카드 상태 배지 표 > WEEKLY 이고 오늘(KST) 요일이 휴무일이면 「오늘은 정기휴무일」 + 규칙 기준 접근성 문구 · cardFacts — 카드 상태 배지 표 > 최대 3개 · 순서는 휴무 → 무료 → 반려 → 무장애 → 주차 (넘치면 뒤를 버린다) |
| R2 (변형 2) | `weekdayOf` 를 `new Date(date).getDay()` 로 (`placeAttributes.ts`) | 0 | 178 중 1 실패 | cardFacts — KST 날짜 경계 > 요일은 인자 날짜로만 정한다 — … — `cardFacts.test.ts:130` **`TZ=America/Los_Angeles` 단언**(`expected [ 'weeklyClosed' ] to deeply equal [ 'closedToday' ]`). `TZ=Asia/Seoul` 단언(:126)은 이 변형에서 초록 — LA 단언이 이 변형을 잡는 유일한 단언이다 |
| R2b | `PlaceCard` 가 `today` 로 상수 `'2026-10-26'` 을 넘김 (`PlacePage.tsx`) | 0 | 178 중 3 실패 | PlacePage 허브 카드 > KST 화요일에는 같은 카드가 「월 휴무」다 · PlacePage 허브 카드 > 영문 카드 — 「시군구, 시도」와 영문 배지 · PlacePage 허브 카드 > 주소 줄이 없고, meta 줄에 분류 · 지역 라벨 · 거리 · 찜, 배지 목록, 개요가 그 순서로 있다 |
| R3 | 주차 `NO`·`UNKNOWN` 에 「주차 불가」 배지 (`placeAttributes.ts`) | 0 | 178 중 2 실패 | cardFacts — 카드 상태 배지 표 > 그리지 않는 값 — 요일 없는 WEEKLY · NO_WEEKLY · UNKNOWN · null, 주차 NO·UNKNOWN, 입장 PAID·UNKNOWN, 반려 UNKNOWN · PlacePage 허브 카드 > 배지가 없으면 목록을 그리지 않는다 |
| R4 | 상한 3 제거 — `slice(0, CARD_BADGE_MAX + 99)` (`placeAttributes.ts`) | 0 | 178 중 2 실패 | cardFacts — 카드 상태 배지 표 > 최대 3개 · 순서는 휴무 → 무료 → 반려 → 무장애 → 주차 (넘치면 뒤를 버린다) · PlacePage 계측 — 실제 트래커 > ⑤ 카드 노출·클릭 payload.badges = cardFacts 의 code 배열(빈 배열 포함), 기존 키·source 는 그대로 |
| R4b | 무장애 조건을 `(a.barrierFree ?? []).length > 0`(아무 코드)으로 (`placeAttributes.ts`) | 0 | 178 중 1 실패 | cardFacts — 카드 상태 배지 표 > 무장애 — 목록 필터 정밀 3종 중 하나면 「무장애 시설」, 저정밀·비시설 코드만 있으면 배지 없음 |
| R5 | 바 표시 조건 `setBarShown(true \|\| (…))` (`AttractionPage.tsx`) | 0 | 178 중 1 실패 | 하단 행동 바 — 표시 조건 (≤640px) > IO 콜백 전에는 hidden, 행동 줄이 머리띠 밑으로 지나가면 표시, 다시 들어오면 hidden |
| R6 | 바 길찾기 payload 에서 `source` 제거 (`AttractionActionBar.tsx`) | 0 | 178 중 1 실패 | 하단 행동 바 · 행동 줄 — 계측(실제 트래커 대기열) > 바 길찾기 → DIRECTIONS + source action_bar |
| R7 | `POST_SELECTION_SECTIONS` 에서 `SECTION_JUMP` 빼기 (`AggregateAttractionPopularityUseCase.kt`) | 통과 | 6 중 4 실패 | Then: 선택 뒤 후속 행동 여섯 섹션이다 — FE events.ts 의 같은 이름 주석과 한 몸 · Then: 선택 뒤 후속 행동(지도 열기·찜)은 클릭 수와 고유 클릭자에서만 뺀다 — 노출 집계에는 제외가 없다 · Then: 노출·클릭 합계는 그대로 센다 — place-ingest 가 읽는 값이다 · Then: 고유 클릭 방문자 상태를 채운다 — 클릭만, 수집기가 익명에 붙이는 값은 뺀다 |
| R7b | `POST_SELECTION_SECTIONS` 에서 `PHONE` 빼기 (같은 파일) | 통과 | 6 중 4 실패 | R7 과 같은 넷 |
| 대조 (FE) | `const CARD_BADGE_MAX = 3;` 위에 주석 한 줄 (`placeAttributes.ts`) | 0 | 178/178 통과 | 없음 |
| 대조 (Gradle) | 주입 없음(사본 그대로) | 통과 | search 77/77 · analytics 6/6 | 없음 |

## 2. CSS (R8 · R9 · R9b · R10) — 사본 빌드 측정

단위 게이트가 없다(jsdom 은 CSS 를 계산하지 않는다). `PlacePage.css` 의 해당 줄을 **하나씩** 되돌린 사본을 `VITE_API_URL= npx vite build` 로 빌드하고(다섯 빌드 모두 0), `vite preview`(측정용 설정은 레포 밖 — `/api` 를 운영 `https://place.1989v.com` 으로 프록시)에 `scripts/css-injection.mjs` 를 돌렸다. 화면은 390×844, 허브 `/place`·상세 `/place/attractions/77`, 사이트 라이트(기기 라이트)·사이트 다크(기기 다크). 계측 전송은 막았다.
측정한 것이 그 사본인지는 측정 화면이 실은 파일 이름으로 확인했다 — 다섯 빌드의 `index-*.js`·`PlacePage-*.css` 가 모두 다르고, 대조 빌드의 CSS 는 운영과 같은 `PlacePage-Bloua_6b.css` 다. 실행마다 「이 세션」 크롬 `(없음)`, 프리뷰 리스너 0.

| # | 되돌린 줄 | 번들 (index · PlacePage css) | 배지 대비 라이트 / 다크 | `scroll-padding-bottom` | 이동 줄 겹침 | 별 꺼짐 / 켜짐* 라이트 · 다크 | 찜 칸 크기 | 찜 포커스 링 라이트 · 다크 | Tab 가림 (라이트, 바 보일 때 본문 포커스) |
|---|---|---|---|---|---|---|---|---|---|
| 대조 | 없음 | `CYptQ-8M` · `Bloua_6b` | 8.53 / 10.11 | 116px | 0 | 6.81 / 15.82 · 5.31 / 13.06 | 98×55 | 15.82 · 13.06 | 122 중 18 |
| R8 | `.place-card-badges li` 글자 → `var(--kh-ocher)` | `D8slg4Ui` · `DiQJWwYu` | **2.79** / 5.59 | 116px | 0 | 같음 | 98×55 | 같음 | 122 중 18 |
| R9 | `html:has(.place-action-bar)` 의 `scroll-padding-bottom` 제거 | `uWTHI-sq` · `DW-zHH0Z` | 8.53 / 10.11 | **auto** | 0 | 같음 | 98×55 | 같음 | 122 중 **38** |
| R9b | `.place-action-bar .favorite-btn` 덮어쓰기 넷(칸 크기 · 별 크기 · 켜짐 색 · 포커스 링 선택자) 제거 | `Ba2FO51R` · `DKxrLRA5` | 8.53 / 10.11 | 116px | 0 | 6.81 / **2.24** · 5.31 / **1.83** | **44×44** | 15.82 · 13.06 | 122 중 18 |
| R10 | `.place-jump` `top: 0` | `Dle-HQGI` · `BHbVs-Sd` | 8.53 / 10.11 | 116px | **60px** | 같음 | 98×55 | 같음 | 122 중 18 |

`*` 찜 켜짐은 로그인 없이 누를 수 없어 같은 버튼에 `is-on` 클래스를 붙여 쟀다.

- 각 주입은 자기 열만 바꾸고 나머지 열은 대조와 같다 — 다섯 줄이 서로의 대조군이다.
- **R9 는 대조가 이미 빨강이다.** 대조 빌드에서도 Tab 가림이 18 이다 — 운영과 같은 결함(`screens.md` §4: `components/Footer.css:17` 의 `#root :has(+ .site-footer)` 여백이 고정 바에 `margin-bottom: 48px` 을 붙여 바가 48px 뜬다) 때문이다. 그래서 R9 는 「빨강이 됐다」가 아니라 **18 → 38 로 늘었다**로만 드러난다. 그 결함이 고쳐지기 전까지 SR-8.4 의 Tab 단언은 R9 를 0 → n 으로 가르지 못한다.
- **R9b 는 포커스 링을 잡지 못한다.** 덮어쓰기를 지워도 찜 포커스 링은 15.82 · 13.06 그대로다 — `.kh-slab` 범위가 `--ko-text-primary` 를 판 위 글씨색으로 바꾸고, `Favorite.css` 의 포커스 outline 이 그 변수를 쓰기 때문이다. R9b 를 잡는 값은 **별 켜짐 대비(2.24 · 1.83 < 3)와 칸 크기(44×44, 칸 전체가 아님)** 다. 별 꺼짐(6.81 · 5.31)도 같은 이유로 바뀌지 않는다.

## 3. 바 위치 수정 뒤 — 로컬 프리뷰 (2026-10-11 16:00~16:45 KST)

수정: `PlacePage.css` 에 `#root .place-action-bar.kh-slab { margin-bottom: 0 }`(명시도 1,2,0 — Footer.css 의 `#root :has(+ .site-footer)` 1,1,0 을 이긴다)과, 그 여백을 바 앞 흐름 요소로 옮기는 `#root :has(+ .place-action-bar + .site-footer) { margin-bottom: var(--ko-space-12) }`. Footer.css 는 건드리지 않았다.
빌드 `VITE_API_URL= npx vite build`(수정 · 수정 + R9 둘 다 0), `vite preview` + `/api` 운영 프록시(§2 와 같은 설정), 드라이버 `scripts/detail-after.mjs`(12곳 × 3회, 390×844). 측정 화면이 실은 번들: 수정 `index-DWcgCIsr.js`·`PlacePage-BHoVnx0p.css`, R9 `index-BMf8OT80.js`·`PlacePage-BUVu7piw.css`(R9 CSS 의 `scroll-padding-bottom` 0개 · 바 `margin-bottom:0` 규칙 1개). 실행마다 「이 세션」 크롬 `(없음)`, 프리뷰 리스너 0.
드라이버 수정: 로컬 주소의 영문 상세 URL 이 `/place/en/attractions/…`(없는 경로)였다 → `/en/place/attractions/…`. 운영 경로는 그대로다.

| 빌드 | 바 top (탭바 top) | 문서 끝 내용 bottom ≤ 바 top | Tab 가림 (12곳, 바 보일 때 본문 포커스 중) | `scroll-padding-bottom` |
|---|---|---|---|---|
| 운영 (수정 전, `screens.md` §4) | 680 | 0/12 (32px 깔림) | 14~36 | 116px |
| 수정 | **728** (791) — 1658 만 746 (809) | **36/36** (712/728 · 1658 730/746, 틈 16px) | **0 ×12** (118~126 중) | 116px |
| 수정 + R9 | 728 | 36/36 | **17~32** (국 32·29·32·20·31·17, 영 28·24·17·25·17·22) | auto |

- R9 는 이제 대조 0 → 주입 17~32 로 갈린다(§2 의 18 → 38 을 대신한다). 문서 끝 위치는 `.place-page` 하단 여백이 맡아 R9 와 무관하다.
- 나머지 열(첫 화면 숨김 · 표시 최대 26ms · 다시 숨김 · 길찾기 폴드 36/36 · 이동 줄 겹침 0 · CLS)은 수정 전과 같다.
- 바 bottom(784)과 탭바 top(791) 사이 7px 는 남는다 — `--kh-shell-bottom`(60px)이 실제 탭바 높이(53px)보다 크다. 그 값은 `body` 하단 여백·지도 높이 등 모든 화면이 함께 쓰므로 여기서 바꾸지 않았다.

### 바닥글 앞 여백 — 다른 화면 회귀 없음

`.site-footer` 앞 흐름 요소 bottom 과 푸터 top 사이(px). 로컬은 수정 빌드, 운영은 수정 전 `index-dXbP3TLy.js`.

| 화면 | 390 운영 → 수정 | 1440 운영 → 수정 |
|---|---|---|
| place 허브 | 60 → 60 | 64 → 64 |
| 상세 77 | **12 → 60** (운영은 48px 이 바에 붙어 본문 여백이 0 이었다) | 64 → 64 |
| `/about` | 48 → 48 | 48 → 48 |
| `/privacy` | 48 → 48 | 48 → 48 |
