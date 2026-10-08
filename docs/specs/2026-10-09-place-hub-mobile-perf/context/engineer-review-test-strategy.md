# Engineer Review — test-strategy (1라운드)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md` (SR-5 검증 계획 중심)
근거 범위: 스펙 · `context/open-questions.yml` · `docs/standards/test-rules.md` · `docs/standards/fe-visual-verification.md` · 기존 테스트(`portal-fe/src/pages/place/__tests__/*`, `search/app/src/test/.../render/*`) · S1-5 기준선(`evidence/stage1/perf-baseline.md`) · `scratchpad/lh-batch.sh`

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 모든 요구에 테스트가 있는가 | 미흡 — T1, T2, T3 |
| 2 | 레이어 배정 | 대체로 적절. 다만 https 는 함수 단위만 있고 렌더 산출물 단위가 없음 — T1 |
| 3 | 목 경계 | 미정 — T4 |
| 4 | 테스트 데이터 | 미흡 — SSR 픽스처가 이미 https 라 변환이 안 탐 — T2 |
| 5 | 음성·경계 사례 | 부분 — T3, T5 |
| 6 | 이름 규칙 | 통과(파일명 미지정은 경미) — T8 |
| + | 성능 전후 같은 조건 | 미흡 — T6, T7 |
| + | 회귀 주입이 실제로 빨간불을 내는가 | https·`<main>` 두 건은 지금 계획으로는 보장되지 않음 — T1, T2 |

## 발견

### T1. FE https 검사가 함수만 보고 화면 산출물은 안 본다 (체크 1·2)
- 스펙 SR-5.1 은 `secureImageUrl` 규칙(tong http→https, 다른 호스트, null)만 테스트한다. SR-4.2 의 대상은 「화면에 내보내는 모든 사진 주소」다.
- 사진 `<img>` 를 그리는 곳은 최소 여섯 군데다. `PlacePage.tsx:1678`, `PlacePage.tsx:1797`, `RegionPage.tsx:248`, `RegionPage.tsx:287`, `AttractionPage.tsx:373`, `NearbyExplore.tsx:250`. 그 밖에 FE JSON-LD(`src/seo`)도 있다.
- 이 가운데 한 곳이라도 함수를 안 거치면 함수 테스트는 초록인데 화면에는 http 가 남는다. SR-5.3 의 「https 치환 제거(FE) → 빨강」도 함수 본문을 지우는 회귀에만 빨간불이 나고, 호출 하나를 빼는 회귀에는 안 난다.
- **수정안**: SR-5.1 에 렌더 단위 단언을 더한다. 허브·상세·지역 테스트에서 `imageUrl: 'http://tong.visitkorea.or.kr/...'` 픽스처로 그린 뒤 `document.querySelectorAll('img[src^="http://tong."]').length === 0` 을 확인한다. 회귀 주입 항목에도 「한 호출부에서 `secureImageUrl` 제거 → 빨강」을 추가한다.

### T2. SSR 골든은 https 변환을 확인하지 못한다. 대상 `<img>` 도 없다 (체크 1·4)
- 렌더러 픽스처가 이미 https 다(`AttractionPageFixtures.kt:63`). 골든 9개에는 `http://tong` 이 0건이고 `<img>` 도 0건이다(`render/golden/*.html`). 따라서 SR-5.2 의 「골든 재생성 diff 가 이미지 주소·main 태그뿐인지」에서 이미지 주소는 바뀌지 않는다. 변환을 지워도 골든은 초록이다.
- 렌더러에는 `<img>` 가 없다. 사진이 나가는 곳은 `og:image`·`og:image:secure_url`(`AttractionPageRenderer.kt:145-146`)과 JSON-LD `image`(`AttractionPageRenderer.kt:241`)다. 스펙 SR-4.2 의 「SSR `<img>`」는 대상이 틀렸다. 특히 `og:image:secure_url` 에 http 가 들어가는 것이 실제 결함이다.
- **수정안**: (a) 렌더러 테스트에 http tong 입력 케이스를 하나 추가하고, `og:image`·`og:image:secure_url`·JSON-LD `image` 셋 다 https 인지 단언한다. (b) 패리티 표는 FE·Kotlin 이 이미 같이 읽는 `render/jsonld-golden.json`(`portal-fe/src/seo/__tests__/attractionJsonLdGolden.test.ts:24`) 선례를 따른다. 새 리소스를 만든다면 같은 폴더에 두고 경로를 스펙에 적는다. (c) SR-4.2 에서 「SSR `<img>`」를 「og:image·og:image:secure_url」로 고친다.
- 덧붙여, 골든 회귀 주입(`<main>` 제거)은 반드시 `UPDATE_RENDER_GOLDEN` 없이 돌린다(`AttractionPageRendererTest.kt:569-570`). 플래그를 켜면 언제나 초록이다. SR-5.3 에 한 줄 적어 둔다.

### T3. 요구는 있는데 테스트가 없는 항목 (체크 1·5)
| 요구 | 빠진 테스트 |
|---|---|
| SR-1.5 「지도 열기/닫기는 SEARCH 를 내지 않는다」 | 지도 보기→목록 보기 왕복 뒤 `searchAttractions` 호출 수 불변 + SEARCH 이벤트 0건 |
| SR-1.6 「지도 보기」 계측 | 단언 없음. 기존 지도 열기 이벤트는 `MAP_LINK` 이고 관광지별 `entityId` 를 갖는다(`PlacePage.tracking.test.tsx:162-163`). 대상 없는 토글 버튼에 무엇을 싣는지 스펙이 정하지 않아 테스트를 쓸 수 없다. section·entityId 를 정하고 단언을 추가한다 |
| SR-1.2 쿼리 `layout` 이 canonical·계측 주소에 안 들어감 | `?layout=mapSplit` 진입 시 `track` 이 받은 주소·canonical 에 `layout` 이 없음 |
| SR-4.1 `width`·`height` 속성(CLS) | 모든 카드 `img` 에 두 속성이 있음. 회귀 주입에도 추가 |
| SR-2.1 핵심 테마 칩 3개·요약 줄 | 좁은 화면에서 줄 위 칩이 전체·관광지·행사 셋뿐 + 요약 문구가 고른 조건과 같음 |
| SR-1.3 지도 상태 하단 시트 | 「지도 보기」 뒤 목록 숨김 + 시트에 같은 카드 |

### T4. `loadGoogleMaps` 목 경계가 정해지지 않았다 (체크 3)
- 지금 `PlacePage.test.tsx` 는 `placeApi`·`FavoriteButton`·`tracker` 만 목으로 바꾸고(`PlacePage.test.tsx:7-25`) `googleMaps` 는 실물이 돈다. 「클릭 전 미호출·클릭 뒤 호출」을 보려면 `vi.mock('../googleMaps', importOriginal)` 으로 `loadGoogleMaps` 만 바꾸고 나머지 내보내기는 살리는 경계를 스펙에 적는다. 목을 지도 컴포넌트 전체로 넓히면 「마운트 시 호출(mapSplit)」이 자기 목을 재는 검사가 된다.
- 「처음 2장 eager」는 카드 컴포넌트 단위가 아니라 **문서 전체**에서 `img[loading=eager]` 가 정확히 2개인지 센다. listFirst 에서 숨긴 목록과 지도 시트가 같은 카드를 두 번 그리면 eager 가 4장이 되는데, 그 경우까지 잡힌다.

### T5. 기존 모바일 테스트가 필터 압축과 충돌한다 — 갱신 방침이 없다 (체크 5)
- `PlacePage.test.tsx:189-204` 는 `mobile = true` 에서 `chip(/^주차 가능/)` 을 바로 누른다. SR-2.2 뒤에는 속성 칩이 「필터 N」 시트 안으로 들어가므로 이 테스트가 깨진다.
- 이럴 때 `mobile = false` 로 바꿔 통과시키면 모바일 누적 목록 검증이 사라진다. 스펙에 「기존 모바일 테스트는 시트를 열고 같은 단언을 유지한다」를 적는다. 같은 파일 438행의 `findByRole('dialog')` 도 필터 시트가 열려 있으면 대상이 둘이 될 수 있으니 이름으로 좁힌다.
- `matchMedia` 목이 모든 쿼리에 같은 `matches` 를 돌려준다(`PlacePage.test.tsx:66-71`). 그래서 `mobile=true` 이면 `prefers-reduced-motion`(`PlacePage.tsx:227`)도 참이 된다. 새 테스트가 `MOBILE_QUERY` 에만 반응하게 목을 고칠지 여부를 정해 둔다.

### T6. 성능 전후 비교 조건이 기준선과 같은지 확인이 덜 됐다 (같은 조건)
- 기준선 조건은 `perf-baseline.md:1` 에 있다. Lighthouse 13.5.0, simulate, mobile, 매 실행 새 프로필, 10초 간격, 순차, URL 셋(`/`, `/attractions/1`, `/regions/11`)이다. SR-5.4 에 이 조건을 **그대로** 적는다. 지금은 「선례」라고만 되어 있다.
- `scratchpad/lh-batch.sh:4` 의 출력 경로가 **메인 트리**(`/Users/gideok-kwon/IdeaProjects/msa/docs/...stage1/lh`)다. 그대로 돌리면 메인 트리 금지를 어기고 1단계 원본 JSON 도 덮어쓴다. stage2 전용 경로를 쓰도록 스펙에 적는다.
- 배포 뒤 측정 전에 운영이 새 번들을 내주는지 확인한다(`fe-visual-verification.md:157-173` — 이번에 넣은 심볼이 응답 안에 있는지). 확인하지 않으면 옛 번들을 「배포 뒤」로 잴 수 있다. 허브 프리렌더 재생성 여부도 함께 확인한다.
- 배포 직후에는 엣지 캐시가 MISS 라 TTFB 가 튄다(기준선이 세운 가설 ②, `perf-baseline.md:49`). 실행마다 `cf-cache-status` 를 기록하거나 측정 전에 예열 요청을 한 번 보낸다. 이 방식은 전후 측정에 똑같이 적용한다.

### T7. 5회 중앙값으로는 CLS 튐을 판정할 수 없다 (같은 조건)
- 고칠 대상은 「CLS 가 0.74 까지 튐」(스펙 4행)이다. 그런데 기준선 중앙값은 0.05 였다(`perf-baseline.md:36`). 0.74 는 5회 중 2회로 꼬리에서 나온 값이다(`perf-baseline.md:20,24`). 중앙값만 비교하면 개선 여부가 보이지 않는다.
- 시뮬 LCP 범위가 18.5~26.0s 다(`perf-baseline.md:36`). 중앙값 차이가 이 폭보다 작으면 노이즈다.
- **수정안**: SR-5.4 에 지표별로 중앙값 + 범위(최소~최대)를 남기고, CLS 는 「0.1 초과 실행 수 / 5」도 적는다. 판정 규칙도 정한다. 예: 개선이라고 말하려면 배포 뒤 범위가 배포 전 범위와 겹치지 않아야 하고, 겹치면 「차이 없음」으로 보고한다. SR-4.4 의 「효과가 없으면 되돌린다」도 이 규칙으로 판단한다.

### T8. 화면 측정·파일 위치 (경미)
- SR-5.5 의 캡처 대상이 운영인지 로컬 프리뷰인지, 데이터가 어디서 오는지 정해지지 않았다. 카드 높이는 데이터에 따라 달라지므로 「폴드 안 2장」 판정 조건에 포함한다. 폴드 664px 를 어떻게 세는지(뷰포트 위에서부터 `getBoundingClientRect().bottom ≤ 664` 인 카드)도 한 줄로 적는다. 1440×900 에서는 변형을 무시하므로 두 변형 캡처가 같아야 한다. 같다는 것 자체를 데스크톱 무시 검증으로 쓴다.
- 새 vitest 파일 이름(예: `PlacePage.layout.test.tsx`, `secureImageUrl.test.ts`)과 Kotlin 변환 함수 테스트(구현체 이름 + `Test`, BehaviorSpec — `test-rules.md:6,17`)를 스펙에 적는다.

## 잘된 점
- 변형 간 질의 동일 단언을 `searchAttractions` 목이 받은 인자로 판정한다(`PlacePage.test.tsx:85`). 대상이 내놓은 값을 본다.
- 회귀 주입을 임시 사본에서 하고 항목별로 빨간불을 요구한다(SR-5.3).
- 시뮬 단일 값을 금지하고 관측 LCP·LCP 요소를 함께 기록한다(SR-5.4, Q2).

## 요약
BLOCK 사유는 없다. 스펙 결정과 표준이 정면으로 부딪히는 곳은 없다. 다만 https 두 경로(T1·T2)는 지금 계획대로면 기능을 지워도 초록이 나는 검사다. 구현 전에 보강이 필요하다.

VERDICT: REVISE
