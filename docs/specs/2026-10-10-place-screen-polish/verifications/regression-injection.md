# 회귀 주입 — 허브 필터 한 줄·지역 시트·시트 포커스 (TG2) · CSS 대비 (TG3)

주입은 워킹트리가 아니라 **임시 사본**에서 했다 — `portal-fe` 를 스크래치패드로 `rsync`(node_modules 는 원본 심링크)한 트리다. 주입마다 원본 파일을 되돌렸고, 끝에 사본 파일이 워킹트리와 같은지 `diff` 로 확인했다. 주입은 모두 컴파일되는 회귀다 — 주입한 사본에서 `npx tsc -b` 가 0 으로 끝났다.

## 1. 단위 게이트 (vitest) — 2026-10-11 KST

명령: 사본에서 `npx tsc -b` → `npx vitest run <대상 파일>`. 빨강을 낸 단언 이름은 vitest `FAIL` 줄 그대로다.

| # | 주입 (파일) | tsc | 빨강을 낸 테스트 |
|---|---|---|---|
| 1 | 필터 바 `isMobile &&` 조건 되살리기 (`PlacePage.tsx`) | 0 | 넓은 화면 > ?layout 을 무시한다 — 마운트 때 지도, 전환 버튼·변형 클래스 없음 · 넓은 화면 > 필터 한 줄만 그리고 나머지 칩은 「필터」를 열기 전에는 없다 — 열면 가운데 다이얼로그 · 넓은 화면 > 지도 오버레이 칩을 켜면 다이얼로그를 닫는다 — 켠 값은 남는다 · 넓은/좁은 짝 4건(속성·분류·행사 상태·지역 시트) — 7건 |
| 2 | 속성 칩 핸들러 trigger `'attribute'` → `'category'` (`SearchTrigger` 의 다른 멤버, `PlacePage.tsx`) | 0 | 넓은/좁은 짝 > 속성 칩 — trigger attribute · changed [attributes, page] · 질의 parking YES · 좁은 화면 필터 한 줄 > 시트 안 속성 칩은 기존과 같은 질의·계측을 내고, 누른 뒤 포커스가 그 칩에 남는다 — 2건 |
| 3 | 넓은 화면에서 시트 내용을 열기 전에 그리기 — `{filterSheetOpen && (` → `{(filterSheetOpen \|\| !isMobile) && (` (`PlacePage.tsx`) | 0 | 넓은 화면 > 필터 한 줄만 그리고 나머지 칩은 「필터」를 열기 전에는 없다 — 열면 가운데 다이얼로그 · 넓은 화면 > 지도 오버레이 칩을 켜면 다이얼로그를 닫는다 — 켠 값은 남는다 — 2건 |
| 4 | `RegionSheet` 가까운 시도 정렬 제거 (`RegionSheet.tsx`) | 0 | RegionSheet — 가까운 시도 > 좌표가 있으면 가장 가까운 시도가 「전체 지역」 다음 첫 시도 행이고 「현재 위치」 표시를 단다 — 선택은 바꾸지 않는다 — 1건 |
| 5 | `RegionSheet` 「현재 위치」 표시 제거 (`RegionSheet.tsx`) | 0 | 위 테스트 · RegionSheet — 가까운 시도 > 영문 표시 문구 — Near you — 2건 |
| 6 | `KhSheet` 포커스 복원 제거 — 정리의 `opener.focus()` → `void opener` (`KhSheet.tsx`) | 0 | KhSheet 포커스 > 열면 판으로, Escape 로 닫으면 연 버튼으로 포커스가 돌아온다 · KhSheet 포커스 > 안의 버튼으로 닫아도 연 버튼으로 돌아온다 — 2건 |
| 7 | `KhSheet` Tab 순환 제거(마지막 → 첫) (`KhSheet.tsx`) | 0 | KhSheet 포커스 > 마지막 요소에서 Tab → 첫 요소 — 1건 |
| 대조군 | 주입 없음(사본 원본) | 0 | 없음 — `PlacePage.layout`·`RegionSheet`·`KhSheet` 37/37 통과 |

- 주입 2 는 짝 단언의 **절대값**(`trigger: 'attribute'` 리터럴)이 잡았다. 두 폭이 같은 `toggleAttribute` 를 타므로 이 주입에서는 두 폭 모두 `'category'` 가 되어, 넓은/좁은 결과끼리 비교하는 단언(`toEqual(narrow.payload)`)만으로는 같다고 판정된다.
- 상세 행동 줄 위치(FE·SSR)·렌더 골든 주입은 TG4 범위라 아래 §3 에 있다.

## 2. CSS 대비 (SR-3~5) — 사본 빌드 측정, 2026-10-11 10:31~10:46 KST

단위 게이트가 없다(jsdom 은 CSS 를 계산하지 않는다). 바꾼 CSS 줄을 **하나씩** 옛 값으로 되돌린 사본을 `VITE_API_URL= npx vite build` 로 빌드하고(9개 모두 빌드 0), 로컬 프리뷰(`/api` 는 운영 프록시)에 `scripts/contrast.mjs` 를 그 결함이 드러나는 조합 하나로 돌렸다. 판정은 「카드 제목 색 ≠ `--ko-text-primary`」 또는 「대비 < 4.5」. 각 주입의 나머지 열은 바뀌지 않아야 한다 — 그래서 아홉 줄이 서로의 대조군이다. 주입 없는 후 빌드의 값은 `local-preview.md`.

| # | 되돌린 줄 | 조합(기기-사이트) | 빨강 | 다른 열 |
|---|---|---|---|---|
| 1 | `a.place-card` 의 `color: inherit; text-decoration: none` 제거 | light-light | 허브·지역 카드 제목 = primary **아니오**, 밑줄 **underline** | 그대로(meta 4.82 · 주소 8.53 …) |
| 2 | `.place-btn.primary` 글자색 → `var(--ko-surface-0)` | dark-dark | 「검색」 **2.03** | 언어 활성 8.62 그대로 |
| 3 | `.place-lang-btn.active` 글자색 → `var(--ko-surface-0)` | dark-dark | 언어 활성 **2.03** | 「검색」 8.62 그대로 |
| 4 | `.place-lang-btn` → `--ko-text-muted` | light-light | 언어 비활성 **4.23** | 그대로 |
| 5 | `.kh-sheet-label` → `var(--kh-ocher, …)` | light-light | 필터 시트 라벨 **2.79** | 그대로 |
| 6 | `.place-attr-caption` → `--ko-text-muted` | light-light | 속성 설명 **4.09** | 건수 8.53 그대로 |
| 7 | `.place-attr-count` → `--ko-text-muted` | light-light | 속성 건수 **4.09** | 설명 8.53 그대로 |
| 8 | `.place-card-meta` → `var(--kh-ocher, …)` | light-light | 카드 meta **2.79** | 주소 8.53 그대로 |
| 9 | `.place-card-addr` → `--ko-text-muted` | light-light | 카드 주소 **4.09** | meta 4.82 그대로 |

- 측정한 번들이 그 사본인지는 측정 화면의 `document.scripts` 해시로 확인했다 — 아홉 개가 모두 다르고(`index-DP-5hiYG.js` … `index-CmLy-01e.js`), 후 빌드(`index-DcJZLHoa.js`)와도 다르다.
- 실행마다 「이 세션」 크롬 `(없음)`, 프리뷰 리스너 0.

## 3. 상세 행동 줄 위치 (TG4, SR-6) — 2026-10-11 KST

임시 사본은 워크트리를 스크래치패드로 `rsync`(node_modules·build·.gradle·.git 제외, node_modules 는 원본 심링크)한 트리다. 주입마다 원본 파일을 되돌렸고, 끝에 사본의 `AttractionPage.tsx`·`AttractionPageRenderer.kt`·`render/` 골든이 워크트리와 같은지 `diff` 로 확인했다. 주입은 모두 컴파일되는 회귀다(FE 는 사본 `npx tsc -b` 0, SSR 은 Gradle 컴파일 통과 후 테스트 실패).

명령: FE `npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx`, SSR `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*Parity*' --rerun`(**`UPDATE_RENDER_GOLDEN` 없이**).

| # | 주입 (파일) | tsc / 컴파일 | 빨강을 낸 테스트 |
|---|---|---|---|
| 1 | FE 행동 줄을 옛 자리(근거 묶음 뒤)로 되돌리기 (`AttractionPage.tsx`) | 0 | 첫 화면 > 일반 유형 — … → 행동 줄(길찾기·전화) → 방문 요약 → … (`3 → 4`) — 1건 |
| 2 | FE 행동 줄을 방문 요약 바로 뒤로 (`AttractionPage.tsx`) | 0 | 같은 테스트 (`3 → 4`) — 1건 |
| 3 | FE 근거 묶음을 행동 줄 위로 (`AttractionPage.tsx`) | 0 | 같은 테스트 (`5 → 6`, 배지 줄 → 근거 묶음) — 1건 |
| 4 | SSR `append(actions(…))` 를 옛 자리(`siteSignals` 뒤)로 되돌리기 (`AttractionPageRenderer.kt`) | 통과 | 절 순서는 제목 → 행동 줄 → 방문 요약 → … · 근거 묶음은 방문 요약·배지 줄 뒤, 개요 앞 — 행동 줄은 그보다 위다 · 행사·숙박 같은 유형 문서에도 같은 줄이 행동 줄 뒤에 나온다 · 렌더 골든 `attraction-ko` · `attraction-en` · `attraction-http-image-ko` — 6건(233 중). `*Parity*` 7개 스위트는 초록 |
| 대조군 | 주입 없음(되돌린 사본) | 0 / 통과 | 없음 — FE 89/89(`AttractionPage`·`visitSummaryGolden`), Gradle 233건 실패 0 |

- 렌더 골든은 주입 4 에서 세 파일만 빨강이고 `event-*`·`stay-*`·`course-ko` 는 초록이다 — 이 문서들은 방문 요약이 없고 근거 줄 표본(찜·클릭)도 없어 행동 줄의 상대 위치가 바뀌지 않는다(SR-6.2).
