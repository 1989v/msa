<!-- source: portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/PlacePage.css, portal-fe/src/pages/place/googleMaps.ts, portal-fe/src/pages/place/AttractionPage.tsx, portal-fe/src/pages/place/RegionPage.tsx, portal-fe/scripts/prerender-seo.mjs, search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt -->
# Specification: place 모바일 허브 변형 + 성능 (S2-3a · S2-3b · S2-5)

> 2026-10-09. 사용자 위임(「끝까지 진행, 사용자 몫은 마지막에」): D-5 는 계획서 권고 기본값 ⓐ 를 적용하고 두 변형 캡처를 마지막 보고에 올려 사용자가 확정한다(Q1). 1단계 S1-5 측정(`evidence/stage1/perf-baseline.md`)이 지렛대로 짚은 것 — 허브 LCP 는 이미지이고 Resource load delay 955~1,655ms(늦게 발견), CLS 가 0.74 까지 튐, 미사용 JS 873KiB — 만 고친다. ADR 불요(구성·화면 변경, 의존·스키마 변경 없음). 계획서 S2-5 와 다른 점 두 가지 — ① https 치환은 적재 시가 아니라 표시 시점이다(data-sources §0 ② 는 적재 시 파생 컬럼도 허용하지만, 스키마 변경 없이 하려고 표시 시점을 고른다) ② insecure 완료 조건은 SR-5.4 의 기준을 따른다. 같은 내용을 계획서 S2-5 행 비고에 한 줄 더한다.
>
> 개정 2026-10-09 — 1라운드 심판(33건 중 32 유지·1 강등, `context/review-verdict-round1.md`) 반영. 사용자 판단 Q3~Q7 은 심판 권고 기본값으로 진행(마지막에 사용자 확인).
>
> 개정 3 2026-10-09 — 3라운드(마지막) 리뷰 4건(I3-1 진입 fit 다음 프레임·I3-2 지역 고르기 시도 bounds·T3-1 골든 주입 순서·T3-2 문장 분리와 산출물 diff)을 리뷰어 수정안대로 반영 — 강등·기각 없이 전부 수용이라 심판 생략. 마지막 라운드 REVISE 라 hns 규칙상 BLOCK — 편집 반영 상태로 진행하고 마지막 보고에서 사용자 확인.
>
> 개정 2 2026-10-09 — 2라운드 심판(10건 전부 유지, `context/review-verdict-round2.md`) 반영. 새 사용자 판단 Q8(eager 는 사진 있는 앞 2장)·Q9(키 없으면 전환만 막음)·Q10(CI 골든 검사 단계 추가)은 권고 기본값으로 진행.

## Goal
좁은 화면 허브에서 첫 화면에 결과 카드가 바로 보이고(목록 기본, 지도는 전환), 필터가 한 줄로 압축되며, 허브·상세·지역의 성능 지렛대(LCP 이미지의 lazy 추가 지연과 연결 준비 지연·지도 선로드·http 사진·랜드마크)를 같은 조건 전후 비교로 개선한다.

## User Stories
- 휴대폰 방문자로서, 허브를 열면 지도보다 결과 목록이 먼저 보이고, 필요할 때 지도로 바꿔 보고 싶다.
- 휴대폰 방문자로서, 필터가 화면 절반을 차지하지 않고 지금 건 조건을 한 줄로 알고 싶다.
- 방문자로서, 첫 카드 사진이 늦게 뜨거나 화면이 밀리지 않기를 바란다.

## Specific Requirements

### SR-1 모바일 두 배치 변형 (S2-3a)
1. 배치 변형 값은 `listFirst`(ⓐ 목록 기본 + 지도 전환)와 `mapSplit`(ⓑ 지도 상시 + 목록). 좁은 화면(`MOBILE_QUERY`, ≤899.98px)에서만 갈린다 — 데스크톱 레이아웃은 바꾸지 않는다. 배치 변형은 실험 배정(experiment Variant)이 아니다.
2. 고르는 법: 순수 함수 `parseMobileLayout(search: string): MobileLayout` 을 `placeView.ts` 에 둔다. 쿼리 `layout` 이 정확히 `listFirst`·`mapSplit` 이면 그 값, 없거나 그 밖이면 `DEFAULT_MOBILE_LAYOUT`. 화면은 파싱된 값만 쓰고 쿼리 원문을 className·DOM 에 넣지 않는다. `layout` 은 canonical·프리렌더·계측 주소(screenRef 포함)에 넣지 않는다.
3. 지도 요청 상태 `mapRequested`: 데스크톱·`mapSplit` 은 처음부터 true, `listFirst` 는 「지도 보기」를 처음 누를 때 true 가 되고 다시 false 로 돌아가지 않는다. 지도 초기화 effect(`PlacePage.tsx:754-777`)의 반환 조건에 `!mapRequested` 를 더하고 의존 배열을 `[hasMapKey, mapRequested]` 로 바꾼다. 지도 div(`mapDivRef`)는 늘 마운트하고 CSS 로만 숨긴다 — 언마운트하지 않는다.
4. `listFirst` 목록 상태: 목록이 툴바 바로 아래, 지도 영역은 숨김. 화면 하단 고정 버튼 「지도 보기 / Map」. `hasMapKey` 가 false 면 버튼을 그리지 않는다.
5. `listFirst` 지도 상태: 지도가 툴바 아래 남은 높이를 다 쓰고, 결과는 지도 위 하단 「결과 패널」로 보인다. 결과 패널은 같은 `.place-list-col` 을 지도 상태 클래스로 하단에 배치한 것이다 — `KhSheet` 가 아니며(비모달: veil·body 스크롤 잠금·포커스 가둠 없음) 목록을 두 번 그리지 않는다. 접힌 높이는 카드 1장이고 패널 안 세로 스크롤로 나머지를 본다. 같은 하단 버튼이 「목록 보기 / List」로 바뀐다. 지도 상태로 들어갈 때마다(첫 진입 포함) 현재 결과로 fitBounds 를 한 번 한다 — 지도 div 가 보이게 된 뒤 레이아웃이 끝나도록 다음 프레임(`requestAnimationFrame`)에서 한다(크기 0 상태로 줌을 계산하지 않게). `pickingRegion` 이면 관광지 결과가 아니라 시도 마커 bounds 로 맞춘다. 첫 진입은 지도 초기화가 끝나 `mapReady` 가 true 가 된 뒤에 한다. idle 에서는 기존 `PlacePage.tsx:932-940` 과 같이 SIDO 줌 상한을 적용하고 `setMapMoved(false)` 를 부른다 — 리셋을 빼면 fitBounds 가 낸 `zoom_changed`(:769) 때문에 「이 지역 검색」 버튼이 바로 뜬다. 이 진입 fit 은 마커 effect 의 `!isMobile || page === 0` 분기(:932)와 별개로, page 값과 무관하게 한다. 목록 상태에서는 결과가 바뀌어도 숨긴 지도에 fitBounds 를 하지 않는다(마커 effect 의 fit 도 목록 상태면 건너뛴다).
6. `listFirst` 대안 흐름:
   - 지도 오버레이 칩(필터 시트 안): 다음 세 조건이 모두 맞을 때만 지도 상태로 전환하고, 시트 `onClose` 와 같은 함수를 불러 필터 시트를 닫는다(오버레이 질의는 mapView 가 필요 — `PlacePage.tsx:974`). 조건은 `hasMapKey` 가 true, 목록 상태, 그 클릭으로 오버레이가 켜짐(꺼진 칩을 누름)이다. 지도 상태에서 누르는 클릭과 오버레이를 끄는 클릭은 지금처럼 오버레이 값만 바꾸고 시트를 열어 둔다. `hasMapKey` 가 false 면 칩은 지금처럼 그리되 오버레이 값만 바꾸고 목록 상태를 유지한다(전환 버튼이 없어 돌아올 길이 없다).
   - 클러스터 최대 줌 안내: 결과 패널 안 같은 `place-card-{id}` 로 스크롤한다.
   - 지도 상태에서 핀 선택: 지금처럼 상세 `KhSheet` 가 결과 패널 위에 뜨고, 닫으면 지도 상태 그대로.
   - 지역 고르기(`pickingRegion`): 지도 상태면 시도 마커를 그리고, 결과 패널은 지금 목록 칸 내용을 그대로 보여준다.
   - 화면 폭 전환: 넓은 화면으로 가면 `mapRequested` = true. 다시 좁아지면 목록/지도 상태는 전환 전 값을 유지한다. `loadGoogleMaps` 는 세션에서 한 번만 부른다.
   - 무한 스크롤 센티널: 결과 패널 스크롤 컨테이너 안에 두어 패널 끝에서 발화한다.
   - 「목록 보기」 복귀: 같은 DOM 이므로 스크롤 위치·selectedId 를 유지한다.
7. `mapSplit`: 지도 높이 38vh — 지금의 두 단계(641~899px `min-height:16rem`, ≤640px `height:42vh`)를 둘 다 38vh 로 맞춘다. 목록은 아래. 지도는 마운트 때 로드(지금과 같음).
8. 두 변형은 같은 질의·데이터·카드 컴포넌트를 쓴다. 변형 선택과 지도 전환은 질의(`query` 메모)·계측 trigger 를 바꾸지 않고 SEARCH 를 내지 않는다.
9. 계측: 「지도 보기 / 목록 보기」 전환은 계측하지 않는다(track 미호출). 「지도 열기」는 관광지 하나의 구글맵 링크(MAP_LINK, 계측 스펙 43행)를 뜻하고, 대상 없는 전환을 그 규약으로 보내면 「선택당 지도 열기」 비율이 오염된다. 지도 상태에서 생긴 핀 CLICK·「이 지역 검색」 SEARCH 는 계측 스펙 그대로. 전환을 세는 일은 open-questions Q3(후속)로 둔다.

### SR-2 홈 필터 압축 (두 변형 공통)
1. 좁은 화면 툴바 아래 한 줄: 지역 트리거(`RegionSheet`) 1개 + 핵심 분류 칩 3개(전체=category null · 자연=nature · 행사=event, 두 언어 공통 — Q4) + 「필터 N」 버튼 + 선택 조건 요약 한 줄(넘치면 말줄임).
2. N 은 `placeView.ts` 의 순수 함수 `activeFilterCount(s: HubFilterState)` 로 구한다 = `relaxConditions(s)` 결과 중 kind 가 `category`·`eventStatus`·`attribute` 인 것의 수. `keyword`·`region`·`geo` 는 세지 않고, 지도 오버레이는 조건이 아니라 세지 않는다(Q5). N=0 이면 버튼 문구는 「필터 / Filters」.
3. 요약 줄은 N 에 센 조건과 같은 목록의 이름(분류 이름·행사 상태 이름·속성 이름)을 「 · 」로 잇는다. N=0 이면 요약 줄을 그리지 않는다.
4. 「필터 N」은 `KhSheet` 를 연다(label 「필터 / Filters」). 안에는 지금의 분류 칩 전부·행사 상태·속성 칩·지도 오버레이 칩을 지금과 같은 컴포넌트·핸들러·계측으로 둔다. `onClose` 는 `useCallback` 으로 고정한다(KhSheet effect 가 `[onClose]` 에 의존해 다시 돌 때마다 패널로 포커스를 옮긴다).
5. 데스크톱은 지금 칩 배치 그대로.

### SR-3 기본 변형 적용 (S2-3b)
1. `DEFAULT_MOBILE_LAYOUT = 'listFirst'`(사용자 위임 기본값, Q1). 완료 조건(계획서 S2-3b): 390×844 에서 폴드 안 카드 2장이 「완전히 보임」, 1440×900 첫 카드 y ≤ 320px. 폴드 높이는 브라우저 UI 를 뺀 가시 높이 664px 로 잰다(계획서 S2-2 가정과 같음). 가독성과 충돌하면 가독성 우선 — 못 맞추면 실측 값과 이유를 보고한다. 사전 측정: 구현 전 운영 1440×900 의 현재 첫 카드 y 를 CDP 로 재 evidence 에 남긴다. 데스크톱은 바꾸지 않으므로(Out of Scope) 320 을 넘으면 실측 값과 겹쳐 쌓인 요소 목록을 보고하고 완료 조건 미충족으로 표시한다(Q6). 「폴드 안 카드」는 getBoundingClientRect().top ≥ 0 이고 bottom ≤ L 인 .place-card 의 수다. L = 664 − (window.innerHeight − 하단 고정 버튼의 getBoundingClientRect().top) 이고, 버튼이 없으면(mapSplit 이거나 hasMapKey 가 false) L = 664 다. 고정 버튼은 실제 폰에서 가시 영역 바닥(664)에 붙기 때문에, 844 뷰포트에서 잰 버튼 top 을 그대로 쓰지 않고 버튼이 화면 바닥에서 차지하는 높이만큼 664 에서 뺀다.

### SR-4 성능 (S2-5)
1. 허브 카드 이미지: 문서 전체에서 사진이 있는 카드 가운데 목록 순서로 앞의 2장만 `loading="eager"` + `fetchpriority="high"`, 나머지는 lazy. 사진 없는 카드(`div.place-card-img-empty`, `PlacePage.tsx:1800`)는 세지 않는다 — 카드 순번이 아니라 사진 순번이다(Q8). 모든 카드 `<img>` 에 `width="88" height="88"`(CSS 88px 정사각과 같은 비율). 사진 원천에 `<link rel="preconnect" href="https://tong.visitkorea.or.kr">` 하나를 `renderPlaceHubs` 가 만드는 두 파일(`prerender/_hosts/place.1989v.com.html` · `place.1989v.com.en.html`)의 head 에만 넣는다. `crossorigin` 은 달지 않는다(img 는 no-cors 요청이라 crossorigin 연결은 재사용되지 않는다). `data-seo-multi` 도 달지 않는다(useSeo 가 지우지 않게). `index.html` 과 `compose`·`metaTags` 의 기본 출력은 바꾸지 않고, 다른 프리렌더 산출물은 바이트가 같아야 한다. SPA 폴백·지역 프리렌더·상세 SSR(`AttractionPageRenderer`)에는 넣지 않는다. 기대치는 「lazy 로 생긴 추가 지연과 연결 준비 지연을 줄이는 것」이다 — 발견 시점(JS 렌더 뒤 삽입) 자체는 이 범위에서 당기지 않는다.
2. 사진 주소 https — 규칙: 문자열이 `http://tong.visitkorea.or.kr/` 로 **시작할 때만** 앞의 `http:` 를 `https:` 로 바꾼다(포함 검사·앵커 없는 정규식 금지). null·빈 값은 그대로, 다른 호스트는 그대로. 원천 값은 덮지 않는다(표시 시점 파생).
   - 원본: FE 는 `portal-fe/src/seo/copy.mjs` 의 `secureImageUrl` 을 `placeView.ts` 가 다시 내보낸다(빌드 스크립트가 .ts 를 못 읽는 선례). Kotlin 은 `search/domain/.../attraction/model/AttractionSeoText.kt` 에 같은 이름의 함수.
   - 적용 지점(전부): `PlacePage.tsx` 카드 img(:1795)·상세 패널 img(:1678)·「뽑기」 시트 카드 render 의 data-src(:1290) / `RegionPage.tsx:248,287` / `NearbyExplore.tsx:250` / `AttractionPage.tsx` useSeo image(:165)·갤러리 출력(`galleryImages` 결과의 url — 중복 판정 키 `placeView.ts:273` 는 그대로) / `PhotoViewer.tsx:74`(갤러리 경유) / `components/favorite/FavoritesPage.tsx:87` / `components/home/ServiceShowcase.tsx:165` / `pages/search/UnifiedSearchPage.tsx:227`(통합 검색 썸네일 — 관광지 외 유형도 섞이지만 무조건 적용한다. 다른 호스트는 규칙상 그대로 지나간다) / `copy.mjs:676` JSON-LD image / SSR `AttractionPageRenderer.kt` 의 og:image·og:image:secure_url(:54 값)과 JSON-LD image(:241).
   - HTML 문자열에 넣는 곳(「뽑기」 시트 render, ServiceShowcase, Kotlin 메타)은 치환 → escape 순서다. 치환은 escape 를 대신하지 않는다.
3. `<main>` 랜드마크: 허브(`PlacePage.tsx:1467` place-body 래퍼)·상세(`AttractionPage.tsx:307`)·지역(`RegionPage.tsx:207`)의 `.place-body` 요소를 `<main>` 으로 바꾼다(헤더·푸터는 밖). SSR 은 `AttractionPageRenderer` 의 본문을 `<main>` 으로 감싸고, `shellBody` 사본 주석(:647)에 「프리렌더와 다른 점: main」을 적는다. 스타일은 바꾸지 않는다.
4. 허브 CLS: 배포 전 측정에서 Lighthouse `layout-shifts` 의 이동 노드와 점수를 먼저 기록하고, 그 노드에 맞는 대책을 고른다(카드 img 크기 속성은 4.1 이 이미 다룬다). 프리렌더 래퍼 높이는 후보 중 하나다. 쓴다면 `renderPlaceHubs`(prerender-seo.mjs:1098-1136)에서만 쓰는 래퍼나 `shellBody` 옵션 인자로 하고, 다른 프리렌더 산출물은 바이트가 같아야 한다. 효과는 SR-5.4 판정 규칙으로 보고, 효과가 없으면 되돌리고 보고한다.
5. 하지 않는 것: `manualChunks` 재구성, 서버 렌더 허브, 허브 LCP 이미지 preload·SSR 마크업(발견 시점 개선, 측정이 가리키면 후속), 상세 히어로 `<img>` SSR(상세 LCP 는 텍스트 — perf-baseline.md:41).

### SR-5 검증
1. vitest (새 파일 `PlacePage.layout.test.tsx`, `placeView.test.ts` 증보, `src/seo/__tests__/secureImageUrl.test.ts`):
   - `parseMobileLayout`: 유효 2종 / 무효 / 없음 → 기본값.
   - 목 경계: `vi.mock('../googleMaps', importOriginal)` 로 `loadGoogleMaps` 만 바꾸고 `mapsApiKey` 는 빈 값이 아닌 값을 돌려주게 한다(키가 비면 effect 가 755행에서 빠져 「미호출」이 저절로 통과한다). matchMedia 목은 쿼리 문자열마다 mql 객체를 하나 만들고, 같은 쿼리에는 같은 객체를 돌려준다(`useMediaQuery` 는 초기값과 effect 에서 두 번 부른다 — `useMediaQuery.ts:9,12`). `MOBILE_QUERY` 에만 mobile 값을 주고 나머지 쿼리는 false 다. `addEventListener('change', fn)` 은 리스너를 보관한다. 폭 전환은 그 mql 의 `matches` 를 바꾼 뒤 보관한 리스너를 `act()` 안에서 불러 일으킨다. 기존 목(`PlacePage.test.tsx:64-71`)은 호출마다 새 객체에 `vi.fn()` 리스너라 전환을 흘릴 수 없다.
   - listFirst: 지도 영역 숨김 · 「지도 보기」 전 `loadGoogleMaps` 0회, 누른 뒤 1회 · 왕복 뒤에도 1회 · 지도 상태에서 목록 숨김이 아니라 결과 패널 클래스 · 지도 상태에서 `[id^=place-card-]` 가 카드마다 한 번 · `hasMapKey` false 면 버튼 없음 · 꺼진 오버레이 칩 클릭 → 지도 상태 전환 + 필터 시트 닫힘(`queryByRole('dialog', { name: '필터' })` 가 null) · `mapsApiKey` 가 빈 값일 때(이 단언만 빈 값) 오버레이 칩 클릭 → 목록 상태 유지(지도 영역 숨김 그대로, 「지도 보기」 버튼 없음) · 폭 전환(matchMedia 변경) 뒤 `loadGoogleMaps` 재호출 없음.
   - mapSplit: 마운트 때 1회.
   - 변형을 바꿔도 `searchAttractions` 인자 동일 · 지도 보기→목록 보기 왕복 뒤 `searchAttractions` 호출 수 불변 · 전환 클릭에 `track` 0회.
   - `?layout=mapSplit` 진입 시 track 이 받은 screenRef·canonical 에 `layout` 없음.
   - `activeFilterCount`: 분류만 / 행사+상태 / 속성 2개 / geo 걸림(세지 않음) / 검색어·지역(세지 않음). 요약 줄이 같은 이름 목록인지.
   - 좁은 화면 한 줄의 분류 칩이 전체·자연·행사 셋.
   - 시트 안 속성 칩 클릭이 기존과 같은 질의·계측이고, 클릭 뒤 `document.activeElement` 가 그 칩.
   - 데스크톱(MOBILE_QUERY false)에서 `?layout` 무시.
   - 첫 카드는 사진 없음, 그 뒤로 사진 있는 카드 3장 이상인 픽스처를 쓴다(기존 `item()` 은 `imageUrl: null` — `PlacePage.test.tsx:45`). 단언: 문서 전체에서 `img[loading=eager]` 가 정확히 2개이고 그 둘이 사진 있는 앞 두 카드다. 그 둘에 fetchpriority=high 가 있다. 모든 `img.place-card-img` 에 width·height 가 있다(`div.place-card-img-empty` 는 대상이 아니다).
   - `secureImageUrl`: tong http→https · tong https 그대로 · 다른 호스트 그대로 · `http://evil/?u=http://tong.visitkorea.or.kr/` 그대로 · 대소문자 다른 호스트 그대로 · null/빈 값.
   - 렌더 단위: 허브·상세(갤러리 포함)·지역 테스트에서 `imageUrl: 'http://tong.visitkorea.or.kr/...'` 픽스처로 그린 뒤 `img[src^="http://tong."]` 와 `[data-src^="http://tong."]` 가 0개. 허브는 「뽑기」를 눌러 PickSheet 를 연 뒤 단언한다(뽑기 질의 응답도 같은 http 픽스처). card-dispenser 는 앞쪽 카드의 `data-src` 를 지우고 `style.backgroundImage` 로 옮긴다. 그래서 먼저 `https://tong.` 이 든 `.cd-photo`(data-src 또는 style.backgroundImage)가 1개 이상인지 단언하고, 이어서 `[data-src^="http://tong."]` 0개와 `style.backgroundImage` 에 `http://tong.` 이 든 `.cd-photo` 0개를 단언한다. 각 렌더 단위(허브·상세·지역)도 「https tong 이미지가 1개 이상」 전제 단언을 먼저 둔다.
   - `<main>` 이 페이지당 하나.
   - 기존 모바일 테스트(`PlacePage.test.tsx:189-204` 등)는 「필터」 시트를 열고 같은 단언을 유지한다 — `mobile=false` 로 바꿔 통과시키지 않는다. `findByRole('dialog')` 는 name 으로 좁힌다.
2. Kotest: `AttractionSeoTextTest`(BehaviorSpec)에 https 규칙. 렌더러 픽스처에 http tong 원천 사례 하나를 더하고 og:image·og:image:secure_url·JSON-LD image 가 셋 다 https 인지 단언. 골든 HTML 을 다시 만들고 diff 가 그 사례의 이미지 주소·main 태그뿐인지 확인. 패리티: `search/app/src/test/resources/render/secure-image-golden.json` 하나를 FE vitest 가 copy.mjs 함수로 쓰고 Kotlin 테스트가 읽는다(선례 jsonld-golden.json · footer-links-golden.json, CI 의 git diff 검사). `attractionJsonLdGolden` cases 에 http 원천 사례 하나를 더한다. `.github/workflows/ci.yml` 의 「Footer links golden fixture is current」 단계(:309-312) 바로 뒤에 같은 모양의 단계 「Secure image golden fixture is current」를 더한다 — `git diff --exit-code -- search/app/src/test/resources/render/secure-image-golden.json` 과 `test -z "$(git status --porcelain -- search/app/src/test/resources/render/secure-image-golden.json)"` 두 줄(처음 생긴 파일에는 diff 가 0 이라 status 줄이 필요, Q10).
3. 회귀 주입(임시 사본, 골든 테스트는 UPDATE_RENDER_GOLDEN 없이): 지도 지연 로드 제거 → 「클릭 전 미호출」 빨강 · 변형이 질의를 바꾸게 함 → 질의 동일 단언 빨강 · eager 전부 lazy → 빨강 · 카드 width/height 제거 → 빨강 · `secureImageUrl` 본문 제거(FE/Kotlin 각각) → 빨강 · 호출부 하나(갤러리)에서 `secureImageUrl` 제거 → 렌더 단위 단언 빨강 · `<main>` 제거(FE/SSR) → 빨강 · 결과 패널을 두 번째 렌더로 바꿈 → id 단일 단언 빨강. · 「뽑기」 시트 render 호출부에서 `secureImageUrl` 제거 → 렌더 단위 단언 빨강 · 골든 CI 게이트는 실제 순서로 주입한다: 임시 사본에서 `secure-image-golden.json` 한 값을 바꿔 커밋한 뒤 vitest 를 돌리고(테스트가 골든을 다시 쓴다), 이어서 CI 두 명령이 0 이 아닌 종료 코드를 내는지 본다. 주입 없이 같은 순서로 돌려 0 이 나오는 대조군을 함께 기록한다.
4. 성능 전후: 기준선과 같은 조건 — Lighthouse 13.5.0, `--throttling-method=simulate --form-factor=mobile --screenEmulation.mobile`, 실행마다 새 프로필, 실행 사이 10초, 순차, URL `/`·`/attractions/1`·`/regions/11` 각 5회. 출력은 stage2 전용 경로(`evidence/stage2/lh/{before,after}/`)이고, 메인 트리와 stage1 경로는 쓰지 않는다(lh-batch.sh 를 사본으로 고쳐 쓴다). 배포 뒤 측정 전에 운영 응답에 이번에 넣은 심볼(예: secureImageUrl 결과가 반영된 https 주소, `<main>`, 허브 head 의 tong preconnect)이 있는지와 허브 프리렌더 재생성 여부를 확인한다. 배포 전에는 빌드 산출물에서 `grep -l 'rel="preconnect" href="https://tong'` 결과가 place 허브 두 파일뿐인지 확인한다. 실행마다 `cf-cache-status` 를 기록하고, 전후 모두 측정 전 예열 요청을 1회 보낸다. 지표별 중앙값과 범위(최소~최대)를 기록하고 CLS 는 「0.1 초과 실행 수/5」도 기록한다. 판정: 배포 뒤 범위가 배포 전 범위와 겹치지 않을 때만 개선이라 하고, 겹치면 「차이 없음」. 통과 기준 — 허브: 관측 LCP 의 Resource load delay 중앙값 감소, CLS 0.1 초과 실행 수 감소, CLS 중앙값이 기준선 이하. 상세·지역: 중앙값 악화 없음(개선 목표 아님). insecure 요청은 tong 원인 0건, 그 밖은 호스트별 건수와 사유를 보고한다(Q7). LCP 요소·layout-shifts 노드를 함께 기록한다(Q2).
5. 다른 프리렌더 산출물 불변: 변경 전·후 커밋에서 각각 `npm run build` 로 dist/prerender 를 만들어 `diff -r` 하고, 차이가 place 허브 두 파일(`_hosts/place.1989v.com.html`·`.en.html`)뿐인지 확인해 결과를 남긴다.
6. 화면: CDP 로 두 변형 × 390×844 · 1440×900 캡처(배포 전 로컬 프리뷰 + 운영 API 데이터로, 같은 질의). 폴드 안 카드 수(SR-3 정의)·첫 카드 y 를 표로 남긴다. 1440×900 의 두 변형 값이 같아야 한다(데스크톱 무시 검증). 새 면(하단 고정 버튼·요약 줄·결과 패널·필터 시트)은 `docs/standards/fe-visual-verification.md` 의 기기×사이트 4조합에서 글자·배경 대비를 잰다. 폴드 표에 L 값도 적는다. listFirst 390×844 에서 지도 상태로 들어간 직후(idle 뒤) 「이 지역 검색」 버튼이 DOM 에 없는지 확인해 같은 표에 적는다. 지도→목록→지도 왕복 뒤와 넓은 화면→좁은 화면 전환 뒤 지도 bounds·줌이 결과(또는 지역 고르기면 시도 마커)를 담는지도 잰다(jsdom 은 레이아웃이 없어 단위 테스트로 못 잡는다).

## Existing Code to Leverage
`PlacePage.tsx:202(MOBILE_QUERY),354,754(loadGoogleMaps),1189-1647,1793-1798(카드 img)`, `PlacePage.css:202,295,806,817,893-901`, `KhSheet`, `RegionSheet`, `relaxConditions`(placeView.ts), `googleMaps.ts:18`, `prerender-seo.mjs:485(shellBody),1098(renderPlaceHubs)`, `AttractionPageRenderer.kt`, 테스트 `PlacePage.test.tsx:64-71(matchMedia 목)`, `googleMaps.test.ts`, 측정 `evidence/stage1/perf-baseline.md`, `placeView.ts:58-72(relaxConditions)`, `KhSheet.tsx:26-39`, `copy.mjs:676`, `AttractionPageRenderer.kt:54,145-146,241,647`, `AttractionSeoText.kt`, `jsonld-golden.json`·`attractionJsonLdGolden.test.ts:24`, `PlacePage.tsx:974(오버레이 enabled),780-788(scrollCardIntoView),930-940(fitBounds)`, `PlacePage.tsx:1290(뽑기 render),1364-1370(오버레이 칩),1619-1620(키 없음 placeholder),1800(사진 없는 카드)`, `useMediaQuery.ts:8-19`, `UnifiedSearchPage.tsx:227`, `SearchUnifiedService.kt:75`, `.github/workflows/ci.yml:303-312`, `card-dispenser`(data-src → backgroundImage 처리).

## Out of Scope
데스크톱 레이아웃 변경, 번들 재구성, 서버 렌더 허브, 허브 LCP 이미지 preload·SSR 마크업, 상세 히어로 `<img>` SSR, 적재 시 사진 주소 정규화(스키마 변경 없음), 「지도 보기/목록 보기」 전환 계측(Q3), RUM(실사용자 성능).
