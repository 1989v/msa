# Task Breakdown: place 롱테일 속성 랜딩 + 편집 페이지 (S3-2 · S3-1)

## Overview
Total Task Groups: 6. 정본은 `spec.md`(3라운드 심판 반영). 열린 질문은 `context/open-questions.yml` 권고 기본값을 따른다 — Q2 스위치는 꺼진 채 배포, Q3 `pet=ALLOWED`·`barrier-free=WHEELCHAIR`(「휠체어 대여」), Q4 하한 10·속성당 5·합산 20·Jaccard 0.5, Q5 초안 공개 200·noindex, Q6 미달은 noindex, Q7 「전체 M곳」 없음, Q8 은퇴는 지우지 않음, Q9 published 카드 404 는 빌드 실패, Q10 은퇴 20 초과는 경고만.
표준: `docs/conventions/blog-writing.md`(편집 본문), `docs/standards/fe-visual-verification.md`, root `DESIGN.md`·`docs/design/k-heritage.html`(place 면 배치), ADR-0062(§2·§8·§17).

**사용자 몫(이 작업에서 하지 않는다)**
- `PLACE_LANDINGS_INDEXABLE` 를 `true` 로 바꾸기 — ADR-0062 §18 개정(`context/adr-0062-amendment-draft.md`) 수용과 같은 커밋에서 사용자가 한다(Q2). 이 작업은 `false` 로 배포한다.
- 편집 페이지 3장의 주제 선정·사실 검수·게시(Q1). 초안은 전부 `status: draft` 로 둔다. `reviewedBy`·`reviewedAt` 을 채우지 않는다.
- ADR-0062 본문 개정. 초안 파일은 그대로 두고 ADR 에 반영하지 않는다.

규칙 원본은 `portal-fe/src/seo/copy.mjs` 하나다(SR-4.1). 선정 스크립트·프리렌더·SPA 가 모두 이 파일을 import 하므로 TG1 이 가장 앞이다.

### Task Group 1: 상수·슬러그 표·랜딩 문구 (copy.mjs) (SR-0.1 · SR-1.1 · SR-1.4 · SR-4)
**Dependencies:** None · **Phase:** portal-fe `src/seo` · **Required Skills:** JS(ESM), TS, vitest
- [x] 1.1 테스트 먼저
  - 새 `portal-fe/src/seo/__tests__/landingDecisions.test.ts` — 상수만 import 하고 리터럴로 단언(SR-4.2): `PLACE_LANDINGS_INDEXABLE === false`, `PLACE_LANDING_MIN_RESULTS` 10, 속성당 상한 5, 합산 상한 20, Jaccard 상한 0.5, 슬러그 표 4행(attr·facet 키·국문 이름: `parking`/`parking.YES`/주차 가능, `pet`/`pet.ALLOWED`/반려동물 동반, `barrier-free`/`barrierFree.WHEELCHAIR`/휠체어 대여, `free`/`admission.FREE`/입장 무료), 영문 허용은 `parking`·`free` 만, `SIGHT_CATEGORIES` = `['nature','history','culture','leisure']`
  - 새 `portal-fe/src/seo/__tests__/landingMeta.test.ts` — 기대값은 상수·대상 함수 출력으로 계산(SR-4.3, 문장을 테스트 안에서 다시 조립하지 않는다)
    - 슬러그 표의 칩 id 4개가 전부 `placeAttributes.ts` `ATTRIBUTE_CHIPS` id 안에 있음
    - 시도 약칭: 같은 「중구」 두 시도(서울 11140 · 부산 26110) → `title` 이 다름
    - N 없음 → `sentence` 없음 · `asOf` 없음 → 「— 원천 갱신 기준」 꼬리 없음
    - 영문 형식 「{Attr en} Attractions in {Sigungu en}, {Sido en}」, 영문명 빈 시도는 국문명
    - `landingPath(lang, code, attr)` 가 `/regions/{code}/{attr}`·`/en/regions/{code}/{attr}`
  - `portal-fe/src/api/__tests__/placeApi.test.ts` 증보: `placeApi` 의 `SIGHT_CATEGORIES` 가 `copy.mjs` 의 것과 같은 배열 참조
- [x] 1.2 `copy.mjs`
  - `export const PLACE_LANDINGS_INDEXABLE = false;` 한 줄(`ADSENSE_CLIENT` 옆, 환경 변수 아님)
  - `SIGHT_CATEGORIES` 정의를 옮기고, `placeApi.ts:326-331` 주석(명동 7건 쇼핑 사고 근거)도 함께 옮긴다
  - 슬러그 표 `PLACE_LANDING_ATTRS`(attr·검색 파라미터·facet 키·칩 id·국문/영문 이름·언어) — SR-1.1 표가 유일한 정의
  - `PLACE_LANDING_MIN_RESULTS`(10)·속성당 상한(5)·합산 상한(20)·Jaccard 상한(0.5)
  - `landingPath(lang, code, attr)`, `landingMeta(lang, sido, sigungu, attr, { count, asOf })` → `{ title, description, heading, sentence }`. 시도 약칭은 지역 표시명 규칙(`copy.mjs:460-491` 주변)을 재사용
- [x] 1.3 `src/api/placeApi.ts` 의 `SIGHT_CATEGORIES` 를 `export { SIGHT_CATEGORIES } from '../seo/copy.mjs'` 한 줄로(선례 `AdSlot.tsx:2`). `PlacePage.tsx`·`RegionPage.tsx` import 는 그대로 동작해야 한다 — 다른 파일에 리터럴을 다시 적지 않는다
- [x] 1.4 Verify: `cd portal-fe && npx vitest run src/seo/__tests__/landingDecisions.test.ts src/seo/__tests__/landingMeta.test.ts src/api/__tests__/placeApi.test.ts && npx tsc -b`

### Task Group 2: 선정 스크립트 + 커밋 목록 (SR-1.2 · SR-1.3 · SR-1.10)
**Dependencies:** TG1 · **Phase:** portal-fe `scripts` · `src/content` · **Required Skills:** Node ESM, vitest, 검색 API(`/api/search/attractions`, `facets=true`)
- [x] 2.1 테스트 먼저 — 새 `portal-fe/src/seo/__tests__/selectPlaceLandings.test.ts`. 후보 조립 픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양(`pet.PARTIAL`·`barrierFree.ELEVATOR` 값 포함) + 검색 응답(`totalElements`, 상위 30 id), 선정 함수 픽스처는 `candidates` 모양. 둘 다 분류 필터 유무 포함
  - `buildCandidates({ lang, regions, get })`
    - `pet.PARTIAL`·`ELEVATOR` 건수가 커도 예비 후보가 되지 않음
    - `count` 는 필터 질의 `totalElements`(facet 건수와 다른 값을 둔 픽스처)
    - facet `null` 응답 → 예외
    - 질의 인자: 모든 질의의 `category` 가 `SIGHT_CATEGORIES.join(',')`, `sidoCode = code.slice(0,2)`·`sigunguCode = code.slice(2)`(3자리), 필터 질의 `size=30`
  - `selectLandings({ regions, candidates, previous })`
    - `PLACE_LANDING_MIN_RESULTS - 1` 제외 · `PLACE_LANDING_MIN_RESULTS` 포함
    - 속성당 상한: 한 속성 후보 6+ → 상한 수
    - 합산 상한: 국 20 + 영 10 후보(전부 같은 건수) → 합산 상한 수, ko 먼저
    - 동점은 코드 오름차순
    - 영문 `pet`·`barrier-free` 후보 제외
    - Jaccard: 30 id 두 묶음에서 `k/(60−k)` 가 상한을 넘는 최소 k 를 상수로 계산 → k 제외, k−1 포함
    - 기존 항목 유지: `previous` 에 있고 이번에 안 뽑힘 → `retired: true`·`retiredAt` 으로 남음 · 상한 계산에서 빠짐 · 다시 뽑히면 `retired`·`retiredAt` 해제, `selectedAt` 은 처음 값
    - 모집단(`administrative-regions` 시군구 행) 밖 코드 제외
    - 은퇴 수가 합산 상한 초과 → 경고 반환, 항목 삭제 없음
- [x] 2.2 새 `portal-fe/scripts/select-place-landings.mjs`
  - `buildCandidates`·`selectLandings` export(순수, `get` 주입 — 선례 `fetchSidoSlice`), 직접 실행 가드(import 만으로 네트워크를 치지 않는다 — `prerender-seo.mjs` 와 같은 방식)
  - 상수·슬러그 표·`SIGHT_CATEGORIES` 는 `../src/seo/copy.mjs` 에서 import(리터럴 금지)
  - 정렬: 건수 내림차순 → ko 먼저 → 코드 오름차순. 상한은 활성 항목만 센다. Jaccard 는 같은 언어·같은 시군구의 이미 뽑힌 랜딩과
  - 항목 필드 `lang, code, sidoCode, attr, count, jaccardMax, selectedAt`(KST 날짜) + 선택 `retired, retiredAt`
  - 실행 시 `src/content/place-landings.json` 을 읽어 `previous` 로 넘기고 결과를 다시 쓴다. 항목을 스스로 지우지 않는다
- [x] 2.3 목록 생성·커밋 대상: 운영 검색 API(읽기 GET)로 `node scripts/select-place-landings.mjs` 1회 → `src/content/place-landings.json`. facet `null` 로 실패하면 다시 돌린다(건너뛰지 않는다). 실행 로그(언어별 예비 후보 수·선정 수·제외 사유 건수)를 `verifications/selection-run.md` 에 남긴다
- [x] 2.4 Verify: `cd portal-fe && npx vitest run src/seo/__tests__/selectPlaceLandings.test.ts`

### Task Group 3: 프리렌더 · sitemap · llms · nginx (SR-0.2 · SR-1.4~1.9 · SR-3.3 · SR-5.2)
**Dependencies:** TG1, TG2(목록 형식) · **Phase:** portal-fe `scripts/prerender-seo.mjs` · `nginx.conf` · **Required Skills:** Node ESM, nginx, vitest, bash/docker
- [ ] 3.1 테스트 먼저 — 새 `portal-fe/src/seo/__tests__/prerenderPlaceLandings.test.ts`(픽스처 목록·검색 응답, 운영 API 없음)
  - 출력: h1(`landingMeta` heading)·문장·목록 30·형제 링크·지역 링크(필수)·허브 링크·canonical 이 그 랜딩 주소
  - 스위치 false → `noindex, follow` 메타
  - N < 하한 → noindex + 빌드 경고
  - `retired` 항목 → 파일은 생성, noindex, sitemap·llms 제외
  - `retired`·N 미달 형제는 링크 안 됨, 형제 0개면 형제 절 생략
  - facet `null` + `totalElements` 12 → 문장에 12, N 판정 통과
  - 이스케이프: 픽스처 이름 `<script>` → 평문
  - 모집단 밖 code 항목 → 파일 없음 + 경고
  - sitemap·llms: 스위치 false → 랜딩 0건. 스위치 true(함수 인자로 주입) → 하한 이상·비은퇴만, `lastmod` = 표시 30건 `modifiedAt` 최댓값(없으면 비움, 빌드일 금지), hreflang 은 국·영 둘 다 실릴 때만
  - 품질 게이트: 랜딩 간 title·description 중복 → 예외(빌드 실패)
  - 부분 실패: 랜딩 조회 하나 실패 + 다른 섹션 성공 → `PartialSeoFailure`
  - 조회 인자: `category` = `SIGHT_CATEGORIES`, `sigunguCode` 3자리
- [ ] 3.2 `prerender-seo.mjs`
  - `place-landings.json` 읽기 → 항목마다 SR-1.2 필터 질의 1회(size 30). 빌드 질의 수 = 항목 수(은퇴 포함)
  - `fetched/failed` 가드 안 섹션 `place-landings` — 항목 하나 실패도 섹션 실패
  - `renderPlaceLanding(...)` export: 원천 문자열은 `sourceText`/`placeIntroText` 평문화 → `escapeHtml`, 링크는 `attractionPath`/`regionPath`/`landingPath` 로만
  - 출력 `prerender/{en/}regions/{code}/{attr}.html`. noindex = `!PLACE_LANDINGS_INDEXABLE || retired || N < 하한`(값 없음은 통과 아님)
  - sitemap·llms 항목 함수(스위치·은퇴·하한 조건), title·description 중복 0 게이트
- [ ] 3.3 `nginx.conf`
  - 지역 location **바로 앞**에 `location ~ ^/(en/)?regions/([^/]+)/([^/]+)$ { add_header Cache-Control "no-cache, must-revalidate"; add_header X-Robots-Tag $host_robots_tag always; try_files /prerender/$1regions/$2/$3.html =404; }`
  - 옛 지역 301 정규식을 `^/(?<legacy_region_lang>en/)?regions/(29|46)([0-9]{3})?(/[^/]+)?$` 로 넓힌다(랜딩 주소도 시도 허브로)
  - 편집 페이지: `location ~ ^/guides/([a-z0-9][a-z0-9-]*)$ { … X-Robots-Tag $host_robots_tag; try_files /prerender/guides/$1.html =404; }`, `location ~ ^/guides/?$ { … try_files /prerender/guides/index.html =404; }`
- [ ] 3.4 새 `portal-fe/scripts/check-nginx-place-landings.sh` — `check-nginx-legacy-regions.sh` 와 같은 방식(실제 `nginx:1.27-alpine`, `NGINX_CONF` 로 사본 주입 가능, 도커 없으면 exit 2). 픽스처 dist 로 SR-5.2 9개 계약을 판정한다. CI·훅에 걸지 않는다. 실행은 TG6
- [ ] 3.5 Verify: `cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlaceLandings.test.ts src/seo/__tests__/prerenderPlace.test.ts && bash -n scripts/check-nginx-place-landings.sh`

### Task Group 4: SPA 프리셋 랜딩 화면 (SR-2)
**Dependencies:** TG1, TG2(번들에 넣을 `place-landings.json`), TG3(동등성 비교용 프리렌더 출력) · **Phase:** portal-fe `src/pages/place` · `App.tsx` · **Required Skills:** React, TS, vitest + Testing Library
- [ ] 4.1 테스트 먼저 — 새 `portal-fe/src/pages/place/__tests__/PlaceLanding.test.tsx`(선례 `PlacePage.tracking.test.tsx` 의 `byAction`, 좌표 성공·거부 두 경우)
  - SEARCH trigger 열 = `['landing']`(`initial` 없음)
  - 모든 SEARCH 가 같은 시도·시군구·속성, payload `landing: "{code5}/{attr}"`
  - 조건 변경 뒤 주소·canonical 유지
  - 목록에 없는 조합 → `NotFoundPage`
  - heading·sentence 가 같은 픽스처의 `renderPlaceLanding` 출력과 일치
  - 프리셋 질의 `sigunguCode` 3자리(`code.slice(2)`), `category` = `SIGHT_CATEGORIES`
  - 첫 결과 facet `null` 이어도 N = `totalElements` 표시, 결과 전에는 noindex
  - `retired` 항목 → 화면은 그리고 noindex
  - 스위치 false → noindex
  - `PlacePage.test.tsx`·`PlacePage.tracking.test.tsx` 기존 단언이 그대로 통과(프리셋 없음 = 지금과 같음)
- [ ] 4.2 새 `PlaceLandingRoute`(`src/pages/place/PlaceLandingRoute.tsx`): 번들 `place-landings.json` 에서 (lang, code, attr) 조회 → 없으면 `NotFoundPage`, 있으면 `<PlacePage preset={{ sidoCode, sigunguCode: entry.code.slice(2), attribute: 칩 id, retired, seo }} />`
- [ ] 4.3 `PlacePage({ preset? })`
  - `sidoCode`·`sigunguCode`·`attributes` 를 `useState` 초기값으로(effect·`selectRegion` 경유 금지), `autoPickedRef` 를 `true` 로 시작
  - 첫 질의 trigger `landing`, 라우트 동안 모든 SEARCH payload 에 `landing`
  - 위에 heading·sentence(N = 프리셋 첫 결과 `totalElements`), `useSeo` 입력을 preset.seo 로, canonical 고정·히스토리 교체 없음
  - noindex = `!PLACE_LANDINGS_INDEXABLE || preset.retired || 첫 결과 전 || 첫 결과 totalElements < 하한`. 조건 변경 뒤 재계산 없음
  - `:339` 주석을 「속성 칩 조작은 주소를 만들지 않는다 — 속성 주소는 `place-landings.json` 에 커밋된 랜딩뿐」으로
  - 배치·색은 DESIGN.md 토큰만(hex 금지), `k-heritage.html` 견본 기준
- [ ] 4.4 `App.tsx`: `/regions/:code/:attr`·`/en/regions/:code/:attr` → `placeRoute(<PlaceLandingRoute />)` (`:296-297` 지역 라우트 옆)
- [ ] 4.5 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/PlaceLanding.test.tsx src/pages/place/__tests__/PlacePage.test.tsx src/pages/place/__tests__/PlacePage.tracking.test.tsx && npx tsc -b`

### Task Group 5: 편집 페이지 — render-content `parts` · 프리렌더 카드 · SPA · 초안 3장 (SR-3)
**Dependencies:** TG1, TG2(내부 링크 대조용 목록), TG3(nginx `/guides` location) · **Phase:** portal-fe `scripts/render-content.mjs` · `prerender-seo.mjs` · `src/pages/place` · `src/content/guides` · `scripts/lint-blog-post.py` · **Required Skills:** Node ESM, marked, React, Python 3, vitest
- [ ] 5.1 테스트 먼저
  - `portal-fe/src/content/__tests__/renderContent.test.ts` 증보(편집 소스 픽스처)
    - published + `reviewedBy`/`reviewedAt` 비어 있음 → 실패
    - 형식 위반: 표지·`attractionIds` 둘 다 `1234567890123`(13자리, 집합 일치) → 실패
    - 집합 불일치: 표지 `101`, `attractionIds: [101, 102]` → 실패
    - 표지 변형(홑따옴표 `data-guide-card='101'`) → 출현 수 ≠ 형식 일치 수로 실패
    - 은퇴·목록 밖 랜딩 링크 → 실패
    - 정상 원본 → `parts: Array<{html}|{cardId}>` 순서 보존
  - `src/content/__tests__/prerenderTechSearch.test.ts` 는 수정 없이 그대로 통과
  - 새 `portal-fe/src/seo/__tests__/prerenderGuides.test.ts`
    - draft → noindex·「검수 전 초안」 띠·sitemap·llms 제외
    - published 0 → `guides/index.html` 없음, 허브 하단 `/guides` 링크 없음 / published ≥ 1 → 목록·링크 1개
    - 카드 이스케이프(픽스처 이름 `<script>` → 평문), 카드 영역 「색인 기준 {빌드 KST 날짜}」
    - draft 카드 404 → 그 카드 빼고 경고 / published 카드 404 → 실패 메시지에 원본 파일 경로와 id
    - N 하한 미만 랜딩 링크 → 빌드 경고
  - 새 `portal-fe/src/pages/place/__tests__/GuidePage.test.tsx`: `/guides/:slug` 렌더, draft 띠·noindex, 없는 slug → `NotFoundPage`, 카드 이스케이프(픽스처 `<script>` 가 요소로 생기지 않음)
  - 새 `portal-fe/src/content/__tests__/guidesLint.test.ts`: `src/content/guides/*.md` 마다 `python3 ../scripts/lint-blog-post.py --body-only` 종료 코드 0. python3 가 없으면 `skip`(통과로 세지 않는다)
- [ ] 5.2 `render-content.mjs` 소스 목록 일반화: 기존 `search-architecture` 출력 계약 유지, `src/content/guides/*.md` → `src/pages/place/generated/guides/{slug}.json`(본문 HTML·머리말·`parts`). 표지 검사(`^[0-9]{1,12}$`, 집합 일치, 출현 수 = 형식 일치 수), published 검수자 게이트, `place-landings.json` 대조. API 호출 없음. 분할 규칙은 여기 한 곳. `portal-fe/.gitignore` 에 `/src/pages/place/generated/` 추가
- [ ] 5.3 `scripts/lint-blog-post.py` 에 `--body-only`(F1 생략) 옵션 하나. 기존 호출 동작은 그대로
- [ ] 5.4 `prerender-seo.mjs`: 카드 `GET /api/search/attractions/{id}`(부분 실패 가드 안), 고정 템플릿(이름·주소·요금·휴무·주차·반려) + 평문화 + `escapeHtml`, `prerender/guides/{slug}.html`, published ≥ 1 일 때만 `guides/index.html`·허브 하단 링크·sitemap·llms
- [ ] 5.5 SPA: `GuidePage`·`GuideIndexPage`(`src/pages/place/`) — 같은 JSON·같은 엔드포인트, `html` 조각만 `dangerouslySetInnerHTML`, `cardId` 는 React 요소. `App.tsx` 에 `/guides/:slug`·`/guides`(placeRoute). 목록은 published 만
- [ ] 5.6 초안 3장 `src/content/guides/`(서울 무료 실내 · 서울 고궁 반나절 · 제주 반려동물 동반), 전부 `status: draft`, `reviewedBy`·`reviewedAt` 비움. 각 장: 첫 h2 앞 요약 표 · 선정 이유(데이터 기준 문장) · 후보 5~8곳(운영 색인 조건 검색, 검색 조건을 본문에 적음) · 비교 표(요금·휴무·주차·반려) · 주의(「정보 없음」 칸 명시) · 내부 링크(상세·지역·비은퇴 랜딩). 목록·숫자는 색인 데이터에서만. 사용한 검색 조건과 결과 id 를 `verifications/guide-drafts.md` 에 남긴다
- [ ] 5.7 Verify: `cd portal-fe && node scripts/render-content.mjs && npx vitest run src/content/__tests__/renderContent.test.ts src/content/__tests__/prerenderTechSearch.test.ts src/content/__tests__/guidesLint.test.ts src/seo/__tests__/prerenderGuides.test.ts src/pages/place/__tests__/GuidePage.test.tsx && npx tsc -b`

### Task Group 6: 문서 · 회귀 주입 · nginx 계약 수동 실행 · 온톨로지 · 배포
**Dependencies:** TG1–5

> **스위치는 꺼진 채 배포한다.** `PLACE_LANDINGS_INDEXABLE = false` 가 커밋에 그대로 있는지 배포 전에 확인한다. 켜는 것은 ADR-0062 §18 개정 수용과 함께 사용자가 한다. 편집 초안 3장도 draft 로 나간다 — 게시는 사용자 검수 뒤(SR-3.8).

- [ ] 6.1 문서 동기화: `search/glossary.md` 에 「속성 랜딩」「편집 페이지(guide)」「프리셋」「색인 스위치」 네 행(「속성 랜딩」 행에 trigger 값 `landing` 과 구분된다는 주의). ADR-0062 는 손대지 않는다(초안만 `context/` 에)
- [ ] 6.2 회귀 주입(SR-5.3) — 임시 사본 워크트리에서, 컴파일되는 회귀만(구문 오류 빨간불은 증거 아님). 각각 빨간불과 잡은 테스트(또는 nginx 계약 항목) 이름을 `verifications/regression-injection.md` 에 기록
  - 하한 10→9 → `landingDecisions.test.ts` 만 빨강(경계 테스트는 상수로 계산해 초록인 것도 기록)
  - 선정 함수 `>=` → `>` → 경계 테스트
  - 속성당 상한 제거
  - 합산 상한 제거
  - 분류 필터 제거 → 질의 인자 테스트
  - 스위치 false 인데 noindex 제거 → 프리렌더·SPA noindex 단언
  - 랜딩 location 삭제 → nginx 계약 `/regions/11110/foo` 200(빨강)
  - 랜딩 location 을 지역 location 뒤로 이동 → nginx 계약
  - draft noindex 제거
  - published 게이트 제거
  - 프리셋을 effect 로 주입 → trigger 열 `['landing']` 단언
  - 랜딩 조회를 가드 밖으로 → `PartialSeoFailure` 단언
  - 편집 원본에 금칙 표현 한 줄 → `guidesLint.test.ts`
  - 선정 스크립트가 `previous` 를 버림 → 기존 항목 유지 테스트
  - 후보 조립 `count` 에 facet 건수 → `buildCandidates` `count` 테스트
  - SPA N 을 facet 건수로 → facet `null` 픽스처
  - 프리셋 `sigunguCode` 5자리 → 3자리 단언
  - SPA 카드를 이스케이프 없이 HTML 문자열에 이어 `dangerouslySetInnerHTML` → `GuidePage` 이스케이프 테스트
  - 표지 id 형식 검사 제거 → 13자리 픽스처
- [ ] 6.3 nginx 계약 수동 실행(SR-5.2): `bash portal-fe/scripts/check-nginx-place-landings.sh` 와 회귀 대조로 `bash portal-fe/scripts/check-nginx-legacy-regions.sh`. 출력 전문을 `verifications/nginx-contract.md` 에 보존. **exit 2(도커 없음)는 통과가 아니다** — 그 경우 이 항목은 미완료로 보고한다
- [ ] 6.4 온톨로지 참조: `grep -nE "copy\.mjs|prerender-seo|render-content|nginx\.conf|placeApi|PlacePage|lint-blog-post|SIGHT_CATEGORIES" code-dictionary/feature/src/main/resources/ontology/*.yaml` — 걸린 `symbol` 문자열이 바뀐 파일에 그대로 남아 있는지 `grep -F` 로 하나씩 확인(현재 `ads.yaml:673` `export const ADSENSE_CLIENT`, `ads.yaml:493` `location = /ads.txt`, `cloud.yaml:434`·`network.yaml:786,813`·`security.yaml:1424` nginx 지시문). 깨진 것이 있으면 yaml 쪽 symbol 을 고친다
- [ ] 6.5 빌드 전 확인: `cd portal-fe && npm run build` 성공(render-content → tsc → vite → prerender), 산출물 `dist/prerender/regions/*/*` 수 = 목록 항목 수(모집단 밖 제외), title·description 중복 게이트 통과 로그
- [ ] 6.6 배포: 6.2·6.3·6.5 통과 뒤 main 푸시 → portal-fe 이미지 → Argo 동기화. OCI 조작은 `ssh msa-oci` 로만(로컬 kubectl 금지)
- [ ] 6.7 배포 뒤 확인(SR-5.4) → `verifications/deploy-check.md`
  - 목록 각 주소 200·`<!--seo:prerendered-->`·`noindex`(스위치 false)
  - 목록 밖 조합 404
  - place sitemap 에 `/regions/*/*` 0건
  - 편집 초안 3장 200·noindex, `/guides` 404
  - 검수 표본(목록 전부): 표시 목록에서 3건씩 상세 응답의 해당 속성 값이 참인지
  - Rich/Schema 검증은 해당 없음(구조화 데이터 추가 없음)
- [ ] 6.8 사용자에게 넘길 것 보고: 스위치 켜기(ADR-0062 §18 승인 커밋), 편집 3장 검수·게시 절차(SR-3.8 ①~③), 은퇴 20 초과 경고 여부

## Execution Order
1. TG1 (copy.mjs 상수·슬러그 표·`landingMeta`)
2. TG2 (선정 스크립트 — TG1 상수를 import, 목록 파일을 만든다)
3. TG3 (프리렌더·sitemap·llms·nginx — 목록을 읽는다)
4. TG4 · TG5 (병렬 가능하나 둘 다 `App.tsx`·`prerender-seo.mjs` 를 건드리므로 순차 권장: TG4 → TG5)
5. TG6 (6.2·6.3·6.5 는 푸시 전, 6.7 은 배포 뒤. 스위치는 끈 채)
