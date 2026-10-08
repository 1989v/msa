# Engineer Review — architecture (1라운드)

대상: `docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
Seed: spec · `context/open-questions.yml` · `planning/initialization.md` · `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` · 코드(`PlacePage.tsx`, `placeView.ts`, `googleMaps.ts`, `copy.mjs`, `prerender-seo.mjs`, `AttractionPageRenderer.kt`, `AttractionSeoText.kt`, 패리티 테스트 2종)

## 체크리스트 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| 레이어 책임 분리 | OK | 백엔드 변경은 `infrastructure/render` 렌더러뿐. 순수 문자열 규칙은 domain `AttractionSeoText`(`search/domain/.../AttractionSeoText.kt:15`)에 둘 수 있다 — A-1 |
| 상향 의존 금지 | OK | 새 의존 없음 |
| 외부 연동은 Port 경유 | OK | Google Maps 로더는 기존 `googleMaps.ts:18` 그대로. 호출 시점만 바뀐다 |
| 모듈 경계 변경 근거 | **REVISE** | FE·Kotlin https 규칙의 원본 위치와 패리티 리소스 위치가 스펙에 없다 — A-1 |
| 패턴 일관성 | **REVISE** | 계측 규약 재사용이 기존 계약과 어긋난다 — A-3. 공용 `shellBody` 변경 범위 — A-4 |
| 순환 의존 없음 | OK | — |
| 트랜잭션 경계 | 해당 없음 | — |
| 인터페이스 최소 | **REVISE** | 「필터 N」 정의에서 geo 처리가 빠졌다 — A-5 |
| 얕은 패스스루 없음 | OK | 새 모듈은 `secureImageUrl` 하나. 호출처가 10곳 이상이라 Deletion Test 를 통과한다(아래) |
| 정보 은닉 | **REVISE** | 지연 로드 지도의 생명주기(마운트 유지·오버레이)를 호출부가 추측해야 한다 — A-2 |
| Seam 현실성 | OK | 새 인터페이스 없음 |
| 이름 | OK | `secureImageUrl`·`DEFAULT_MOBILE_LAYOUT` 는 동작을 그대로 말한다 |

### Deletion Test — `secureImageUrl`
지우면 같은 치환이 다음 호출처로 흩어진다: `PlacePage.tsx:1290,1678,1795` · `RegionPage.tsx:248,287` · `NearbyExplore.tsx:250` · `AttractionPage.tsx:165,202` · `ServiceShowcase.tsx:165` · `FavoritesPage.tsx:87` · `copy.mjs:676`. 함수로 둘 값어치가 있다. **SHIP**

## 이슈

### A-1 (REVISE) https 규칙의 원본 위치·적용 지점·패리티 리소스가 정해지지 않았다
- 스펙 SR-4.2: 「FE 는 함수 하나(`secureImageUrl`), SSR 은 Kotlin 함수 하나」, SR-5.2 「테스트 리소스 하나」. 위치가 없다.
- 레포 선례: FE·프리렌더·SSR 이 같이 쓰는 표시 규칙의 원본은 `copy.mjs` 다(`AttractionPageRenderer.kt:33-37`). TS 쪽은 `placeView.ts:249` 처럼 다시 내보낸다. JSON-LD 이미지는 `copy.mjs:676` 이 만든다. `.ts` 에 두면 `copy.mjs` 가 가져다 쓸 수 없다. 그러면 Kotlin JSON-LD(`AttractionPageRenderer.kt:241`)만 https 가 되고, `AttractionJsonLdParityTest` 와 `jsonld-golden.json` 의 패리티가 깨진다.
- 스펙 목록에 og:image 가 빠졌다. SSR `AttractionPageRenderer.kt:54` 와 FE `useSeo` 의 og 이미지도 사진 주소를 내보낸다.
- 수정안:
  1. FE 함수는 `portal-fe/src/seo/copy.mjs` 에 두고 `placeView.ts` 가 다시 내보낸다.
  2. Kotlin 함수는 `AttractionSeoText`(domain, `sourceText` 옆)에 둔다. 렌더러 private 으로 두지 않는다.
  3. 패리티 입력 표는 선례(`attractionJsonLdGolden.test.ts:24`, `footerLinksGolden.test.ts:15`)대로 `search/app/src/test/resources/render/` 에 둔다.
  4. 적용 지점에 og:image 를 추가하고 `jsonld-golden.json` 을 다시 만든다고 명시한다.
  5. 「화면에 내보내는 모든 사진 주소」를 위 Deletion Test 의 호출처 목록으로 고정하거나, `placeApi.ts:406,442` 응답 매핑 한 곳에서 적용하는 안과 비교해 하나를 고른다.

### A-2 (REVISE) `listFirst` 지연 로드에서 지도 생명주기가 정의되지 않았다
- 지도 초기화 effect 는 의존이 `[hasMapKey]` 뿐이고, `mapDivRef` 가 없으면 그냥 끝난다(`PlacePage.tsx:754-777`). 「처음 지도를 열 때」 로드하려면 열림 상태를 effect 의존에 넣어야 한다. 스펙의 「지도는 숨긴다」(SR-1.3)는 CSS 로 숨긴다는 뜻으로도, 언마운트한다는 뜻으로도 읽힌다. 닫을 때 언마운트하면 `mapRef`·마커 맵(`PlacePage.tsx:860-884`)이 끊긴 DOM 을 가리킨다.
- 오버레이 질의는 `enabled: overlay != null && mapView != null` 이다(`PlacePage.tsx:974`). 그래서 지도를 아직 안 연 `listFirst` 에서는 SR-2.2 시트 안의 「지도 오버레이 칩」을 눌러도 아무 일이 일어나지 않는다.
- 수정안: SR-1.3 에 다음 셋을 적는다. ① 열림 요청 상태(`mapRequested`)를 초기화 effect 의 의존으로 둔다. ② 한 번 연 뒤에는 지도 컨테이너를 마운트한 채 CSS 로만 숨긴다. ③ 지도를 열기 전에는 오버레이 칩을 숨기거나, 칩을 누르면 지도를 연다. 고른 쪽은 vitest 항목에 한 줄 더한다.

### A-3 (REVISE) SR-1.6 「기존 지도 열기 계측 규약을 따른다」가 기존 계약과 맞지 않는다
- 기존 「지도 열기」는 관광지 하나에 대한 외부 Google Maps 링크 클릭이다. 형식은 `CLICK` · `entityType: 'ATTRACTION'` · `entityId` · `sectionId: 'MAP_LINK'` · `payload.kind: google_maps_search` 다(`PlacePage.tsx:1709-1719`, `docs/specs/2026-10-08-place-hub-instrumentation/spec.md:43`). 이 값은 「선택당 지도 열기」 비율의 분자로 쓰인다(같은 문서 `:83`, `:87`).
- 허브 「지도 보기」 토글에는 대상 관광지가 없다. 이 규약에 억지로 맞추면 entityId 를 지어내야 하고, MAP_LINK 비율도 오염된다.
- 수정안: 이번 스펙에서는 토글을 계측하지 않는다고 적고 Out of Scope 에 이유를 둔다. 계측이 필요하면 후속 스펙에서 별도 섹션으로 정의한다. SR-1.5 「지도 열기/닫기는 SEARCH 를 내지 않는다」는 그대로 둔다.

### A-4 (REVISE) SR-4.4 의 「프리렌더 본문 래퍼」는 모든 프리렌더 페이지가 함께 쓰는 함수다
- `shellBody` 는 `prerender-seo.mjs:485` 에 하나 있고, 게임·소개 등 모든 프리렌더 페이지가 쓴다(`:554, 582, 619, 1191, 1300, 1387, 1504, 1565, 1637, 1687, 1714, 1763`). 허브는 그중 한 곳이다(`:1128`). 여기에 최소 높이를 넣으면 다른 호스트의 CLS 까지 바뀌어 데스크톱 변경 금지 원칙과 최소 수정 원칙을 어긴다.
- 수정안: 「`renderPlaceHubs`(`prerender-seo.mjs:1098-1136`)에서만 쓰는 래퍼(또는 `shellBody` 옵션 인자)로 적용, 다른 프리렌더 출력은 바이트 동일」을 SR-4.4 에 적고, 전후 산출물 diff 로 확인하는 항목을 SR-5 에 더한다.

### A-5 (REVISE) 「필터 N」 정의에서 geo 조건 처리가 빠졌다
- SR-2.1 은 N 을 「`relaxConditions` 와 같은 정의에서 검색어·지역 제외」로 정의한다. 그런데 `relaxConditions` 는 `geo`(내 주변 반경)도 낸다(`placeView.ts:71`). geo 가 N 에 들어가는지 정해지지 않았다.
- 수정안: N 은 `relaxConditions(s)` 결과에서 `kind ∉ {keyword, region, geo}` 인 것의 개수라고 못 박고(또는 geo 를 포함한다고 명시), 순수 함수로 `placeView.ts` 에 둔다. `?layout` 파싱 함수도 같은 파일에 둔다. `PlacePage.tsx` 는 1,800줄이 넘으니 판정 로직을 더 얹지 않는다.

## 요약
레이어·의존 위반은 없다. 고칠 것은 다섯 가지다. 공유 규칙의 원본 위치(A-1), 지연 로드 지도의 생명주기(A-2), 계측 계약 재사용(A-3), 공용 프리렌더 래퍼의 변경 범위(A-4), 필터 수 정의(A-5). 다섯 모두 스펙 문구로 정할 수 있어서 사람 판단까지 갈 차단 사유는 아니다.

VERDICT: REVISE
