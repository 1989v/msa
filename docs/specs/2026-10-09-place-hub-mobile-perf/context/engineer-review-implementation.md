# Engineer Review — implementation (1라운드)

- 대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
- 근거 범위: `portal-fe/src/pages/place/{PlacePage.tsx,PlacePage.css,googleMaps.ts,placeView.ts,useMediaQuery.ts}`, `portal-fe/src/components/shell/KhSheet.tsx`, `portal-fe/scripts/prerender-seo.mjs`, `portal-fe/src/seo/copy.mjs`, `search/app/.../render/AttractionPageRenderer.kt`, 렌더 테스트·골든, 선행 스펙 `2026-10-08-place-hub-instrumentation/spec.md`, `evidence/stage1/perf-baseline.md`

## 체크리스트

| # | 항목 | 판정 |
|---|---|---|
| 1 | 참조한 클래스·모듈이 있는가 | 부분 — SSR `<img>`·「관광지」 칩·「S1-12b 지도 열기 이벤트(토글)」는 없다 (I-4·I-5·I-6) |
| 2 | 기존 코드와 충돌이 없는가 | 부분 — 지도 effect·KhSheet·JSON-LD 패리티와 충돌 (I-1·I-2·I-3·I-6) |
| 3 | 복잡도 위험을 짚었는가 | 부분 — 숨긴 지도의 fitBounds, 목록 이중 렌더 (I-1·I-2) |
| 4 | NFR 안티패턴 | 없음 — 지도 스크립트는 `googleMaps.ts:22` 에서 한 번만 받는다 |
| 5 | 마이그레이션·롤백 | 충분 — 기본 변형 상수 한 줄, 스키마 변경 없음 |
| 6 | 동시성 | 해당 없음 |

## 이슈

### I-1 (SR-1.3) 지도 지연 로드 — 지금 effect 구조로는 「처음 열 때 호출」이 성립하지 않는다
- 근거: 지도 초기화 effect 의 조건은 `!mapDivRef.current` 하나이고 의존성은 `[hasMapKey]` 뿐이다 (`PlacePage.tsx:754-777`). 지도 div 는 늘 마운트돼 있다 (`PlacePage.tsx:1612`).
  - CSS 로만 숨기면 div 가 있으므로 **마운트 때 `loadGoogleMaps` 가 불린다**.
  - 조건부 렌더로 바꾸면 div 가 나중에 생겨도 effect 가 다시 돌지 않는다.
- 이차 영향: 마커 effect 는 결과가 바뀔 때마다 `map.fitBounds` 를 부른다 (`PlacePage.tsx:932-940`). 한 번 연 지도를 목록 모드에서 숨긴 채 결과가 바뀌면, 크기 0 인 컨테이너에 맞춰 줌이 틀어진다.
- 수정안: 스펙에 상태 하나(`mapRequested`: `mapSplit`·데스크톱은 처음부터 true, `listFirst` 는 「지도 보기」에서 true)를 적고, 이 상태를 지도 effect 의 조건과 의존성에 넣는다고 명시한다. 「지도를 열 때 현재 결과로 bounds 를 다시 맞춘다」도 한 줄 넣는다. SR-5.1 의 「클릭 전 미호출」 테스트에는 `vi.mock('../googleMaps')` 로 `mapsApiKey` 를 비지 않게 해야 effect 가 돈다는 점을 적는다(키가 비면 `PlacePage.tsx:755` 에서 바로 빠져 단언이 저절로 통과한다).

### I-2 (SR-1.3) 지도 위 결과 시트에 KhSheet 를 쓰면 안 되고, 목록을 두 번 그려서도 안 된다
- 근거: KhSheet 는 모달이다. 열리면 body 스크롤을 잠그고 (`KhSheet.tsx:28-30`), veil 클릭으로 닫히며 (`:58`), `aria-modal="true"` 다 (`:63`). 그래서 지도 조작과 함께 떠 있는 시트로 쓸 수 없다.
- 목록을 시트에 한 번 더 그리면 두 문제가 생긴다.
  - 카드마다 `useImpression` 이 붙어 있어 (`PlacePage.tsx:1749-1759`) 노출이 두 번 집계된다.
  - `id="place-card-{id}"` 가 중복된다 (`:1766`). 이 id 는 클러스터 최대 줌 안내의 스크롤 목적지다 (`:780-788`).
- 수정안: SR-1.3 에 「결과 시트는 같은 `.place-list-col` 을 지도 모드에서 CSS 로 하단에 배치한 것 — KhSheet 도 아니고 두 번째 렌더도 아니다」를 적는다. SR-5.1 에는 「지도 모드에서 `.place-card` id 가 한 번씩만 있다」 단언을 더한다.

### I-3 (SR-2.2) 「필터 N」 KhSheet — onClose 가 안정적이지 않으면 칩을 누를 때마다 포커스가 튄다
- 근거: KhSheet 의 effect 의존성은 `[onClose]` 이고, 다시 돌 때마다 `panelRef.focus()` 를 하고 overflow 를 다시 건다 (`KhSheet.tsx:26-39`). 지금 상세 시트는 인라인 화살표 함수를 넘긴다 (`PlacePage.tsx:1641`).
- 필터 시트 안의 칩은 상태를 바꿔 리렌더를 일으킨다 (`PlacePage.tsx:1336-1341,1441`). 그러면 클릭할 때마다 포커스가 패널로 되돌아간다. 키보드·스크린리더 사용자는 다음 칩으로 이어서 갈 수 없다.
- 수정안: 「시트의 `onClose` 는 `useCallback` 으로 고정한다」와 「칩 클릭 뒤 `document.activeElement` 가 그 칩」 테스트를 SR-2.2·SR-5.1 에 넣는다.

### I-4 (SR-1.6) 「S1-12b 의 지도 열기 이벤트」는 관광지 단위 MAP_LINK 라 토글에 적용할 수 없다
- 근거: S1-12b 의 지도 열기는 관광지 한 곳의 Google Maps 링크 CLICK 이다. `entityType: ATTRACTION`·`entityId`·`sectionId: MAP_LINK` 로 보낸다 (`docs/specs/2026-10-08-place-hub-instrumentation/spec.md:43`, `PlacePage.tsx:1704-1722`). SR-10 의 「선택당 지도 열기」는 `(view_id, entity_id)` 로 묶는다 (같은 스펙 `:87,101`).
- 「지도 보기」 토글에는 대상 관광지가 없다. MAP_LINK 를 재사용하면 entity 가 비거나 엉뚱한 값이 들어가 그 지표가 오염된다.
- 수정안: 이번 범위에서는 계측하지 않는다(가장 단순하다). 필요하면 새 action 없이 별도 `sectionId`(예: `MAP_VIEW`)에 대상 없음으로 보내고, SR-10 질의가 그 섹션을 세지 않는다는 점을 적는다. 둘 중 하나로 고친다.

### I-5 (SR-2.1) 핵심 테마 칩 「관광지」에 해당하는 분류가 없다 · N 의 「지역 제외」가 모호하다
- 근거: 관광 분류는 `SIGHT_CATEGORIES = ['nature','history','culture','leisure']` 네 개다 (`placeApi.ts:332`). 「전체」(category null)가 곧 관광 네 분류 전체다 (`PlacePage.tsx:379`). 「관광지」 칩은 「전체」와 구분되지 않는다.
- `relaxConditions` 에는 `region` 과 별도로 `geo`(반경) 종류가 있다 (`placeView.ts:68-71`). 「지역 제외」에 반경도 포함되는지 정해져 있지 않다.
- 수정안: 세 칩을 실제 값으로 적는다(예: 전체 · 행사 · 코스(국문만) 또는 전체 · 자연 · 행사). N 의 정의는 「`relaxConditions` 결과에서 `keyword`·`region` 을 뺀 개수(`geo` 는 포함/제외 중 하나)」처럼 kind 이름으로 고정한다.

### I-6 (SR-4.2) https 변환 — 대상 목록에 없는 것과 빠진 것이 있고, FE 함수 위치가 패리티를 정한다
- 없는 대상: SSR 렌더러에는 `<img>` 가 없다 (`AttractionPageRenderer.kt` 에 `<img` 없음. 히어로 SSR 은 `perf-baseline.md:41-42` 에서 철회됨).
- 빠진 대상: SSR `og:image`·`og:image:secure_url` 이 원천 값을 그대로 쓴다 (`AttractionPageRenderer.kt:54,145-146`). 원천이 http 면 secure_url 에 http 가 나간다.
- 하이드레이션 패리티: 화면 JSON-LD 는 `copy.mjs:676` 의 `json.image = attraction.imageUrl` 이다. Kotlin 만 바꾸면 하이드레이션이 서버 블록을 http 로 덮는다. `jsonld-golden.json` 패리티 테스트도 깨진다 (`attractionJsonLdGolden.test.ts:9-14`).
- 따라서 `secureImageUrl` 은 `copy.mjs`(노드 프리렌더와 FE 가 함께 쓰는 .mjs)에서 import 할 수 있는 `src/seo/` 에 둬야 한다. `pages/place` 의 .ts 에 두면 거기서 쓸 수 없다.
- FE 표시 지점(나열이 없으면 빠진다): `PlacePage.tsx:1290`(뽑기 data-src), `:1678`, `:1795`, `RegionPage.tsx:248,287`, `NearbyExplore.tsx:250`, `AttractionPage.tsx:165`(useSeo image), `:202`(갤러리), `FavoritesPage.tsx:87`, `ServiceShowcase.tsx:165`.
- 수정안:
  - 대상 목록을 위 지점과 `og:image` 로 고친다. 또는 `placeApi` 응답 매핑 한 곳에서 바꾸고 `copy.mjs:676` 만 따로 처리한다고 적는다.
  - 패리티 리소스는 선례를 따라 `search/app/src/test/resources/render/secure-image-golden.json` 으로 둔다. FE vitest 가 쓰고 Kotlin 이 읽으며, CI 가 `git diff` 로 최신 여부를 본다 (선례: `footerLinksGolden.test.ts:15` ↔ `FooterLinksParityTest.kt`).

### I-7 (SR-5.2·5.3) 지금 픽스처로는 https 회귀 주입이 빨개지지 않는다
- 근거: 렌더 픽스처와 JSON-LD 골든의 사진 주소가 전부 이미 https 다 (`AttractionPageFixtures.kt:63`, `jsonld-golden.json:14`, `attractionJsonLdGolden.test.ts:47`). 그래서 골든 HTML 을 다시 만들어도 「이미지 주소 diff」가 나오지 않는다. 치환을 지워도 골든은 초록이다.
- 수정안: http 원천을 가진 사례를 렌더 픽스처 하나와 `attractionJsonLdGolden` 의 cases 하나에 더한다고 SR-5.2 에 적는다.

### I-8 (SR-4.4·SR-4.1) 프리렌더 최소 높이로는 교체 CLS 를 줄이기 어렵다 · eager 만으로는 「늦은 발견」이 풀리지 않는다
- CLS: SPA 는 `createRoot` 로 마운트한다 (`main.tsx:31`). 프리렌더 노드는 통째로 지워지고 새 노드로 바뀐다. CLS 는 프레임 사이에 **살아남은** 노드의 이동만 세므로, 프리렌더 래퍼(`prerender-seo.mjs:485-486`)의 높이는 점수에 거의 닿지 않는다.
- 0.74 의 원인은 아직 확인되지 않았다 (`perf-baseline.md:42` 「별도 확인 대상」, 5회 중 2회). SPA 안의 후보가 더 유력하다: 크기 속성 없는 카드 사진 (`PlacePage.tsx:1793-1798`), 지도 블록, 칩 건수 등장.
- `shellBody` 는 모든 호스트의 프리렌더가 함께 쓴다 (`prerender-seo.mjs:554,1128,1191…`). 고칠 거면 `renderPlaceHubs` 로 한정해야 한다.
- 수정안: SR-4.4 를 「배포 전 측정에서 Lighthouse `layout-shifts` 의 이동 노드를 먼저 기록하고, 그 노드에 맞는 대책을 고른다. 프리렌더 높이는 후보 중 하나」로 바꾼다.
- LCP: 「Resource load delay」는 JS 와 API 응답 뒤에 `<img>` 가 삽입되는 데서 생긴다 (`perf-baseline.md:42`). `fetchpriority` 는 발견 시점을 당기지 못한다. Goal 의 「LCP 이미지 늦은 발견 개선」 기대치를 「lazy 로 인한 추가 지연 제거」로 낮추거나, `tong.visitkorea.or.kr` preconnect 를 함께 적는다. `listFirst` 에서는 지도 타일이 빠지므로 LCP 요소가 바뀔 수 있다. 이 점은 Q2 기록과 함께 둔다.

### I-9 (사소) 배치·랜드마크 위치
- `mapSplit` 38vh: 지금 좁은 화면은 두 단계다. 641~899px 는 `min-height:16rem` (`PlacePage.css:804-807`), ≤640px 는 `height:42vh` (`:892-900`). 두 단계를 모두 38vh 로 바꾸는지 적는다.
- `<main>`: `.place-page` 는 헤더와 바닥글까지 감싼다 (`PlacePage.tsx:1190,1651`). 본문만 랜드마크로 하려면 `.place-body`(`:1467`, `AttractionPage.tsx:307`, `RegionPage.tsx:207`)가 맞다.
- Kotlin `shellBody` 는 「prerender `shellBody`」의 사본이라고 주석에 적혀 있다 (`AttractionPageRenderer.kt:647`). SSR 만 `<main>` 으로 바꾸면 사본 관계가 어긋난다. 의도한 차이라면 주석에 남긴다.

## 요약
구현을 막는 결정 충돌은 없다. 다만 지도 지연 로드(I-1)와 결과 시트(I-2)는 지금 문구대로 구현하면 동작하지 않거나 노출 계측을 두 번 센다. 계측 규약(I-4)·테마 칩(I-5)·https 대상(I-6)은 스펙이 가리키는 대상이 실제 코드에 없다. 모두 스펙 문구 수정으로 해결된다.

VERDICT: REVISE
