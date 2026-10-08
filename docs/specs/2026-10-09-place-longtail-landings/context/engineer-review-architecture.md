# Engineer Review — architecture (1라운드)

스펙: `docs/specs/2026-10-09-place-longtail-landings/spec.md`
체크리스트: hns 0.15.1 `reviewers/architecture/checklist.md` (0.16.1 경로에 파일 없음 — 캐시에 있는 최신본 사용)

## 판정 요약
백엔드·스키마·통신 변경이 없어 레이어·의존 방향·트랜잭션 항목은 해당 없음(통과). 문제는 문서화된 결정과의 충돌 기록 누락, 빌드 단계 경계(네트워크 없는 단계에서 색인 조회), 거대 화면 컴포넌트에 모드를 더하는 방식 세 가지다.

## Findings

### A1. 「속성은 주소를 만들지 않는다」 기존 결정을 뒤집는데 ADR 개정이 없다 (체크: Architecture pattern consistency)
- 스펙: 머리말 "ADR 불요(새 서비스·스키마·통신 없음, 빌드타임 프리렌더 확장)" (`spec.md:4`), SR-1.1 속성 랜딩 주소 신설 (`spec.md:12`).
- 기존 결정: `portal-fe/src/pages/place/PlacePage.tsx:339` "속성 칩 — 화면 상태일 뿐 주소를 만들지 않는다(새 색인 URL 금지)", `docs/adr/ADR-0062-seo-and-organic-discovery.md:442` 「태그별 랜딩 페이지」를 얇은 페이지 양산으로 기각.
- 사용자 결정 D-2 ⓑ(`docs/plans/2026-10-08-place-growth-work-plan.md:50`)가 있어 BLOCK 은 아니지만, 근거 없이 코드 주석과 ADR 이 반대 말을 하게 된다.
- 수정안: ADR-0062 에 개정 절(속성 × 시군구 랜딩 예외: 10건 하한·속성당 5·전체 상한·조합 주소 없음·0건 404)을 한 단락 추가하고, `PlacePage.tsx:339` 주석을 「속성 칩 조작은 주소를 만들지 않는다 — 색인 주소는 빌드가 뽑은 랜딩뿐」으로 고치는 작업을 SR 에 넣는다. 머리말 "ADR 불요" 는 "ADR-0062 개정"으로.

### A2. 편집 페이지 카드가 빌드 단계 경계를 넘는다 (체크: Layer responsibility / Information hiding)
- 스펙: SR-3.1 "빌드 때 `render-content.mjs` 로 HTML … 관광지 블록은 `attractionIds` 를 색인에서 받아 카드" (`spec.md:25`).
- 코드: `render-content.mjs` 는 API 를 부르지 않는 순수 변환이고 `dev` 와 `tsc` 앞에서 돈다(`portal-fe/package.json:8-9`, `portal-fe/Dockerfile:45`). 색인 조회는 vite 뒤의 `prerender-seo.mjs` 만 한다(`prerender-seo.mjs:106,307-313`). 또 원본·출력 경로가 하나로 고정돼 있다(`render-content.mjs:17-18`).
- 카드 조회를 render-content 에 넣으면 `npm run dev`·CI tsc 가 운영 API 에 묶인다.
- 수정안: 경계를 명시한다 — render-content 는 md → 본문 HTML + 머리말(JSON) 까지, 카드 HTML 은 prerender-seo 가 `GET /api/search/attractions/{id}`(`AttractionSearchController.kt:107`)로 채운다. render-content 는 소스 목록을 받도록 일반화하되 `search-architecture` 출력 계약(`src/content/__tests__/prerenderTechSearch.test.ts`)을 유지한다고 적는다.

### A3. 허브에 「프리셋 모드」를 얹는 방식이 정해지지 않았다 (체크: Interface surface minimal / Seam)
- 스펙: SR-2.1 "허브 컴포넌트를 프리셋 조건으로 띄운다", SR-2.3 canonical 은 랜딩 주소 (`spec.md:20-22`).
- 코드: `PlacePage` 는 props 가 없고 canonical·hreflang 을 허브 값으로 고정한다(`PlacePage.tsx:312,319-328`). 첫 진입 자동 시도 선택이 프리셋을 덮을 수 있다(`PlacePage.tsx:623-643`).
- 수정안: 인터페이스를 한 줄로 고정한다 — `PlacePage({ preset?: { sidoCode, sigunguCode, attribute, seo } })`, preset 이 있으면 ① 상태 초기값으로 넣고(effect·`selectRegion` 경유 금지 — `selectRegion` 은 trigger 를 덮는다, `PlacePage.tsx:595-613`) ② `autoPickedRef` 를 처음부터 true ③ `useSeo` 입력을 preset.seo 로 바꾼다. 랜딩 전용 래퍼 컴포넌트가 이 props 만 만든다(삭제 테스트: 래퍼를 지우면 라우트 2곳으로 흩어지므로 유지할 가치 있음).

### A4. 대상 선정 로직의 자리 (체크: Module depth)
- `prerender-seo.mjs` 는 이미 섹션별 조회·렌더를 한 파일에 담고 있다(`prerender-seo.mjs:165-303`). 선정 함수는 SR-4.1 에서 단위 테스트 대상이므로 순수 함수로 export 해야 한다(선례: `fetchSidoSlice` 가 `get` 주입, `prerender-seo.mjs:1038`).
- 수정안: SR-1.2 에 「선정 함수는 (facet 응답 픽스처) → 목록의 순수 함수, 조회는 `get` 주입」을 적는다. 비차단.

## 통과 항목
- 의존 방향·순환: FE 빌드 스크립트와 copy.mjs 만 손댄다. copy.mjs 를 문구 SSOT 로 쓰는 것은 CLAUDE.md SEO 절 규칙과 일치(`spec.md:21`).
- 경로 키: `/regions/...` 는 호스트와 무관한 place 콘텐츠라 `_hosts/$host` 키 불요 — 기존 지역 location 의 근거와 같다(`nginx.conf:228-231`). SPA 셸에 고정 canonical 을 추가하지 않는다.

VERDICT: REVISE
