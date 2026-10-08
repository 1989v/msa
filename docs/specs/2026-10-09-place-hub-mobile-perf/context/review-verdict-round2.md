# 2라운드 심판 결과 — place 모바일 허브 변형 + 성능 스펙

10건 모두 유지(REVISE)했고, 강등·기각은 없습니다. 각 발견이 인용한 `file:line` 을 워크트리(`3d75179aa`)에서 직접 열어 맞는지 확인했습니다. 반증할 근거(표준에 수용된 패턴, 같은 레포의 동일 패턴, 인용과 다른 원문)는 하나도 찾지 못했습니다.

발견 자체는 다 맞지만, 리뷰어가 낸 수정안 두 개는 그대로 쓰면 효과가 없습니다. 아래 편집 목록에는 고친 안을 넣었습니다.
- **U2-1**: CDP 캡처 뷰포트가 390×844 라 하단 고정 버튼이 y≈790 에 붙습니다. 그래서 리뷰어 식 `min(664, 버튼 top)` 은 늘 664 가 되어 아무것도 빼지 못합니다. 버튼이 화면 바닥에서 차지하는 높이를 664 에서 빼는 식으로 바꿨습니다.
- **T2-2**: `card-dispenser` 는 앞쪽 카드의 `data-src` 를 지우고 그 주소를 `style.backgroundImage` 로 옮깁니다(`node_modules/card-dispenser/dist/index.js` 의 `t.removeAttribute("data-src")…t.style.backgroundImage=`). 그래서 시트를 열어도 `[data-src^=…]` 0개 단언은 여전히 저절로 통과합니다. 배경 이미지도 함께 단언하고, 이미지가 실제로 하나 이상 있다는 전제 단언을 더했습니다.

## 1. 묶음 표

| 묶음 | 발견 | 판정 | 등급 | 확인한 근거 |
|---|---|---|---|---|
| 적용 지점 누락 | I2-1 | keep | REVISE | `SearchUnifiedService.kt:75` 가 `thumbnailUrl = it.thumbnailUrl ?: it.imageUrl` 로 관광지 원천 주소를 싣고, `UnifiedSearchPage.tsx:227` 이 `src={hit.thumbnailUrl}` 로 그대로 씀 |
| preconnect 위치 | I2-2 | keep | REVISE | place 전용 셸이 없음. `prerender-seo.mjs:166` 이 `index.html` 하나를 셸로 쓰고, `renderPlaceHubs` 는 `compose(shell, …)`(:1117) |
| 오버레이 칩 흐름 | I2-3, U2-2 | keep ×2 | REVISE | 키가 없으면 지도 자리가 placeholder(:1619-1620)이고 칩은 키와 무관하게 그려짐(:1364-1370). `KhSheet` 는 모달(`aria-modal="true"` :63, veil 클릭 닫기 :58, body 스크롤 잠금 :30) |
| 진입 fitBounds | I2-4 | keep | REVISE | `zoom_changed` 가 `setMapMoved(true)`(:769)를 부르고, 리셋은 idle 에서만(:934-939) |
| 테스트 셀렉터·픽스처 | T2-1 | keep | REVISE | 사진 없는 카드가 `<div className="place-card-img place-card-img-empty" aria-hidden />`(:1800). `item()` 픽스처는 `imageUrl: null`(테스트 :45) |
| 저절로 통과하는 단언 | T2-2 | keep | REVISE | `data-src` 는 PickSheet render 에만 있음(:1290). dispenser 가 앞쪽 카드에서 그 속성을 지움 |
| 목으로 폭 전환 불가 | T2-3 | keep | REVISE | 테스트 :66-71 은 호출마다 새 객체에 `addEventListener: vi.fn()`. `useMediaQuery.ts:12-15` 는 같은 mql 의 change 이벤트를 받아야 다시 읽음 |
| CI 게이트 누락 | T2-4 | keep | REVISE | `ci.yml:305`(jsonld)와 `:311-312`(footer)처럼 파일마다 단계가 따로 있고, 새 파일은 어느 단계에도 없음 |
| 폴드 정의 | U2-1 | keep | REVISE | SR-3.1 이 「bottom ≤ 664」 뿐이고, SR-1.4 의 하단 고정 버튼이 가리는 영역을 빼지 않음 |

## 2. 발견별 JSON

```json
[
  { "id": "I2-1 적용 지점(전부)에 통합 검색 썸네일이 빠졌다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "search/app/src/main/kotlin/com/kgd/search/.../unified/service/SearchUnifiedService.kt", "line": 75, "quote": "thumbnailUrl = it.thumbnailUrl ?: it.imageUrl," },
      { "file": "portal-fe/src/pages/search/UnifiedSearchPage.tsx", "line": 227, "quote": "{hit.thumbnailUrl && <img className=\"usearch-thumb\" src={hit.thumbnailUrl} alt=\"\" loading=\"lazy\" />}" },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 50, "quote": "적용 지점(전부): ... components/home/ServiceShowcase.tsx:165 / copy.mjs:676 ..." } ],
    "reason": "인용이 원문과 같고, 「전부」라고 한 목록에 원천 tong 주소를 출력하는 지점이 빠져 있어 반증이 없다." },
  { "id": "I2-2 preconnect 를 둘 place 셸 head 가 존재하지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 166, "quote": "const shell = await readFile(resolve(DIST, 'index.html'), 'utf8');" },
      { "file": "portal-fe/scripts/prerender-seo.mjs", "line": 1117, "quote": "const html = compose(shell, {" },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 47, "quote": "<link rel=\"preconnect\"> 를 place 셸 head 에 하나 둔다" } ],
    "reason": "place 전용 셸이 없어서 지시를 구현할 위치가 정해지지 않고, index.html 에 넣으면 모든 호스트의 산출물이 바뀐다." },
  { "id": "I2-3 지도 키가 없을 때 오버레이 칩이 돌아올 수 없는 상태로 보낸다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1368, "quote": "onClick={() => setOverlay(overlay === c ? null : c)}" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1620, "quote": "<div className=\"place-map place-map-placeholder\">{L.mapKeyMissing}</div>" },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 22, "quote": "hasMapKey 가 false 면 버튼을 그리지 않는다." } ],
    "reason": "SR-1.4(키 없으면 버튼 없음)와 SR-1.6(칩을 누르면 지도 상태)이 겹치면 목록으로 돌아올 수단이 없다. 코드가 그대로 확인된다." },
  { "id": "I2-4 지도 상태 진입 fitBounds 가 「이 지역 검색」 버튼을 바로 띄운다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 769, "quote": "map.addListener('zoom_changed', () => setMapMoved(true));" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 932, "quote": "if (!isMobile || page === 0) {" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 939, "quote": "setMapMoved(false);" } ],
    "reason": "스펙이 「SIDO 줌 상한 유지」만 적고 mapMoved 리셋을 빠뜨렸다. page>0 이면 기존 fit 이 돌지 않는 분기도 원문으로 확인된다." },
  { "id": "T2-1 .place-card-img 셀렉터가 사진 없는 카드의 div 까지 잡는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1800, "quote": "<div className=\"place-card-img place-card-img-empty\" aria-hidden />" },
      { "file": "portal-fe/src/pages/place/__tests__/PlacePage.test.tsx", "line": 45, "quote": "address: null, latitude: 37.5, longitude: 127, imageUrl: null, ..." },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 68, "quote": "모든 `.place-card-img` 에 width·height." } ],
    "reason": "셀렉터가 div 까지 잡고, 기존 픽스처로는 「eager 정확히 2개」가 성립하지 않는다." },
  { "id": "T2-2 [data-src^=\"http://tong.\"] 0개 단언이 저절로 통과한다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1290, "quote": "`<div class=\"cd-photo\" data-src=\"${escapeHtml(a.thumbnailUrl ?? a.imageUrl ?? '')}\"></div>`" },
      { "file": "portal-fe/src/pages/place/PlacePage.tsx", "line": 1284, "quote": "{pickOpen && (" },
      { "file": "portal-fe/node_modules/card-dispenser/dist/index.js", "line": 1, "quote": "t.removeAttribute(\"data-src\"),o&&(t.style.backgroundImage=`url(\"${o.replace(/\"/g,\"%22\")}\")`)" } ],
    "reason": "시트를 열지 않으면 대상이 없고, 열어도 dispenser 가 data-src 를 지우므로 단언 근거를 보강해야 한다. 원문 그대로다." },
  { "id": "T2-3 「폭 전환(matchMedia 변경)」을 기존 목으로는 일으킬 수 없다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/pages/place/__tests__/PlacePage.test.tsx", "line": 66, "quote": "window.matchMedia = vi.fn().mockImplementation((query: string) => ({ matches: mobile, ... addEventListener: vi.fn()," },
      { "file": "portal-fe/src/pages/place/useMediaQuery.ts", "line": 12, "quote": "const mql = window.matchMedia(query); const onChange = () => setMatches(mql.matches);" } ],
    "reason": "리스너를 보관하지 않는 목으로는 change 를 흘릴 수 없어, 스펙에 적힌 테스트를 쓸 수 없다." },
  { "id": "T2-4 새 패리티 골든 파일이 CI 검사에 걸리지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": ".github/workflows/ci.yml", "line": 305, "quote": "run: git diff --exit-code -- search/app/src/test/resources/render/jsonld-golden.json" },
      { "file": ".github/workflows/ci.yml", "line": 312, "quote": "test -z \"$(git status --porcelain -- search/app/src/test/resources/render/footer-links-golden.json)\"" } ],
    "reason": "검사가 파일마다 따로 있다. 스펙은 선례의 CI 검사를 근거로 들었지만 새 파일에 대한 단계는 지시하지 않았다." },
  { "id": "U2-1 「폴드 안 카드」 정의가 하단 고정 버튼을 빼지 않는다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 44, "quote": "「폴드 안 카드」는 getBoundingClientRect().top ≥ 0 이고 bottom ≤ 664 인 .place-card 의 수다." },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 22, "quote": "화면 하단 고정 버튼 「지도 보기 / Map」." },
      { "file": "docs/plans/2026-10-08-place-growth-work-plan.md", "line": 79, "quote": "390×844 CSS 뷰포트(브라우저 UI 제외 가시 높이 약 664px 가정)" } ],
    "reason": "발견은 맞다. 다만 844 뷰포트에서는 버튼 top 이 664 보다 아래라 리뷰어 식이 무동작이어서, 식을 고쳐 반영한다." },
  { "id": "U2-2 오버레이 칩 대안 흐름의 사후 조건이 비어 있다", "verdict": "keep", "severity": "REVISE",
    "evidence": [
      { "file": "portal-fe/src/components/shell/KhSheet.tsx", "line": 58, "quote": "<div className=\"kh-sheet-veil\" onClick={onClose}>" },
      { "file": "portal-fe/src/components/shell/KhSheet.tsx", "line": 63, "quote": "aria-modal=\"true\"" },
      { "file": "docs/specs/2026-10-09-place-hub-mobile-perf/spec.md", "line": 25, "quote": "지도 오버레이 칩(필터 시트 안): 목록 상태에서 누르면 오버레이를 켜고 지도 상태로 전환한다" } ],
    "reason": "모달 시트가 열린 채로 전환되면 전환이 veil 에 가려 보이지 않는다. 스펙에 시트를 닫는다는 사후 조건이 없다." }
]
```
SUMMARY: keep 10 / demote 0 / dismiss 0
NOTES: SR-4.2 가 `:1290` 을 「InfoWindow」라고 불렀지만 실제로는 「뽑기」 시트 render 입니다(PlacePage 에 InfoWindow 는 없음). T2-2 편집에서 이름을 함께 고칩니다. 그 밖에 지적하지 않은 것: 렌더 단위 단언(허브·상세·지역)도 「https tong 이미지가 1개 이상」이라는 전제 단언이 없어서, 같은 이유로 저절로 통과할 수 있습니다.

## 3. spec.md 편집 목록

각 항목은 바꿀 문장 → 새 문장입니다. 「(추가)」는 지정 위치에 그대로 덧붙입니다.

**E2-0 머리말** (6행 뒤에 추가)
> (추가) `> 개정 2 2026-10-09 — 2라운드 심판(10건 전부 유지, context/review-verdict-round2) 반영. 새 사용자 판단 Q8~Q10 은 권고 기본값으로 진행.`

**E2-1 SR-1.5** (23행, I2-4)
- 바꿀 문장: 「지도 상태로 들어간 직후 현재 결과로 fitBounds 를 한 번 다시 하고(idle 뒤 SIDO 줌 상한 규칙 유지), 목록 상태에서는 결과가 바뀌어도 숨긴 지도에 fitBounds 를 하지 않는다.」
- 새 문장: 「지도 상태로 들어갈 때마다(첫 진입 포함) 현재 결과로 fitBounds 를 한 번 한다. 첫 진입은 지도 초기화가 끝나 `mapReady` 가 true 가 된 뒤에 한다. idle 에서는 기존 `PlacePage.tsx:932-940` 과 같이 SIDO 줌 상한을 적용하고 `setMapMoved(false)` 를 부른다 — 리셋을 빼면 fitBounds 가 낸 `zoom_changed`(:769) 때문에 「이 지역 검색」 버튼이 바로 뜬다. 이 진입 fit 은 마커 effect 의 `!isMobile || page === 0` 분기(:932)와 별개로, page 값과 무관하게 한다. 목록 상태에서는 결과가 바뀌어도 숨긴 지도에 fitBounds 를 하지 않는다(마커 effect 의 fit 도 목록 상태면 건너뛴다).」

**E2-2 SR-1.6 첫 항목** (25행, I2-3 · U2-2)
- 바꿀 문장: 「- 지도 오버레이 칩(필터 시트 안): 목록 상태에서 누르면 오버레이를 켜고 지도 상태로 전환한다(오버레이 질의는 mapView 가 필요 — `PlacePage.tsx:974`).」
- 새 문장: 「- 지도 오버레이 칩(필터 시트 안): 다음 세 조건이 모두 맞을 때만 지도 상태로 전환하고, 시트 `onClose` 와 같은 함수를 불러 필터 시트를 닫는다(오버레이 질의는 mapView 가 필요 — `PlacePage.tsx:974`). 조건은 `hasMapKey` 가 true, 목록 상태, 그 클릭으로 오버레이가 켜짐(꺼진 칩을 누름)이다. 지도 상태에서 누르는 클릭과 오버레이를 끄는 클릭은 지금처럼 오버레이 값만 바꾸고 시트를 열어 둔다. `hasMapKey` 가 false 면 칩은 지금처럼 그리되 오버레이 값만 바꾸고 목록 상태를 유지한다(전환 버튼이 없어 돌아올 길이 없다).」

**E2-3 SR-3.1 마지막 문장** (44행, U2-1)
- 바꿀 문장: 「「폴드 안 카드」는 getBoundingClientRect().top ≥ 0 이고 bottom ≤ 664 인 .place-card 의 수다.」
- 새 문장: 「「폴드 안 카드」는 getBoundingClientRect().top ≥ 0 이고 bottom ≤ L 인 .place-card 의 수다. L = 664 − (window.innerHeight − 하단 고정 버튼의 getBoundingClientRect().top) 이고, 버튼이 없으면(mapSplit 이거나 hasMapKey 가 false) L = 664 다. 고정 버튼은 실제 폰에서 가시 영역 바닥(664)에 붙기 때문이다. 그래서 844 뷰포트에서 잰 버튼 top 을 그대로 쓰지 않고, 버튼이 화면 바닥에서 차지하는 높이만큼 664 에서 뺀다.」

**E2-4 SR-4.1 첫 두 문장** (47행, T2-1)
- 바꿀 문장: 「허브 카드 이미지: 문서 전체에서 목록의 처음 2장만 `loading="eager"` + `fetchpriority="high"`, 나머지는 lazy.」
- 새 문장: 「허브 카드 이미지: 문서 전체에서 사진이 있는 카드 가운데 목록 순서로 앞의 2장만 `loading="eager"` + `fetchpriority="high"`, 나머지는 lazy. 사진 없는 카드(`div.place-card-img-empty`, `PlacePage.tsx:1800`)는 세지 않는다 — 카드 순번이 아니라 사진 순번이다(Q8).」

**E2-5 SR-4.1 preconnect 문장** (47행, I2-2)
- 바꿀 문장: 「사진 원천 `https://tong.visitkorea.or.kr` 에 `<link rel="preconnect">` 를 place 셸 head 에 하나 둔다.」
- 새 문장: 「사진 원천에 `<link rel="preconnect" href="https://tong.visitkorea.or.kr">` 하나를 `renderPlaceHubs` 가 만드는 두 파일(`prerender/_hosts/place.1989v.com.html` · `place.1989v.com.en.html`)의 head 에만 넣는다. `crossorigin` 은 달지 않는다(img 는 no-cors 요청이라 crossorigin 연결은 재사용되지 않는다). `data-seo-multi` 도 달지 않는다(useSeo 가 지우지 않게). `index.html` 과 `compose`·`metaTags` 의 기본 출력은 바꾸지 않고, 다른 프리렌더 산출물은 바이트가 같아야 한다. SPA 폴백·지역 프리렌더·상세 SSR(`AttractionPageRenderer`)에는 넣지 않는다.」

**E2-6 SR-4.2 적용 지점** (50행, I2-1 · T2-2 이름 정정)
- 바꿀 문장: 「InfoWindow data-src(:1290)」 → 새 문장: 「「뽑기」 시트 카드 render 의 data-src(:1290)」
- 바꿀 문장: 「`components/home/ServiceShowcase.tsx:165` /」 → 새 문장: 「`components/home/ServiceShowcase.tsx:165` / `pages/search/UnifiedSearchPage.tsx:227`(통합 검색 썸네일 — 관광지 외 유형도 섞이지만 무조건 적용한다. 다른 호스트는 규칙상 그대로 지나간다) /」

**E2-7 SR-4.2 세 번째 항목** (51행, T2-2)
- 바꿀 문장: 「HTML 문자열에 넣는 곳(InfoWindow, ServiceShowcase, Kotlin 메타)은」
- 새 문장: 「HTML 문자열에 넣는 곳(「뽑기」 시트 render, ServiceShowcase, Kotlin 메타)은」

**E2-8 SR-5.1 목 경계** (59행, T2-3)
- 바꿀 문장: 「matchMedia 목은 `MOBILE_QUERY` 에만 mobile 값을 돌려주고 나머지 쿼리는 false.」
- 새 문장: 「matchMedia 목은 쿼리 문자열마다 mql 객체를 하나 만들고, 같은 쿼리에는 같은 객체를 돌려준다(`useMediaQuery` 는 초기값과 effect 에서 두 번 부른다 — `useMediaQuery.ts:9,12`). `MOBILE_QUERY` 에만 mobile 값을 주고 나머지 쿼리는 false 다. `addEventListener('change', fn)` 은 리스너를 보관한다. 폭 전환은 그 mql 의 `matches` 를 바꾼 뒤 보관한 리스너를 `act()` 안에서 불러 일으킨다. 기존 목(`PlacePage.test.tsx:64-71`)은 호출마다 새 객체에 `vi.fn()` 리스너라 전환을 흘릴 수 없다.」

**E2-9 SR-5.1 listFirst 줄** (60행, I2-3 · U2-2)
- 바꿀 문장: 「· 오버레이 칩 → 지도 상태 전환 ·」
- 새 문장: 「· 꺼진 오버레이 칩 클릭 → 지도 상태 전환 + 필터 시트 닫힘(`queryByRole('dialog', { name: '필터' })` 가 null) · `mapsApiKey` 가 빈 값일 때(이 단언만 빈 값) 오버레이 칩 클릭 → 목록 상태 유지(지도 영역 숨김 그대로, 「지도 보기」 버튼 없음) ·」

**E2-10 SR-5.1 eager 줄** (68행, T2-1)
- 바꿀 문장: 「- 문서 전체에서 `img[loading=eager]` 정확히 2개, 그 둘에 fetchpriority=high, 모든 `.place-card-img` 에 width·height.」
- 새 문장: 「- 첫 카드는 사진 없음, 그 뒤로 사진 있는 카드 3장 이상인 픽스처를 쓴다(기존 `item()` 은 `imageUrl: null` — `PlacePage.test.tsx:45`). 단언: 문서 전체에서 `img[loading=eager]` 가 정확히 2개이고 그 둘이 사진 있는 앞 두 카드다. 그 둘에 fetchpriority=high 가 있다. 모든 `img.place-card-img` 에 width·height 가 있다(`div.place-card-img-empty` 는 대상이 아니다).」

**E2-11 SR-5.1 렌더 단위 줄** (70행 끝에 추가, T2-2)
> (추가) 「허브는 「뽑기」를 눌러 PickSheet 를 연 뒤 단언한다(뽑기 질의 응답도 같은 http 픽스처). card-dispenser 는 앞쪽 카드의 `data-src` 를 지우고 `style.backgroundImage` 로 옮긴다. 그래서 먼저 `https://tong.` 이 든 `.cd-photo`(data-src 또는 style.backgroundImage)가 1개 이상인지 단언하고, 이어서 `[data-src^="http://tong."]` 0개와 `style.backgroundImage` 에 `http://tong.` 이 든 `.cd-photo` 0개를 단언한다.」

**E2-12 SR-5.2 끝에 추가** (73행, T2-4)
> (추가) 「`.github/workflows/ci.yml` 의 「Footer links golden fixture is current」 단계(:309-312) 바로 뒤에 같은 모양의 단계 「Secure image golden fixture is current」를 더한다. 내용은 `git diff --exit-code -- search/app/src/test/resources/render/secure-image-golden.json` 과 `test -z "$(git status --porcelain -- search/app/src/test/resources/render/secure-image-golden.json)"` 두 줄이다. 처음 생긴 파일에는 diff 가 0 을 내므로 status 줄이 필요하다(Q10).」

**E2-13 SR-5.3 끝에 추가** (74행, T2-2 · T2-4)
> (추가) 「· 「뽑기」 시트 render 호출부에서 `secureImageUrl` 제거 → 렌더 단위 단언 빨강 · 커밋된 `secure-image-golden.json` 한 값을 바꾼 채 E2-12 의 두 명령을 로컬에서 실행 → 0 이 아닌 종료 코드.」

**E2-14 SR-5.4 확인 심볼** (75행, I2-2)
- 바꿀 문장: 「(예: secureImageUrl 결과가 반영된 https 주소, `<main>`)」
- 새 문장: 「(예: secureImageUrl 결과가 반영된 https 주소, `<main>`, 허브 head 의 tong preconnect). 배포 전에는 빌드 산출물에서 `grep -l 'rel="preconnect" href="https://tong'` 결과가 place 허브 두 파일뿐인지 확인한다」

**E2-15 SR-5.5 끝에 추가** (76행, U2-1 · I2-4)
> (추가) 「폴드 표에 L 값도 적는다. listFirst 390×844 에서 지도 상태로 들어간 직후(idle 뒤) 「이 지역 검색」 버튼이 DOM 에 없는지 확인해 같은 표에 적는다.」

**E2-16 Existing Code to Leverage** (79행 끝에 추가)
> (추가) 「, `PlacePage.tsx:1290(뽑기 render),1364-1370(오버레이 칩),1619-1620(키 없음 placeholder),1800(사진 없는 카드)`, `useMediaQuery.ts:8-19`, `UnifiedSearchPage.tsx:227`, `SearchUnifiedService.kt:75`, `.github/workflows/ci.yml:303-312`, `card-dispenser`(data-src → backgroundImage 처리)」

## 4. 3라운드 재리뷰가 필요한 차원

**implementation · test-strategy 두 차원만** 필요합니다. 이번 편집이 고친 문장(E2-1, E2-2, E2-4, E2-5, E2-8, E2-10~E2-13)을 코드와 대조해 그대로 구현할 수 있는지만 보면 됩니다. usecase 는 E2-3·E2-15 로 닫혔고, 확인이 필요하면 test-strategy 리뷰어가 폴드 식 한 줄을 함께 보면 충분합니다. architecture·security·domain 은 필요 없습니다. 통합 검색 추가는 이미 수용된 앞부분 일치 규칙을 그대로 적용하는 것뿐이라 규칙 자체는 바뀌지 않았습니다.

## 5. 사용자 판단 항목

셋 다 권고 기본값으로 진행할 수 있습니다.

| ID | 항목 | 권고 기본값 | 이유 |
|---|---|---|---|
| Q8 | eager 2장의 기준: 카드 순번 0·1 이냐, 사진 있는 앞 2장이냐 | **사진 있는 앞 2장** | 허브 LCP 는 첫 사진입니다. 순번 기준이면 첫 카드에 사진이 없을 때 eager 가 1장으로 줄어듭니다. |
| Q9 | 키가 없을 때 오버레이 칩 처리: 전환만 막느냐, 칩을 숨기느냐 | **전환만 막는다** | 칩을 숨기면 데스크톱 화면도 바뀌어 Out of Scope(데스크톱 변경)에 걸립니다. 키가 없는 환경에서는 mapView 가 없어 칩이 지금도 실제 동작이 없으므로 달라지는 것이 없습니다. |
| Q10 | `ci.yml` 에 골든 검사 단계 하나 추가 | **추가** | 전역 규칙은 명시 요구 없는 CI 변경을 금지합니다. 다만 이 단계가 없으면 새 패리티 골든이 무동작 게이트가 되고, footer 골든과 같은 선례가 있어 태스크 목표로 정당화됩니다. 단계 하나만 더해야 하므로 사용자 확인을 받습니다. |

## 6. 메모

- `listFirst` 에서 숨겨 두었던 지도를 다시 보일 때 지도 크기가 맞지 않을 수 있습니다. E2-1 의 진입 fit 이 이를 덮을 것으로 보지만, 3라운드에서 implementation 리뷰어가 한 번 확인하면 좋습니다(새 발견 아님, 확인 요청).
- 판정 대상 스펙: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`
- 발견 원문: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-hub-mobile-perf/context/engineer-review-round2.md`