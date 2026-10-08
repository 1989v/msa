# Review Verdict — place 모바일 허브 변형 + 성능 스펙 1라운드

**결론: 발견 33건 중 기각은 없습니다. 32건은 그대로 두고 1건은 MINOR 로 내립니다.** 모든 발견의 `file:line` 을 워크트리에서 직접 열어 보았고, 원문이 발견 내용과 다른 곳은 없었습니다. BLOCK 이 걸린 발견은 처음부터 없었고, 근거 없이 올린 등급도 없습니다.

대상: `/private/tmp/claude-501/-Users-gideok-kwon-IdeaProjects-msa/d594f57c-5e92-42e8-b77f-50048d63c825/scratchpad/wt-impl/docs/specs/2026-10-09-place-hub-mobile-perf/spec.md`

## 1. 묶음 표 (중복은 하나로 묶음)

| 묶음 | 포함 발견 | 판정 | 직접 확인한 핵심 근거 |
|---|---|---|---|
| G1 「지도 보기」 계측을 MAP_LINK 규약으로 보냄 | A-3, D-2, I-4, U-1, T3(SR-1.6 행) | keep REVISE | 계측 스펙 `:43` MAP_LINK 는 관광지 id 가 붙는 구글맵 링크. `:87` 「선택당 지도 열기」 분자로 쓰임. `PlacePage.tsx:1713-1718` |
| G2 지연 로드와 지도 effect 가 맞지 않음, 목 경계 | A-2(①②), I-1, T4(목 경계) | keep REVISE | `PlacePage.tsx:755` `if (!hasMapKey \|\| mapRef.current \|\| !mapDivRef.current) return;` · `:777` `}, [hasMapKey]);` · `:934` 모바일 첫 페이지에서 fitBounds |
| G3 결과 시트에 KhSheet 를 쓰거나 목록을 두 번 그림 | D-3, I-2, T3(시트 행) | keep REVISE | `KhSheet.tsx:30` `document.body.style.overflow = 'hidden'` · `:63` `aria-modal="true"` · `PlacePage.tsx:1749` useImpression |
| G4 listFirst 의 대안·예외 흐름이 없음 | A-2(③), U-4 | keep REVISE | `PlacePage.tsx:974` `enabled: overlay != null && mapView != null` · `:780-787` scrollCardIntoView |
| G5 「필터 N」에 geo 를 넣을지 정해지지 않음 | A-5, D-5, I-5(후반), U-5 | keep REVISE | `placeView.ts:71` `if (s.geo) out.push({ kind: 'geo', ... })` |
| G6 「관광지」 칩에 맞는 분류가 없음 | I-5(전반), D-4 | I-5 keep REVISE / D-4 demote MINOR | `placeApi.ts:332` `SIGHT_CATEGORIES = ['nature','history','culture','leisure']` · `PlacePage.tsx:379` null 이 관광 분류 전체 |
| G7 https 적용 대상이 틀리거나 빠짐, 원본 위치·패리티 | A-1, I-6, SEC REVISE-1(1), T2(c), U-2(④) | keep REVISE | 렌더러에 `<img` 없음(골든 9개 모두 0건). `AttractionPageRenderer.kt:146` secure_url 에 원천 값. `copy.mjs:676` `json.image = attraction.imageUrl` |
| G8 https 규칙 형태(앞부분 일치)와 escape 순서 | SEC REVISE-1(2·3) | keep REVISE | `PlacePage.tsx:1290` `data-src="${escapeHtml(a.thumbnailUrl ?? a.imageUrl ?? '')}"` |
| G9 https 회귀를 넣어도 테스트가 빨개지지 않음 | I-7, T1, T2(a·b), SEC REVISE-1(4) | keep REVISE | `AttractionPageFixtures.kt:63` · `jsonld-golden.json:14` 가 이미 https. 골든의 `http://tong` 0건 |
| G10 shellBody 는 모든 프리렌더가 함께 쓰는 함수 | A-4, I-8(shellBody) | keep REVISE | `prerender-seo.mjs:485` 정의, 호출 13곳, 허브는 `:1128` 한 곳 |
| G11 프리렌더 최소 높이로는 교체 CLS 를 줄이기 어려움 | I-8(CLS) | keep REVISE | `main.tsx:31` createRoot. `perf-baseline.md:42` 「CLS 0.74 … 별도 확인 대상」 |
| G12 eager·fetchpriority 만으로는 늦은 발견이 안 풀림 | I-8(LCP) | keep REVISE | `perf-baseline.md:42` 「이미지가 늦게 발견된다(JS 렌더 뒤 삽입)… preload·SSR 마크업」 |
| G13 계획서 S2-5 와 다름(적재 시 치환, insecure 0, 히어로 SSR) | U-2(①②③) | keep REVISE | 계획서 `:83` 「사진 https 치환(적재 시)」 「insecure requests 0」 |
| G14 1440×900 첫 카드 y≤320 을 아직 안 잼 | U-3 | keep REVISE | stage2 증거에 1440 측정 없음(grep 0건), 데스크톱 변경은 Out of Scope |
| G15 필터 시트 onClose 가 매번 바뀌어 포커스가 튐 | I-3 | keep REVISE | `KhSheet.tsx:27` `panelRef.current?.focus()` · `:39` `}, [onClose]);` · `PlacePage.tsx:1641` 인라인 화살표 함수 |
| G16 기존 모바일 테스트가 필터 압축과 충돌 | T5 | keep REVISE | `PlacePage.test.tsx:200` 모바일에서 `chip(/^주차 가능/)` 을 바로 누름. `:66-67` matchMedia 목이 모든 쿼리에 같은 값을 돌려줌 |
| G17 성능 측정 조건·출력 경로·번들 최신 확인 | T6 | keep REVISE | `scratchpad/lh-batch.sh:4` `ROOT="/Users/gideok-kwon/IdeaProjects/msa/docs/.../stage1/lh"`(메인 트리) |
| G18 중앙값만으로는 CLS 튐을 판정 못 함, 통과 기준 없음 | T7, U-2(⑤) | keep REVISE | `perf-baseline.md:36` 허브 CLS 중앙값 0.05, 0.74 는 5회 중 2회(`:20,:24`) |
| G19 요구는 있는데 테스트가 없음 | T3(나머지 행), T4(eager 를 문서 전체로 셈) | keep REVISE | SR-5.1 에 SR-1.5·SR-1.2·SR-4.1 width/height 단언이 없음 |
| G20 화면 측정 조건·파일 이름 | T8 | keep MINOR | `test-rules.md:17` 「테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix」 |
| G21 38vh 두 단계, `<main>` 위치, Kotlin shellBody 사본 | I-9 | keep MINOR | `PlacePage.css:806`(16rem) · `:900`(42vh) · `PlacePage.tsx:1190` `.place-page` 가 헤더·푸터까지 감쌈 · `AttractionPageRenderer.kt:647` |
| G22 place 용어집이 없음 | D-1 | keep MINOR | `docs/context-map.md` 에 place 행 없음(grep 0건). 리뷰어가 차단 사유 아님이라고 밝힘 |

## 2. 발견별 JSON

```json
[
  {"id":"A-1","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/seo/copy.mjs","line":676,"quote":"if (attraction.imageUrl) json.image = attraction.imageUrl;"},{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":36,"quote":"규칙의 원본은 `portal-fe/src/seo/copy.mjs` 다"}],"reason":"FE·SSR 이 같이 쓰는 규칙의 원본은 copy.mjs 라는 선례가 있는데 스펙에 원본 위치와 og:image 가 빠져 있다."},
  {"id":"A-2","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":777,"quote":"}, [hasMapKey]);"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":974,"quote":"enabled: overlay != null && mapView != null,"}],"reason":"effect 의존 배열과 오버레이 활성 조건을 원문으로 확인했다. 생명주기가 정의되지 않았다."},
  {"id":"A-3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-hub-instrumentation/spec.md","line":43,"quote":"대상 `ATTRACTION` / 관광지 id ... 섹션 `MAP_LINK`, payload `kind: google_maps_search`"}],"reason":"기존 규약은 관광지 단위라 대상 없는 토글에 적용할 수 없다."},
  {"id":"A-4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/scripts/prerender-seo.mjs","line":485,"quote":"function shellBody(inner) {"}],"reason":"정의 1곳에 호출 13곳이다. 허브만 고치려면 범위를 한정해야 한다."},
  {"id":"A-5","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/placeView.ts","line":71,"quote":"if (s.geo) out.push({ kind: 'geo', radiusKm: s.geo.radiusKm });"}],"reason":"relaxConditions 가 geo 도 내므로 N 의 정의가 열려 있다."},
  {"id":"D-1","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/context-map.md","line":0,"quote":"(place 행 없음 — grep 'place' 0건)"}],"reason":"사실로 확인했다. 리뷰어 스스로 비차단 후속 작업으로 분류했다."},
  {"id":"D-2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/adr/ADR-0095-impression-click-pipeline.md","line":130,"quote":"선택 뒤 후속 행동인 `MAP_LINK`(지도 열기)·`FAVORITE`(찜) 섹션은 `POST_SELECTION_SECTIONS` 로 제외한다."}],"reason":"G1 과 같다. 「지도 열기」의 정의가 ADR 에 고정돼 있다."},
  {"id":"D-3","verdict":"keep","severity":"REVISE","evidence":[{"file":"DESIGN.md","line":330,"quote":"`KhSheet` | 바텀시트 — 먹빛 veil, 비대칭 귀, 드래그 닫기. 모바일의 다이얼로그 대체"}],"reason":"KhSheet 는 모달이다. 비모달 결과 패널과 이름이 섞이면 잘못 재사용할 수 있다."},
  {"id":"D-4","verdict":"demote","severity":"MINOR","evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":80,"quote":"홈 필터 압축(지역 1 + 핵심 테마 + 「필터 N」 + 선택 조건 요약)"}],"reason":"ⓐ 입력 표준인 계획서가 「핵심 테마」를 쓰는 용어라 표기 문제는 MINOR 로 내린다. 실질 문제(관광지 칩 없음)는 I-5 가 덮는다."},
  {"id":"D-5","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/placeView.ts","line":71,"quote":"if (s.geo) out.push({ kind: 'geo', radiusKm: s.geo.radiusKm });"}],"reason":"G5 와 같다."},
  {"id":"I-1","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":755,"quote":"if (!hasMapKey || mapRef.current || !mapDivRef.current) return;"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":934,"quote":"if (!isMobile || page === 0) {"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":367,"quote":"const hasMapKey = mapsApiKey() !== '';"}],"reason":"CSS 로 숨기면 마운트 때 로드되고, 조건부로 렌더하면 effect 가 다시 돌지 않는다. 숨긴 지도에도 fitBounds 가 돈다. 키가 비면 단언이 저절로 통과한다는 점도 맞다."},
  {"id":"I-2","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/components/shell/KhSheet.tsx","line":63,"quote":"aria-modal=\"true\""},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1749,"quote":"const impressionRef = useImpression<HTMLAnchorElement>("}],"reason":"모달이 지도 조작을 막는다. 목록을 두 번 그리면 노출과 id 가 중복된다."},
  {"id":"I-3","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/components/shell/KhSheet.tsx","line":39,"quote":"}, [onClose]);"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1641,"quote":"<KhSheet label={L.attractionLabel} onClose={() => setSelectedId(null)}>"}],"reason":"effect 가 다시 돌 때마다 panel.focus() 를 한다. 인라인 onClose 를 그대로 쓰면 칩을 누를 때마다 포커스가 튄다."},
  {"id":"I-4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1717,"quote":"sectionId: 'MAP_LINK',"}],"reason":"G1 과 같다."},
  {"id":"I-5","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/api/placeApi.ts","line":332,"quote":"export const SIGHT_CATEGORIES = ['nature', 'history', 'culture', 'leisure'] as const;"}],"reason":"「관광지」 분류 값이 없어 「전체」와 구분되지 않는다. N 의 geo 처리도 열려 있다."},
  {"id":"I-6","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":146,"quote":"lines += \"\"\"<meta property=\"og:image:secure_url\" content=\"$src\" />\"\"\""},{"file":"search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt","line":113,"quote":"<body><div id=\"root\">$body</div></body>"}],"reason":"SSR 에는 <img> 가 없다(grep 0건). og:image·secure_url 이 빠졌다."},
  {"id":"I-7","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageFixtures.kt","line":63,"quote":"imageUrl = \"https://tong.visitkorea.or.kr/cms/resource/33/1.jpg\","}],"reason":"픽스처가 이미 https 라 치환을 지워도 골든이 초록이다."},
  {"id":"I-8","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/main.tsx","line":31,"quote":"createRoot(document.getElementById('root')!).render("},{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/perf-baseline.md","line":42,"quote":"이미지가 늦게 발견된다(JS 렌더 뒤 삽입). ... 조기 발견(preload·SSR 마크업)이 실제 지렛대"}],"reason":"반증할 실측이 없다. 기준선 문서도 원인 미확정과 조기 발견 지렛대를 같은 취지로 적고 있다."},
  {"id":"I-9","verdict":"keep","severity":"MINOR","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.css","line":900,"quote":"height: 42vh;"},{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":1190,"quote":"<div className=\"place-page\">"}],"reason":"38vh 를 어느 단계에 적용할지와 <main> 위치가 모호하다는 지적이 원문과 일치한다."},
  {"id":"SEC-REVISE-1","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/placeView.ts","line":273,"quote":"const keyOf = (url: string) => url.replace(/^https?:/, '');"},{"file":"portal-fe/src/pages/place/PhotoViewer.tsx","line":74,"quote":"<img className=\"place-photo-viewer-img\" src={image.url} ..."}],"reason":"갤러리·뷰어·지역·근처 경로가 원천 주소를 그대로 출력한다. 앞부분 일치 규칙과 escape 순서도 정해지지 않았다."},
  {"id":"T1","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/RegionPage.tsx","line":248,"quote":"<img className=\"place-card-img\" src={a.imageUrl} alt=\"\" loading=\"lazy\" />"}],"reason":"함수 테스트만으로는 호출부 하나가 빠지는 회귀를 못 잡는다."},
  {"id":"T2","verdict":"keep","severity":"REVISE","evidence":[{"file":"search/app/src/test/kotlin/com/kgd/search/infrastructure/render/AttractionPageRendererTest.kt","line":570,"quote":"val update = System.getenv(\"UPDATE_RENDER_GOLDEN\") == \"1\""}],"reason":"골든에 http·img 가 0건이다. 플래그를 켜고 돌리면 회귀 주입이 늘 초록이 된다."},
  {"id":"T3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-09-place-hub-mobile-perf/spec.md","line":40,"quote":"vitest: 쿼리 `layout` 파싱 ... `<main>` 이 페이지당 하나."}],"reason":"SR-1.5·1.2·4.1·2.1·1.3 에 대응하는 단언이 목록에 없다."},
  {"id":"T4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/__tests__/PlacePage.test.tsx","line":7,"quote":"vi.mock('../../../api/placeApi', async (importOriginal) => ({"}],"reason":"googleMaps 는 목이 아니다(PlacePage*.test 에서 grep 0건). 목 경계가 정해지지 않았다."},
  {"id":"T5","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/__tests__/PlacePage.test.tsx","line":200,"quote":"fireEvent.click(chip(/^주차 가능/));"},{"file":"portal-fe/src/pages/place/__tests__/PlacePage.test.tsx","line":67,"quote":"matches: mobile,"}],"reason":"속성 칩이 시트 안으로 들어가면 기존 테스트가 깨진다. 갱신 방침이 없다."},
  {"id":"T6","verdict":"keep","severity":"REVISE","evidence":[{"file":"scratchpad/lh-batch.sh","line":4,"quote":"ROOT=\"/Users/gideok-kwon/IdeaProjects/msa/docs/research/.../evidence/stage1/lh\""}],"reason":"선례 스크립트를 그대로 쓰면 메인 트리의 1단계 원본을 덮어쓴다."},
  {"id":"T7","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/research/2026-10-07-tourism-growth/evidence/stage1/perf-baseline.md","line":36,"quote":"| hub | https://place.1989v.com/ | 58 | 21.9s | 5.0s | 0.05 | ..."}],"reason":"기준선 CLS 중앙값이 0.05 라 중앙값만 비교하면 0.74 튐을 판정할 수 없다."},
  {"id":"T8","verdict":"keep","severity":"MINOR","evidence":[{"file":"docs/standards/test-rules.md","line":17,"quote":"테스트 파일 이름: 구현체와 동일 이름 + `Test` suffix"}],"reason":"리뷰어 스스로 경미로 분류했다. 측정 조건과 파일 이름을 적으라는 요구다."},
  {"id":"U-1","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/specs/2026-10-08-place-hub-instrumentation/spec.md","line":120,"quote":"오버레이 토글 자체 — 지도 레이어이지 목록 질의가 아니다."}],"reason":"G1 과 같다. 계측 스펙이 지도 레이어 조작을 범위 밖에 둔 선례가 있다."},
  {"id":"U-2","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":83,"quote":"사진 https 치환(적재 시) ... insecure requests 0"}],"reason":"계획서 완료 조건과 다르게 적혀 있는데 스펙이 그것을 편차로 밝히지 않았다."},
  {"id":"U-3","verdict":"keep","severity":"REVISE","evidence":[{"file":"docs/plans/2026-10-08-place-growth-work-plan.md","line":81,"quote":"1440×900 첫 카드 y≤320px"}],"reason":"현재 값을 잰 기록이 없다. 데스크톱 변경은 금지돼 있어 못 맞출 때 할 일이 정해지지 않았다."},
  {"id":"U-4","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/PlacePage.tsx","line":781,"quote":"setListOpen(true); // 접힌 목록(데스크톱)으로는 안내할 수 없다"}],"reason":"오버레이·클러스터 안내·키 없음 등 대안 흐름이 코드상 실제로 갈린다."},
  {"id":"U-5","verdict":"keep","severity":"REVISE","evidence":[{"file":"portal-fe/src/pages/place/placeView.ts","line":71,"quote":"if (s.geo) out.push({ kind: 'geo', radiusKm: s.geo.radiusKm });"}],"reason":"G5 와 같다. N 과 요약 줄에 들어가는 항목이 서로 다르다."}
]
```

## 3. spec.md 편집 목록 (구현자가 그대로 따르도록)

**E-1 (4행 머리말)**
- 바꿀 문장: `ADR 불요(구성·화면 변경, 의존·스키마 변경 없음).`
- 새 문장: `ADR 불요(구성·화면 변경, 의존·스키마 변경 없음). 계획서 S2-5 와 다른 점 두 가지 — ① https 치환은 적재 시가 아니라 표시 시점이다(스키마 변경 없이 원천 보존) ② insecure 완료 조건은 SR-5.4 의 기준을 따른다. 같은 내용을 계획서 S2-5 행 비고에 한 줄 더한다.`

**E-2 (Goal 7행)**
- 바꿀 문장: `LCP 이미지 늦은 발견·지도 선로드·http 사진·랜드마크`
- 새 문장: `LCP 이미지의 lazy 추가 지연과 연결 준비 지연·지도 선로드·http 사진·랜드마크`

**E-3 SR-1 전체를 아래로 교체**

```text
### SR-1 모바일 두 배치 변형 (S2-3a)
1. 배치 변형 값은 `listFirst`(ⓐ 목록 기본 + 지도 전환)와 `mapSplit`(ⓑ 지도 상시 + 목록). 좁은 화면(`MOBILE_QUERY`, ≤899.98px)에서만 갈린다 — 데스크톱 레이아웃은 바꾸지 않는다. 배치 변형은 실험 배정(experiment Variant)이 아니다.
2. 고르는 법: 순수 함수 `parseMobileLayout(search: string): MobileLayout` 을 `placeView.ts` 에 둔다. 쿼리 `layout` 이 정확히 `listFirst`·`mapSplit` 이면 그 값, 없거나 그 밖이면 `DEFAULT_MOBILE_LAYOUT`. 화면은 파싱된 값만 쓰고 쿼리 원문을 className·DOM 에 넣지 않는다. `layout` 은 canonical·프리렌더·계측 주소(screenRef 포함)에 넣지 않는다.
3. 지도 요청 상태 `mapRequested`: 데스크톱·`mapSplit` 은 처음부터 true, `listFirst` 는 「지도 보기」를 처음 누를 때 true 가 되고 다시 false 로 돌아가지 않는다. 지도 초기화 effect(`PlacePage.tsx:754-777`)의 반환 조건에 `!mapRequested` 를 더하고 의존 배열을 `[hasMapKey, mapRequested]` 로 바꾼다. 지도 div(`mapDivRef`)는 늘 마운트하고 CSS 로만 숨긴다 — 언마운트하지 않는다.
4. `listFirst` 목록 상태: 목록이 툴바 바로 아래, 지도 영역은 숨김. 화면 하단 고정 버튼 「지도 보기 / Map」. `hasMapKey` 가 false 면 버튼을 그리지 않는다.
5. `listFirst` 지도 상태: 지도가 툴바 아래 남은 높이를 다 쓰고, 결과는 지도 위 하단 「결과 패널」로 보인다. 결과 패널은 같은 `.place-list-col` 을 지도 상태 클래스로 하단에 배치한 것이다 — `KhSheet` 가 아니며(비모달: veil·body 스크롤 잠금·포커스 가둠 없음) 목록을 두 번 그리지 않는다. 접힌 높이는 카드 1장이고 패널 안 세로 스크롤로 나머지를 본다. 같은 하단 버튼이 「목록 보기 / List」로 바뀐다. 지도 상태로 들어간 직후 현재 결과로 fitBounds 를 한 번 다시 하고(idle 뒤 SIDO 줌 상한 규칙 유지), 목록 상태에서는 결과가 바뀌어도 숨긴 지도에 fitBounds 를 하지 않는다.
6. `listFirst` 대안 흐름:
   - 지도 오버레이 칩(필터 시트 안): 목록 상태에서 누르면 오버레이를 켜고 지도 상태로 전환한다(오버레이 질의는 mapView 가 필요 — `PlacePage.tsx:974`).
   - 클러스터 최대 줌 안내: 결과 패널 안 같은 `place-card-{id}` 로 스크롤한다.
   - 지도 상태에서 핀 선택: 지금처럼 상세 `KhSheet` 가 결과 패널 위에 뜨고, 닫으면 지도 상태 그대로.
   - 지역 고르기(`pickingRegion`): 지도 상태면 시도 마커를 그리고, 결과 패널은 지금 목록 칸 내용을 그대로 보여준다.
   - 화면 폭 전환: 넓은 화면으로 가면 `mapRequested` = true. 다시 좁아지면 목록/지도 상태는 전환 전 값을 유지한다. `loadGoogleMaps` 는 세션에서 한 번만 부른다.
   - 무한 스크롤 센티널: 결과 패널 스크롤 컨테이너 안에 두어 패널 끝에서 발화한다.
   - 「목록 보기」 복귀: 같은 DOM 이므로 스크롤 위치·selectedId 를 유지한다.
7. `mapSplit`: 지도 높이 38vh — 지금의 두 단계(641~899px `min-height:16rem`, ≤640px `height:42vh`)를 둘 다 38vh 로 맞춘다. 목록은 아래. 지도는 마운트 때 로드(지금과 같음).
8. 두 변형은 같은 질의·데이터·카드 컴포넌트를 쓴다. 변형 선택과 지도 전환은 질의(`query` 메모)·계측 trigger 를 바꾸지 않고 SEARCH 를 내지 않는다.
9. 계측: 「지도 보기 / 목록 보기」 전환은 계측하지 않는다(track 미호출). 「지도 열기」는 관광지 하나의 구글맵 링크(MAP_LINK, 계측 스펙 43행)를 뜻하고, 대상 없는 전환을 그 규약으로 보내면 「선택당 지도 열기」 비율이 오염된다. 지도 상태에서 생긴 핀 CLICK·「이 지역 검색」 SEARCH 는 계측 스펙 그대로. 전환을 세는 일은 open-questions Q3(후속)로 둔다.
```

**E-4 SR-2 전체를 아래로 교체**

```text
### SR-2 홈 필터 압축 (두 변형 공통)
1. 좁은 화면 툴바 아래 한 줄: 지역 트리거(`RegionSheet`) 1개 + 핵심 분류 칩 3개(전체=category null · 자연=nature · 행사=event, 두 언어 공통 — Q4) + 「필터 N」 버튼 + 선택 조건 요약 한 줄(넘치면 말줄임).
2. N 은 `placeView.ts` 의 순수 함수 `activeFilterCount(s: HubFilterState)` 로 구한다 = `relaxConditions(s)` 결과 중 kind 가 `category`·`eventStatus`·`attribute` 인 것의 수. `keyword`·`region`·`geo` 는 세지 않고, 지도 오버레이는 조건이 아니라 세지 않는다(Q5). N=0 이면 버튼 문구는 「필터 / Filters」.
3. 요약 줄은 N 에 센 조건과 같은 목록의 이름(분류 이름·행사 상태 이름·속성 이름)을 「 · 」로 잇는다. N=0 이면 요약 줄을 그리지 않는다.
4. 「필터 N」은 `KhSheet` 를 연다(label 「필터 / Filters」). 안에는 지금의 분류 칩 전부·행사 상태·속성 칩·지도 오버레이 칩을 지금과 같은 컴포넌트·핸들러·계측으로 둔다. `onClose` 는 `useCallback` 으로 고정한다(KhSheet effect 가 `[onClose]` 에 의존해 다시 돌 때마다 패널로 포커스를 옮긴다).
5. 데스크톱은 지금 칩 배치 그대로.
```

**E-5 SR-3 끝에 덧붙일 문장**
`사전 측정: 구현 전 운영 1440×900 의 현재 첫 카드 y 를 CDP 로 재 evidence 에 남긴다. 데스크톱은 바꾸지 않으므로(Out of Scope) 320 을 넘으면 실측 값과 겹쳐 쌓인 요소 목록을 보고하고 완료 조건 미충족으로 표시한다(Q6). 「폴드 안 카드」는 getBoundingClientRect().top ≥ 0 이고 bottom ≤ 664 인 .place-card 의 수다.`

**E-6 SR-4 전체를 아래로 교체**

```text
### SR-4 성능 (S2-5)
1. 허브 카드 이미지: 문서 전체에서 목록의 처음 2장만 `loading="eager"` + `fetchpriority="high"`, 나머지는 lazy. 모든 카드 `<img>` 에 `width="88" height="88"`(CSS 88px 정사각과 같은 비율). 사진 원천 `https://tong.visitkorea.or.kr` 에 `<link rel="preconnect">` 를 place 셸 head 에 하나 둔다. 기대치는 「lazy 로 생긴 추가 지연과 연결 준비 지연을 줄이는 것」이다 — 발견 시점(JS 렌더 뒤 삽입) 자체는 이 범위에서 당기지 않는다.
2. 사진 주소 https — 규칙: 문자열이 `http://tong.visitkorea.or.kr/` 로 **시작할 때만** 앞의 `http:` 를 `https:` 로 바꾼다(포함 검사·앵커 없는 정규식 금지). null·빈 값은 그대로, 다른 호스트는 그대로. 원천 값은 덮지 않는다(표시 시점 파생).
   - 원본: FE 는 `portal-fe/src/seo/copy.mjs` 의 `secureImageUrl` 을 `placeView.ts` 가 다시 내보낸다(빌드 스크립트가 .ts 를 못 읽는 선례). Kotlin 은 `search/domain/.../attraction/model/AttractionSeoText.kt` 에 같은 이름의 함수.
   - 적용 지점(전부): `PlacePage.tsx` 카드 img(:1795)·상세 패널 img(:1678)·InfoWindow data-src(:1290) / `RegionPage.tsx:248,287` / `NearbyExplore.tsx:250` / `AttractionPage.tsx` useSeo image(:165)·갤러리 출력(`galleryImages` 결과의 url — 중복 판정 키 `placeView.ts:273` 는 그대로) / `PhotoViewer.tsx:74`(갤러리 경유) / `components/favorite/FavoritesPage.tsx:87` / `components/home/ServiceShowcase.tsx:165` / `copy.mjs:676` JSON-LD image / SSR `AttractionPageRenderer.kt` 의 og:image·og:image:secure_url(:54 값)과 JSON-LD image(:241).
   - HTML 문자열에 넣는 곳(InfoWindow, ServiceShowcase, Kotlin 메타)은 치환 → escape 순서다. 치환은 escape 를 대신하지 않는다.
3. `<main>` 랜드마크: 허브(`PlacePage.tsx:1467` place-body 래퍼)·상세(`AttractionPage.tsx:307`)·지역(`RegionPage.tsx:207`)의 `.place-body` 요소를 `<main>` 으로 바꾼다(헤더·푸터는 밖). SSR 은 `AttractionPageRenderer` 의 본문을 `<main>` 으로 감싸고, `shellBody` 사본 주석(:647)에 「프리렌더와 다른 점: main」을 적는다. 스타일은 바꾸지 않는다.
4. 허브 CLS: 배포 전 측정에서 Lighthouse `layout-shifts` 의 이동 노드와 점수를 먼저 기록하고, 그 노드에 맞는 대책을 고른다(카드 img 크기 속성은 4.1 이 이미 다룬다). 프리렌더 래퍼 높이는 후보 중 하나다. 쓴다면 `renderPlaceHubs`(prerender-seo.mjs:1098-1136)에서만 쓰는 래퍼나 `shellBody` 옵션 인자로 하고, 다른 프리렌더 산출물은 바이트가 같아야 한다. 효과는 SR-5.4 판정 규칙으로 보고, 효과가 없으면 되돌리고 보고한다.
5. 하지 않는 것: `manualChunks` 재구성, 서버 렌더 허브, 허브 LCP 이미지 preload·SSR 마크업(발견 시점 개선, 측정이 가리키면 후속), 상세 히어로 `<img>` SSR(상세 LCP 는 텍스트 — perf-baseline.md:41).
```

**E-7 SR-5 전체를 아래로 교체**

```text
### SR-5 검증
1. vitest (새 파일 `PlacePage.layout.test.tsx`, `placeView.test.ts` 증보, `src/seo/__tests__/secureImageUrl.test.ts`):
   - `parseMobileLayout`: 유효 2종 / 무효 / 없음 → 기본값.
   - 목 경계: `vi.mock('../googleMaps', importOriginal)` 로 `loadGoogleMaps` 만 바꾸고 `mapsApiKey` 는 빈 값이 아닌 값을 돌려주게 한다(키가 비면 effect 가 755행에서 빠져 「미호출」이 저절로 통과한다). matchMedia 목은 `MOBILE_QUERY` 에만 mobile 값을 돌려주고 나머지 쿼리는 false.
   - listFirst: 지도 영역 숨김 · 「지도 보기」 전 `loadGoogleMaps` 0회, 누른 뒤 1회 · 왕복 뒤에도 1회 · 지도 상태에서 목록 숨김이 아니라 결과 패널 클래스 · 지도 상태에서 `[id^=place-card-]` 가 카드마다 한 번 · `hasMapKey` false 면 버튼 없음 · 오버레이 칩 → 지도 상태 전환 · 폭 전환(matchMedia 변경) 뒤 `loadGoogleMaps` 재호출 없음.
   - mapSplit: 마운트 때 1회.
   - 변형을 바꿔도 `searchAttractions` 인자 동일 · 지도 보기→목록 보기 왕복 뒤 `searchAttractions` 호출 수 불변 · 전환 클릭에 `track` 0회.
   - `?layout=mapSplit` 진입 시 track 이 받은 screenRef·canonical 에 `layout` 없음.
   - `activeFilterCount`: 분류만 / 행사+상태 / 속성 2개 / geo 걸림(세지 않음) / 검색어·지역(세지 않음). 요약 줄이 같은 이름 목록인지.
   - 좁은 화면 한 줄의 분류 칩이 전체·자연·행사 셋.
   - 시트 안 속성 칩 클릭이 기존과 같은 질의·계측이고, 클릭 뒤 `document.activeElement` 가 그 칩.
   - 데스크톱(MOBILE_QUERY false)에서 `?layout` 무시.
   - 문서 전체에서 `img[loading=eager]` 정확히 2개, 그 둘에 fetchpriority=high, 모든 `.place-card-img` 에 width·height.
   - `secureImageUrl`: tong http→https · tong https 그대로 · 다른 호스트 그대로 · `http://evil/?u=http://tong.visitkorea.or.kr/` 그대로 · 대소문자 다른 호스트 그대로 · null/빈 값.
   - 렌더 단위: 허브·상세(갤러리 포함)·지역 테스트에서 `imageUrl: 'http://tong.visitkorea.or.kr/...'` 픽스처로 그린 뒤 `img[src^="http://tong."]` 와 `[data-src^="http://tong."]` 가 0개.
   - `<main>` 이 페이지당 하나.
   - 기존 모바일 테스트(`PlacePage.test.tsx:189-204` 등)는 「필터」 시트를 열고 같은 단언을 유지한다 — `mobile=false` 로 바꿔 통과시키지 않는다. `findByRole('dialog')` 는 name 으로 좁힌다.
2. Kotest: `AttractionSeoTextTest`(BehaviorSpec)에 https 규칙. 렌더러 픽스처에 http tong 원천 사례 하나를 더하고 og:image·og:image:secure_url·JSON-LD image 가 셋 다 https 인지 단언. 골든 HTML 을 다시 만들고 diff 가 그 사례의 이미지 주소·main 태그뿐인지 확인. 패리티: `search/app/src/test/resources/render/secure-image-golden.json` 하나를 FE vitest 가 copy.mjs 함수로 쓰고 Kotlin 테스트가 읽는다(선례 jsonld-golden.json · footer-links-golden.json, CI 의 git diff 검사). `attractionJsonLdGolden` cases 에 http 원천 사례 하나를 더한다.
3. 회귀 주입(임시 사본, 골든 테스트는 UPDATE_RENDER_GOLDEN 없이): 지도 지연 로드 제거 → 「클릭 전 미호출」 빨강 · 변형이 질의를 바꾸게 함 → 질의 동일 단언 빨강 · eager 전부 lazy → 빨강 · 카드 width/height 제거 → 빨강 · `secureImageUrl` 본문 제거(FE/Kotlin 각각) → 빨강 · 호출부 하나(갤러리)에서 `secureImageUrl` 제거 → 렌더 단위 단언 빨강 · `<main>` 제거(FE/SSR) → 빨강 · 결과 패널을 두 번째 렌더로 바꿈 → id 단일 단언 빨강.
4. 성능 전후: 기준선과 같은 조건 — Lighthouse 13.5.0, `--throttling-method=simulate --form-factor=mobile --screenEmulation.mobile`, 실행마다 새 프로필, 실행 사이 10초, 순차, URL `/`·`/attractions/1`·`/regions/11` 각 5회. 출력은 stage2 전용 경로(`evidence/stage2/lh/{before,after}/`)이고, 메인 트리와 stage1 경로는 쓰지 않는다(lh-batch.sh 를 사본으로 고쳐 쓴다). 배포 뒤 측정 전에 운영 응답에 이번에 넣은 심볼(예: secureImageUrl 결과가 반영된 https 주소, `<main>`)이 있는지와 허브 프리렌더 재생성 여부를 확인한다. 실행마다 `cf-cache-status` 를 기록하고, 전후 모두 측정 전 예열 요청을 1회 보낸다. 지표별 중앙값과 범위(최소~최대)를 기록하고 CLS 는 「0.1 초과 실행 수/5」도 기록한다. 판정: 배포 뒤 범위가 배포 전 범위와 겹치지 않을 때만 개선이라 하고, 겹치면 「차이 없음」. 통과 기준 — 허브: 관측 LCP 의 Resource load delay 중앙값 감소, CLS 0.1 초과 실행 수 감소, CLS 중앙값이 기준선 이하. 상세·지역: 중앙값 악화 없음(개선 목표 아님). insecure 요청은 tong 원인 0건, 그 밖은 호스트별 건수와 사유를 보고한다(Q7). LCP 요소·layout-shifts 노드를 함께 기록한다(Q2).
5. 화면: CDP 로 두 변형 × 390×844 · 1440×900 캡처(배포 전 로컬 프리뷰 + 운영 API 데이터로, 같은 질의). 폴드 안 카드 수(SR-3 정의)·첫 카드 y 를 표로 남긴다. 1440×900 의 두 변형 값이 같아야 한다(데스크톱 무시 검증).
```

**E-8 Out of Scope 교체**
`데스크톱 레이아웃 변경, 번들 재구성, 서버 렌더 허브, 허브 LCP 이미지 preload·SSR 마크업, 상세 히어로 <img> SSR, 적재 시 사진 주소 정규화(원천 보존·스키마 변경 없음), 「지도 보기/목록 보기」 전환 계측(Q3), RUM(실사용자 성능).`

**E-9 Existing Code 에 덧붙일 것**
`placeView.ts:58-72(relaxConditions)`, `KhSheet.tsx:26-39`, `copy.mjs:676`, `AttractionPageRenderer.kt:54,145-146,241,647`, `AttractionSeoText.kt`, `jsonld-golden.json`·`attractionJsonLdGolden.test.ts:24`, `PlacePage.tsx:974(오버레이 enabled),780-788(scrollCardIntoView),930-940(fitBounds)`.

**E-10 open-questions.yml 에 추가** — Q3~Q7. 내용은 5절과 같습니다.

## 4. 재리뷰가 필요한 차원
- **반드시 다시 봐야 함**
  - implementation: SR-1.3~1.6 지도 생명주기와 결과 패널, SR-4.2 적용 지점
  - test-strategy: SR-5 전면 교체
  - usecase: 대안 흐름 표, 계획서 편차, 통과 기준
- **diff 대조만 하면 됨**
  - architecture: copy.mjs 원본 위치, shellBody 한정
  - security: 앞부분 일치 규칙과 escape 순서. 리뷰어 수정안을 그대로 옮김
  - domain: 용어 정리만 바뀜

## 5. 사용자 판단 항목 (전부 권고 기본값으로 진행할 수 있음)

| # | 항목 | 권고 기본값 |
|---|---|---|
| Q3 | 「지도 보기/목록 보기」 전환을 계측할지 | 이번에는 계측하지 않음. 세려면 후속 스펙에서 별도 sectionId 로 |
| Q4 | 좁은 화면 한 줄에 둘 핵심 분류 칩 3개 | 전체 · 자연 · 행사. 「관광지」라는 분류 값은 없음 |
| Q5 | 「필터 N」에 내 주변·이 지역 검색(geo)을 셀지 | 세지 않음. N 은 분류·행사 상태·속성만 셈 |
| Q6 | 1440×900 첫 카드 y 가 320 을 넘을 때 | 데스크톱은 바꾸지 않고 실측 값을 보고, 완료 조건 미충족으로 표시 |
| Q7 | 계획서의 「insecure 0」과 「적재 시 치환」에서 벗어나는 것 | 표시 시점 치환. tong 원인 insecure 0, 다른 호스트는 건수와 사유 보고. 계획서 S2-5 행에 편차를 한 줄 기록 |

## 6. 그 밖에 메모해 둘 것
- data-sources §0 ② 는 「원천을 덮지 않는 파생 컬럼」도 허용합니다. 그래서 적재 시 파생 컬럼도 규칙 위반이 아니고, 표시 시점을 고른 진짜 이유는 「스키마 변경 없음」입니다. Q7 의 근거 문구는 이 이유로 적는 것이 맞습니다.
- 새로 생기는 면(하단 고정 버튼, 요약 줄, 결과 패널)은 `fe-visual-verification.md` 의 기기×사이트 4조합 대비 측정 대상인데, 이번 SR-5.5 에는 들어 있지 않습니다. domain 리뷰어가 「다른 차원 소관」으로 남겨 둔 것이라 판정에는 넣지 않았습니다.

SUMMARY: keep 32 / demote 1 / dismiss 0
NOTES: data-sources §0② 는 적재 시 파생 컬럼도 허용하므로 표시 시점을 고른 근거는 「스키마 변경 없음」으로 적을 것. 새 UI 면의 4조합 대비 측정(fe-visual-verification)이 SR-5 에 없음(판정 대상 밖이라 메모만).