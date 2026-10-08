<!-- source: portal-fe/scripts/prerender-seo.mjs, portal-fe/nginx.conf, portal-fe/src/App.tsx, portal-fe/src/pages/place/PlacePage.tsx, portal-fe/src/pages/place/RegionPage.tsx, portal-fe/scripts/render-content.mjs, portal-fe/src/seo/copy.mjs -->
# Specification: place 롱테일 속성 랜딩 + 편집 페이지 (S3-2 · S3-1)

> 2026-10-09. 사용자 위임, D-2 ⓑ(편집 2~3 + 프로그램형 10~20 동시 시험). **속성 랜딩은 기존 결정 「속성 칩은 주소를 만들지 않는다(새 색인 URL 금지)」(`PlacePage.tsx:339`, `docs/specs/2026-09-29-place-ssr-enrichment/spec.md:53`)와 ADR-0062 §2·§8 의 얇은 페이지 원칙에 어긋나므로 ADR-0062 개정이 필요하다.** 개정 승인은 사용자 몫이라, 이 스펙은 랜딩을 **색인 스위치를 끈 채로**(noindex · sitemap 제외 · llms 제외) 구현·배포하고, 개정 초안을 `context/adr-0062-amendment-draft.md` 에 둔다. 편집 페이지 선정·검수도 사용자 몫(Q1)이고 초안은 `draft` 로 둔다. 코드 지도: 속성 칩은 허브 useState 라 지금 크롤 가능한 패싯 URL 은 0건이다. 시군구 × 속성 집계 API 는 없고 시군구마다 `facets=true` 1회다. 지역 프리렌더가 없으면 SPA 셸 200(soft 404)이 나간다.
>
> 개정 2026-10-09 — 1라운드 심판(33건 중 31 유지·2 강등, `context/review-verdict-round1.md`)과 2라운드 심판(14건 전부 유지, `context/review-verdict-round2.md`), 3라운드 심판(10건 전부 유지, `context/review-verdict-round3.md`) 반영. 사용자 판단 Q2~Q10 은 권고 기본값.

## Goal
「부산 중구 주차 가능 관광지」처럼 속성 하나 × 시군구 하나의 랜딩을, 결과가 충분한 조합만 뽑아 레포에 커밋한 목록으로 고정하고, 빌드가 읽히는 고유 페이지로 낸다. 색인은 스위치 하나로 열고 닫는다(기본 닫힘). 편집 페이지 3장의 틀과 초안을 검수 대기 상태로 둔다.

## Specific Requirements

### SR-0 색인 스위치 (ADR-0062 개정 대기)
1. `portal-fe/src/seo/copy.mjs` 에 `export const PLACE_LANDINGS_INDEXABLE = false;` 한 줄. 프리렌더·SPA·sitemap·llms 가 전부 이 상수 하나만 본다(선례: 같은 파일의 `ADSENSE_CLIENT` 한 줄이 로더·지면·ads.txt 를 함께 켜고 끈다). 환경 변수로 두지 않는다 — Dockerfile ARG·CI 를 거치면 프리렌더와 SPA 가 다른 값을 볼 수 있고, 켜는 일이 커밋 한 줄로 남아야 사용자 승인과 짝이 맞는다.
2. `false` 일 때 속성 랜딩은 200 으로 나가되 프리렌더·SPA 모두 `noindex, follow`, sitemap·llms 에서 제외. nginx 404 규칙(SR-1.6)과 선정 목록은 스위치와 무관하게 동작한다.
3. `true` 로 바꾸는 커밋은 ADR-0062 개정(§18) 수용과 같은 커밋이어야 한다. 편집 페이지(SR-3)는 이 스위치를 따르지 않는다 — 자기 `status` 가 스위치다.
4. 「편집 페이지는 기각된 태그 랜딩이 아니다」: ADR-0062 의 기각 사유는 「기존 URL 축(장르)과 겹치는 프로그램형 페이지의 양산」이다. 편집 페이지는 ① 사람이 고른 3장이고 ② 선정 이유·주의 같은 고유 서술이 본문이며 ③ 기존 지역·속성 축의 부분집합이 아니라 축을 가로지르는 선별이고 ④ 검수자 없이는 published 가 될 수 없다(빌드 게이트). 속성 랜딩은 지역 페이지 목록의 부분집합이라 기각 사유의 범위 안에 있다 — 그래서 스위치는 랜딩에만 건다.

### SR-1 속성 랜딩 주소와 대상 (S3-2)
1. 주소: `/regions/{code5}/{attr}` (국문), `/en/regions/{code5}/{attr}` (영문). 속성 둘 이상·정렬·반경 조합 주소는 만들지 않는다(그래서 robots Disallow 대상 주소가 생기지 않는다 — 계획 S3-2 의 robots 항목은 「조합 주소를 만들지 않음」으로 충족). 슬러그 표(이 표가 유일한 정의):

   | attr | 검색 파라미터 | facet 키(건수) | 칩 id(SPA 프리셋) | 국문 이름 | 영문 이름 | 언어 |
   |---|---|---|---|---|---|---|
   | `parking` | `parking=YES` | `parking.YES` | `parking` | 주차 가능 | Parking | ko·en |
   | `pet` | `pet=ALLOWED` | `pet.ALLOWED` | `petAllowed` | 반려동물 동반 | — | ko |
   | `barrier-free` | `barrierFree=WHEELCHAIR` | `barrierFree.WHEELCHAIR` | `bfWheelchair` | 휠체어 대여 | — | ko |
   | `free` | `admission=FREE` | `admission.FREE` | `admissionFree` | 입장 무료 | Free admission | ko·en |

   `pet.PARTIAL`·`ELEVATOR`·`RESTROOM` 은 세지 않는다(이름이 센 것과 같아야 한다). 영문은 `parking`·`free` 만(`placeAttributes.ts:37-58`). `barrier-free` 의 이름은 「휠체어 대여」다 — 원천 `wheelchair` 칸의 긍정 원문은 대부분 대여·보유 안내라(`docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md:40-55`) 「휠체어로 이용 가능」(접근성)을 약속하지 않는다. 허브 칩 라벨(「휠체어」, `placeAttributes.ts`)은 바꾸지 않는다.
2. 분류와 N: 선정·집계·목록·SPA 첫 질의는 모두 `category=SIGHT_CATEGORIES.join(',')` 를 건다. `SIGHT_CATEGORIES` 는 `copy.mjs` 에 하나만 정의한다(SR-4.1) — `RegionPage.tsx:117-119`, `PlacePage.tsx:377-379`, 선정 스크립트, 프리렌더가 같은 배열을 쓴다. N(랜딩 건수)은 이 분류 필터 + SR-1.1 의 검색 파라미터 하나 + `sidoCode`·`sigunguCode`(SR-1.10)로 건 질의의 `totalElements` 다. facet 건수는 N 으로 쓰지 않는다 — facet 은 시간 초과·실패 때 `null` 로 오고 결과는 200 이다(`AttractionSearchAdapter.kt:191-205`). 프리렌더 N 과 SPA N 이 같은 질의에서 나온다.
3. 선정은 빌드가 아니라 스크립트가 한다: `node scripts/select-place-landings.mjs` 가 `portal-fe/src/content/place-landings.json` 을 갱신하고 이것을 커밋한다. 빌드는 목록을 읽기만 한다. 순서:
   ① 언어마다 모집단 시군구 하나에 분류 필터만 건 `facets=true` 질의 1회 → facet 건수 ≥ `PLACE_LANDING_MIN_RESULTS` 인 (시군구, 속성)을 예비 후보로 둔다. facet 이 `null` 이면 스크립트를 실패로 끝낸다(조용히 건너뛰지 않는다 — 다시 돌린다).
   ② 예비 후보마다 SR-1.2 의 필터 질의(size 30) 1회 → `totalElements`(= N)와 상위 30건 id.
   ①·② 는 `buildCandidates({ lang, regions, get })` 가 한다(`get` 주입). 슬러그 표의 facet 키로 예비 후보를 고르고, 필터 질의의 `totalElements` 를 `count` 로, 상위 30건 id 를 `ids` 로 싣는다. facet 이 `null` 이면 예외를 던진다.
   ③ 순수 함수 `selectLandings({ regions, candidates, previous })` 가 목록을 낸다. `candidates` 는 ② 의 결과 `{ lang, code, attr, count: totalElements, ids }` 배열, `previous` 는 지금 커밋된 `place-landings.json` 항목 배열이다. 조회는 함수 밖에서 `get` 주입으로 한다(선례 `fetchSidoSlice`).
   선정 규칙:
   - 모집단: 그 언어의 `administrative-regions` 시군구 행(지역 페이지가 있는 코드)만. 시군구 행이 없는 시도는 후보 없음.
   - 후보: `count` ≥ `PLACE_LANDING_MIN_RESULTS` 인 (언어, 시군구, 속성).
   - 정렬: 건수 내림차순 → 언어(ko 먼저) → 코드 오름차순.
   - 상한: 언어별 속성당 5, 국·영 합산 전체 20. `retired` 가 아닌 항목만 센다. 정렬 순서대로 채우며 둘 중 하나라도 차면 건너뛴다.
   - 중복도: 같은 언어·같은 시군구에서 이미 뽑힌 랜딩과 `ids` 의 Jaccard 가 0.5 를 넘으면 건너뛴다.
   - 기존 항목 유지: `previous` 에 있던 (lang, code, attr) 가 이번에 뽑히지 않으면 지우지 않고 `retired: true`·`retiredAt`(KST 날짜)을 달아 남긴다. 다시 뽑히면 `retired`·`retiredAt` 을 지우고 `selectedAt` 은 처음 값을 유지한다. 항목은 목록에서 빠지지 않는다 — 한 번 생긴 주소는 404 가 되지 않는다(SR-1.7 과 같은 원칙). 코드 개편 예외는 SR-1.7. 은퇴 항목 수가 합산 상한(20)을 넘으면 스크립트가 경고하고, 정리(삭제) 여부는 Q8 재판단으로 넘긴다 — 스크립트는 스스로 지우지 않는다.
   - 항목 필드: `lang, code, sidoCode, attr, count, jaccardMax, selectedAt`(KST 날짜), 선택 필드 `retired, retiredAt`.
4. 페이지 본문(프리렌더, 국·영): 메타·제목·문장은 `copy.mjs` 의 `landingMeta(lang, sido, sigungu, attr, { count, asOf })` 하나가 `title`·`description`·`heading`·`sentence` 를 낸다. 프리렌더와 SPA 가 같은 함수를 쓴다.
   - heading 국문 「{시도 약칭} {시군구} {속성 국문 이름} 관광지」, 영문 「{Attr en} Attractions in {Sigungu en}, {Sido en}」. 시도 약칭은 지역 표시명 규칙을 따른다(영문명이 비면 국문명).
   - sentence 국문 「{시도} {시군구}에서 {속성 국문 이름} 관광지 {N}곳 — 원천 갱신 기준 {asOf}」. N 은 SR-1.2 의 `totalElements` 다. `asOf` 가 없으면 「— 원천 갱신 기준」 꼬리를 뺀다. N 이 없으면(결과 전) 문장 자체를 내지 않는다. 전체 건수(M)는 싣지 않는다 — 속성 필터 질의의 응답에는 속성을 뺀 전체 건수가 없다(facet 은 자기 속성 선택만 빼고 센다, `AttractionSearchAdapter.kt:223`).
   - 본문: 결과 목록 최대 30건(허브 기본 정렬, 이름·분류·주소 앞부분, 상세 링크) · 형제 링크(같은 언어 목록 안의 같은 시군구 다른 속성, 같은 시도 같은 속성 — `retired` 가 아니고 현재 N ≥ `PLACE_LANDING_MIN_RESULTS` 인 항목만, SR-1.9 와 같은 조건에서 스위치만 뺀다; 0개면 생략) · 지역 페이지 링크(필수) · 허브 링크.
   - 원천 문자열은 `sourceText`/`placeIntroText` 로 평문화한 뒤 `escapeHtml` 한다. 링크는 `attractionPath`/`regionPath`/`landingPath` 로만 만든다(고정 템플릿).
5. 날짜: `asOf` = 표시된 30건의 `modifiedAt` 최댓값이다. 같은 값을 sitemap `lastmod` 로 쓰고, 없으면 둘 다 비운다(빌드일로 대신 적지 않는다 — `prerender-seo.mjs:1015-1017`).
6. nginx: 지역 location 바로 앞에 `location ~ ^/(en/)?regions/([^/]+)/([^/]+)$ { add_header Cache-Control "no-cache, must-revalidate"; add_header X-Robots-Tag $host_robots_tag always; try_files /prerender/$1regions/$2/$3.html =404; }`. 목록에 없는 조합·영문 `pet`·모르는 속성은 파일이 없어 **404**(nginx 기본 본문을 쓴다 — 선례 `nginx.conf:215-217`).
7. 빌드 시 데이터 미달·은퇴: 목록 항목의 현재 N(SR-1.2)이 `PLACE_LANDING_MIN_RESULTS` 미만이거나 항목이 `retired` 면 그 페이지는 그대로 만들되 noindex·sitemap·llms 제외로 내고, 미달은 빌드 로그에 경고한다(404 로 지우지 않는다 — 이미 생긴 주소를 빌드 사이에 없애지 않는다). 목록 갱신은 스크립트를 다시 돌려 커밋하는 사람의 일이고, 스크립트도 항목을 지우지 않는다(SR-1.3 기존 항목 유지). 예외: 항목 `code` 가 현재 모집단(`administrative-regions` 시군구 행)에 없으면(행정구역 개편 — 광주 29·전남 46 → 12 선례) 그 페이지는 만들지 않고 빌드 로그에 경고한다. 이때 nginx 옛 지역 301 이 랜딩 주소도 시도 허브로 보낸다(정규식 `^/(?<legacy_region_lang>en/)?regions/(29|46)([0-9]{3})?(/[^/]+)?$`). 「한 번 생긴 주소는 404 가 되지 않는다」의 유일한 예외이고, 이 경우도 404 가 아니라 301 이다.
8. 실패 모드: 랜딩 조회(목록·건수)는 `fetched/failed` 부분 실패 가드 안에 넣는다(섹션 이름 `place-landings`). 항목 하나만 실패해도 섹션 실패다. 빌드 질의 수 = 목록 항목 수(은퇴 포함)이고, 실패 면적도 같은 수다.
9. sitemap·llms: `PLACE_LANDINGS_INDEXABLE && !retired && N ≥ 하한` 인 항목만. hreflang 은 같은 (code, attr) 가 국·영 둘 다 목록에 있고 둘 다 실릴 때만.
10. 코드 자릿수: 주소·목록 항목의 `code` 는 5자리(시도 2 + 시군구 3)다. 검색 API 의 `sigunguCode` 는 3자리라서, 선정 스크립트·프리렌더·SPA 프리셋 모두 `sidoCode = code.slice(0, 2)`, `sigunguCode = code.slice(2)` 로 넘긴다(선례 `RegionPage.tsx:116`, 허브 비교 `PlacePage.tsx:570`).

### SR-2 SPA 랜딩 화면
1. 라우트 `/regions/:code/:attr`·`/en/regions/:code/:attr` → `PlaceLandingRoute`. 이 컴포넌트는 번들에 포함된 `place-landings.json` 에서 (lang, code, attr) 항목을 찾고, 없으면 `NotFoundPage` 를 그린다. 있으면 `<PlacePage preset={{ sidoCode: entry.sidoCode, sigunguCode: entry.code.slice(2), attribute: 칩 id, retired: entry.retired === true, seo }} />`.
2. `PlacePage({ preset? })`: preset 이 있으면 ① `sidoCode`·`sigunguCode`·`attributes` 를 **`useState` 초기값**으로 넣는다(effect·`selectRegion` 경유 금지 — `selectRegion` 은 trigger 를 `initial`/`region` 으로 덮는다) ② `autoPickedRef` 를 `true` 로 시작한다 ③ `useSeo` 입력을 preset.seo 로 바꾼다. preset 이 없으면 지금과 같다.
3. 화면 위에 `landingMeta` 의 heading·sentence 를 보인다. N 은 프리셋 첫 결과의 `totalElements` 다(facet 아님 — SR-1.2).
4. canonical 은 그 랜딩 주소로 고정한다. 조건이 바뀌어도 canonical·주소는 바꾸지 않는다(히스토리 교체 없음). 의도된 동작이다 — 허브의 속성 칩도 조건을 주소에 싣지 않는다(`PlacePage.tsx:339`).
5. noindex = `!PLACE_LANDINGS_INDEXABLE || preset.retired || 첫 결과 전 || 프리셋 첫 결과 totalElements < PLACE_LANDING_MIN_RESULTS`. 값이 없는 것을 통과로 세지 않는다. 프리렌더와 같은 규칙이고, 조건을 바꾼 뒤에는 다시 계산하지 않는다.
6. 계측: 프리셋 진입의 SEARCH trigger 는 `landing` 한 번뿐이다(`initial` 없음). 라우트가 살아 있는 동안의 모든 SEARCH payload 에 `landing: "{code5}/{attr}"` 를 싣는다. 페이지 종류는 문서에서 「속성 랜딩」이라 부르고, trigger 값 `landing`(첫 질의)과 구분한다.

### SR-3 편집 페이지 (S3-1)
1. 주소 `/guides/{slug}`(국문만 — D-1 ⓐ). 원본 `portal-fe/src/content/guides/{slug}.md`. 머리말은 `title`·`description`·`status: draft|published`·`reviewedBy`·`reviewedAt`·`attractionIds`.
2. 단계 경계:
   - `render-content.mjs` 는 소스 목록을 받도록 일반화한다(기존 `search-architecture` 출력 계약 유지 — `src/content/__tests__/prerenderTechSearch.test.ts` 그대로 통과). guides/*.md → `src/pages/place/generated/guides/{slug}.json`(본문 HTML + 머리말)까지만 만들고, API 는 부르지 않는다.
   - 본문 안 관광지 자리는 `<div data-guide-card="{id}"></div>` 표지로 남는다. render-content 는 표지 값이 `^[0-9]{1,12}$`(nginx 상세 id 규칙 `nginx.conf:192` 와 같음)인지, 본문 표지 id 집합이 머리말 `attractionIds` 집합과 같은지 검사하고, 어긋나면 빌드를 실패시킨다. render-content 가 분할까지 해서 JSON 에 `parts: Array<{ html } | { cardId }>` 로 싣는다. 검사에는 「`data-guide-card` 출현 수 = 정확한 표지 형식(`<div data-guide-card="\d{1,12}"></div>`) 일치 수」를 더한다. 분할 규칙은 이 한 곳에만 있다.
   - 카드는 `prerender-seo.mjs` 가 `GET /api/search/attractions/{id}` 로 채운다. 고정 템플릿 + 평문화 + `escapeHtml`, 요약은 이름·주소·요금·휴무·주차·반려.
   - SPA 는 같은 JSON 과 같은 엔드포인트로 런타임에 그린다. SPA 는 나누지 않고 `parts` 를 그린다. `html` 조각(render-content `check()` 를 통과한 레포 원본)만 `dangerouslySetInnerHTML` 로 넣고, `cardId` 는 React 요소로 그린다. API 응답 문자열을 HTML 문자열에 이어 붙이지 않는다.
   - 카드 조회는 부분 실패 가드 안이다. 관광지가 404 면 draft 는 그 카드를 빼고 경고하고, published 는 빌드를 실패시킨다.
3. nginx: `location ~ ^/guides/([a-z0-9][a-z0-9-]*)$ { … X-Robots-Tag $host_robots_tag; try_files /prerender/guides/$1.html =404; }`, `location ~ ^/guides/?$ { … try_files /prerender/guides/index.html =404; }`. 없는 slug 와 published 0건의 목록 주소는 404 다.
4. SPA 라우트 `/guides/:slug`·`/guides`(placeRoute). JSON 이 없는 slug 는 `NotFoundPage`.
5. `status: draft` → 프리렌더·SPA 모두 `noindex, follow`, sitemap·llms 제외, 화면 위에 「검수 전 초안」 띠. `published` 인데 `reviewedBy`·`reviewedAt` 이 비어 있으면 render-content 가 빌드를 실패시킨다.
6. 초안 3장(계획 예시): 서울 무료 실내 · 서울 고궁 반나절 · 제주 반려동물 동반. 각 장에 첫 h2 앞 요약 표(후보 이름·핵심 조건 — lint F8) · 선정 이유(데이터 기준 문장) · 후보 5~8곳(색인 조건 검색, 기준을 적음) · 비교 표(요금·휴무·주차·반려 — 카드 값) · 주의(「정보 없음」 칸 명시) · 내부 링크(상세·지역, 목록에 있고 `retired` 가 아닌 랜딩 — render-content 가 `place-landings.json` 과 대조해 은퇴·목록 밖 랜딩 링크면 실패시키고, 프리렌더는 빌드 때 N 이 하한 미만인 랜딩 링크를 경고한다). 문체는 `docs/conventions/blog-writing.md` 를 따르고, `scripts/lint-blog-post.py --body-only` 로 F2~F8 을 통과해야 한다. 이를 위해 lint 스크립트에 `--body-only`(F1 생략 — 편집 머리말은 블로그 4필드와 다르다) 옵션 하나를 추가한다.
7. 목록 `/guides`: published 가 1장 이상일 때만 `prerender/guides/index.html` 을 만들고 SPA 도 published 만 보인다. 0장이면 파일이 없어 404 이고 링크도 내지 않는다.
8. 게시 절차(사용자):
   ① 머리말 `status: published`·`reviewedBy`·`reviewedAt` 수정
   ② `scripts/lint-blog-post.py --body-only` 통과
   ③ 커밋·배포
   사후조건: noindex 해제 · sitemap·llms 포함 · `/guides` 목록 생성 · place 허브 프리렌더 하단에 `/guides` 링크 1개(published ≥ 1 일 때만).
   빌드 실패 복구: published 편집 페이지의 관광지가 404 면 빌드 실패 메시지에 원본 파일 경로와 관광지 id 를 적는다. portal-fe 이미지 하나에 전 호스트가 실려 있어 이 실패가 무관한 FE 배포까지 막으므로, 복구는 그 id 를 본문 표지·`attractionIds` 에서 빼거나 `status: draft` 로 되돌리는 커밋 하나다.
   `reviewedAt` 은 글(선정·서술)의 검수일이다. 카드 사실값은 빌드 시점 색인값이라 검수 뒤 바뀔 수 있고, 카드 영역에 「색인 기준 {빌드 KST 날짜}」를 표기한다.

### SR-4 상수와 테스트에 고정할 결정
1. 상수의 자리: 슬러그 표(SR-1.1 의 attr·검색 파라미터·facet 키·칩 id·국문/영문 이름·언어), `SIGHT_CATEGORIES`, `PLACE_LANDING_MIN_RESULTS`(10)·속성당 상한(5)·합산 상한(20)·Jaccard 상한(0.5)은 `portal-fe/src/seo/copy.mjs` 에만 정의한다. node 스크립트(`select-place-landings.mjs`·`prerender-seo.mjs`)는 이 파일을 직접 import 한다(선례 `prerender-seo.mjs:97`). `src/api/placeApi.ts` 의 `SIGHT_CATEGORIES` 는 `export { SIGHT_CATEGORIES } from '../seo/copy.mjs'` 로 바꾼다(선례 `AdSlot.tsx:2` — TS 가 copy.mjs 를 import). 슬러그 표의 칩 id 는 `placeAttributes.ts` 의 `ATTRIBUTE_CHIPS` id 중 하나여야 하고, 테스트 하나가 이를 대조한다. 같은 값을 다른 파일에 리터럴로 다시 적지 않는다. `placeApi.ts` 의 `SIGHT_CATEGORIES` 주석(명동 7건 쇼핑 사고 근거)은 `copy.mjs` 정의 위로 옮기고, `placeApi.ts` 에는 re-export 한 줄만 둔다.
2. 결정 수치 고정: 상수만 import 하는 전용 테스트 파일(`landingDecisions.test.ts`) 하나가 `expect(PLACE_LANDING_MIN_RESULTS).toBe(10)`, 속성당 5, 합산 20, Jaccard 0.5, 슬러그 표 4행(attr·facet 키·국문 이름), `SIGHT_CATEGORIES` 값을 리터럴로 단언한다. 이것은 사용자 결정(Q4·Q3)을 고정하는 단언이라, 상수를 바꾸는 커밋은 이 단언도 함께 바꿔야 한다.
3. 출력 비교: 그 밖의 기대값(문장·제목·경계 픽스처)은 상수와 대상 함수의 출력으로 계산한다 — 테스트 안에서 문장을 다시 조립하지 않는다(선례 `SearchArchitecturePage.test.tsx:6`). 2 와 3 은 다르다. 2 는 숫자 결정을 고정하고, 3 은 그 숫자를 쓰는 코드가 같은 값을 쓰는지 본다.

### SR-5 검증
1. vitest. 후보 조립 픽스처는 `SearchAttractionUseCase.AttributeFacets` 모양(`pet.PARTIAL`·`barrierFree.ELEVATOR` 값 포함) + 검색 응답(`totalElements`, 상위 30 id)이다. 선정 함수 픽스처는 `candidates` 모양이다. 둘 다 분류 필터 유무를 포함한다.
   - 후보 조립(`buildCandidates`):
     - `pet.PARTIAL`·`ELEVATOR` 는 예비 후보 판정에 안 들어감
     - `count` 는 `totalElements` 다(facet 건수와 다른 픽스처에서 `totalElements` 를 씀)
     - facet `null` 응답 → 예외(스크립트 실패 종료, `get` 주입)
   - 선정 함수:
     - `PLACE_LANDING_MIN_RESULTS - 1` 제외 · `PLACE_LANDING_MIN_RESULTS` 포함
     - 속성당 상한: 한 속성 후보 6+ 에서 5
     - 합산 상한: 국 20 + 영 10 후보(전부 같은 건수)에서 20, ko 먼저 — 1차 정렬이 건수라 「ko 먼저」는 건수가 같을 때만 성립한다
     - 동점은 코드 오름차순
     - 영문 `pet`·`barrier-free` 제외
     - Jaccard 0.5 초과 제외
     - Jaccard 는 입력 `ids` 로 센다: 30 id 두 묶음에서 k/(60−k) 가 Jaccard 상한을 넘는 최소 공유 수 k 를 상수로 계산 → 제외, k−1 → 포함
     - 기존 항목 유지: `previous` 에 있고 이번에 안 뽑힌 항목 → `retired: true` 로 남음 · 상한 계산에서 빠짐 · 다시 뽑히면 `retired` 해제·`selectedAt` 유지
     - 모집단 밖 코드 제외
   - 질의 인자: `category` 가 SIGHT_CATEGORIES.
   - `landingMeta`: 시도 약칭 포함(같은 「중구」 두 시도 → title 다름), N 없음 → 문장 없음, `asOf` 없음 → 꼬리 없음, 영문 형식.
   - 프리렌더 출력:
     - h1·문장·목록 30·형제 링크·지역 링크·canonical
     - 스위치 false → `noindex` 메타
     - N < 하한 → noindex
     - `retired` 항목 → noindex·sitemap·llms 제외, 파일은 생성
     - `retired`·N 미달 형제는 링크 안 됨
     - facet `null` + `totalElements` 12 → 문장에 12, N 판정 통과
     - 이스케이프(픽스처 이름에 `<script>` → 평문)
     - 모집단 밖 code 항목 → 파일 없음·경고
   - sitemap·llms: 스위치 false → 랜딩 0건. true → 목록 중 하한 이상만, lastmod = 표시 30건 `modifiedAt` 최댓값, hreflang 은 국·영 둘 다 있을 때만.
   - 품질 게이트(빌드 산출물 기준, 실패 시 빌드 실패): 목록 랜딩 간 title·description 중복 0.
   - 부분 실패: 랜딩 조회 하나 실패 + 다른 섹션 성공 → `PartialSeoFailure`.
   - 편집 페이지:
     - draft → noindex·띠·sitemap·llms 제외
     - published + 검수자 없음 → render-content 실패
     - published 0 → `guides/index.html` 없음
     - 카드 이스케이프(프리렌더 출력과 SPA 렌더 둘 다 — 픽스처 이름 `<script>` 가 평문)
     - 형식 위반: 표지와 `attractionIds` 가 둘 다 `1234567890123`(13자리 — 집합은 일치, 형식만 위반) → render-content 실패
     - 집합 불일치: 표지 `101`, `attractionIds: [101, 102]` → render-content 실패
     - 표지 변형(홑따옴표 `data-guide-card='101'`) → 출현 수 ≠ 형식 일치 수로 실패
     - published 카드 404 → 실패 메시지에 파일 경로와 id
     - `search-architecture` 계약 테스트 그대로 통과
   - SPA 랜딩(선례 `PlacePage.tracking.test.tsx` 의 `byAction`, 좌표 성공·거부 두 경우):
     - SEARCH trigger 열 = `['landing']`
     - 모든 SEARCH 가 같은 시도·시군구·속성
     - payload `landing` 필드
     - 조건 변경 뒤 주소·canonical 유지
     - 목록에 없는 조합 → NotFound
     - heading·sentence 가 같은 픽스처의 프리렌더 출력과 일치
     - 프리셋 질의 인자 `sigunguCode` 가 3자리(`code.slice(2)`)
     - 첫 결과 facet `null` 이어도 N = `totalElements` 로 표시, 결과 전에는 noindex
     - `retired` 항목 → 화면은 그리고 noindex
   - SPA 편집: `/guides/:slug` 렌더, draft 띠·noindex, 없는 slug → NotFound.
   - 문체: guides/*.md 마다 `python3 scripts/lint-blog-post.py --body-only` 종료 코드 0(python3 가 없으면 skip — 통과로 세지 않는다).
2. nginx 계약: `portal-fe/scripts/check-nginx-place-landings.sh` — `check-nginx-legacy-regions.sh` 와 같은 방식(실제 nginx:1.27-alpine, 도커가 없으면 exit 2)이다. 픽스처 dist 에서 다음을 확인한다.
   - `/regions/11110/parking`(파일 있음) 200·프리렌더 본문
   - `/regions/11110/foo`·`/en/regions/11110/pet`·`/regions/99999/parking` 404
   - `/regions/11110` 은 기존대로 200
   - `/regions/29110` 은 기존 301
   - `/regions/29110/parking`·`/en/regions/46230/free` 301 → 시도 허브(`/regions/12`·`/en/regions/12`)
   - `/guides/x`(있음) 200, `/guides/none` 404
   - `/guides`(index 없음) 404
   실행 시점: CI·훅에 걸지 않는다(선례 두 스크립트도 수동 실행이다). 태스크 검증 단계에서 사람이 돌리고 출력 전문을 `verifications/` 에 남긴다. exit 2(도커 없음)는 통과로 세지 않는다 — 그 경우 검증 미완료로 보고한다.
3. 회귀 주입(임시 사본) — 각각 빨강:
   - 하한 10→9(`landingDecisions.test.ts` 만 빨강 — 경계 테스트는 상수로 계산해 초록)
   - 선정 함수 비교 `>=` → `>`(경계 테스트가 빨강)
   - 속성당 상한 제거
   - 합산 상한 제거
   - 분류 필터 제거
   - 스위치 false 인데 noindex 제거
   - 랜딩 location 삭제(`location /` 가 받아 `/regions/11110/foo` 가 200 → 빨강)
   - 랜딩 location 을 지역 location 뒤로 이동
   - draft noindex 제거
   - published 게이트 제거
   - 프리셋을 effect 로 주입
   - 랜딩 조회를 가드 밖으로
   - 편집 원본에 금칙 표현 한 줄
   - 선정 스크립트가 `previous` 항목을 버림(기존 항목 유지 테스트가 빨강)
   - 후보 조립이 `count` 에 facet 건수를 실음(후보 조립의 `count` 테스트가 빨강)
   - SPA N 을 facet 건수로(facet `null` 픽스처에서 빨강)
   - 프리셋 `sigunguCode` 를 5자리로
   - SPA 카드를 이스케이프 없이 HTML 문자열에 이어 붙여 `dangerouslySetInnerHTML` 로(픽스처 `<script>` 가 요소로 생겨 SPA 이스케이프 테스트가 빨강)
   - 표지 id 형식 검사 제거(13자리 픽스처가 빨강)
4. 배포 뒤:
   - 목록 각 주소 200·`<!--seo:prerendered-->`·`noindex`(스위치 false)
   - 목록 밖 조합 404
   - place sitemap 에 `/regions/*/*` 0건(스위치 false)
   - 편집 초안 3장 200·noindex, `/guides` 404
   - 검수 표본(목록 전부): 표시 목록에서 3건씩 상세 응답의 해당 속성 값이 참인지(조건 정확성) — 결과를 `verifications/` 에 남긴다
   - Rich/Schema 검증은 해당 없음(구조화 데이터 추가 없음).

## Existing Code to Leverage
`prerender-seo.mjs:707-727,736,815,838-868,880-938,1098-1134,1159-1249`, `nginx.conf:121-132,192-216,232-235`, `App.tsx:265-266,296-303`, `RegionPage.tsx:111-150,116,167`, `PlacePage.tsx:330-348`, `AttractionSearchController.kt:44-74`, `SearchAttractionUseCase.kt:202-213`, `AdministrativeRegionController.kt:40-56`, `render-content.mjs`, `copy.mjs:541-547`, `placeAttributes.ts:37-58`., `PlacePage.tsx:339,434,455-480,590-645`, `PlacePage.tracking.test.tsx:99-103`, `nginx.conf:215-235`, `scripts/check-nginx-legacy-regions.sh`, `prerender-seo.mjs:139-150,241-250,388-406,1015-1017`, `copy.mjs:460-491,696,1316`, `render-content.mjs:17-18,144-182`, `scripts/lint-blog-post.py:141-158,368-386`, `AttractionSearchController.kt:107`, `search/glossary.md`. 문서 동기화(구현 때): `search/glossary.md` 에 「속성 랜딩」「편집 페이지(guide)」「프리셋」「색인 스위치」 네 행, `PlacePage.tsx:339` 주석을 「속성 칩 조작은 주소를 만들지 않는다 — 속성 주소는 `place-landings.json` 에 커밋된 랜딩뿐」으로. `AttractionSearchAdapter.kt:191-205,223`, `SearchAttractionUseCase.kt:189,194`, `placeApi.ts:332`, `nginx.conf:192,232,331`, `SearchArchitecturePage.tsx:50,62`, `render-content.mjs:8,140`, `lint-blog-post.py:339-365`, `docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-barrierfree-labels.md:40-55`

## Out of Scope
색인 스위치 켜기(ADR-0062 개정 승인 뒤 사용자), 편집 페이지 게시(검수 뒤 사용자), 속성 조합 랜딩, 정적 지도 이미지, ItemList 구조화 데이터, 영문 편집 페이지(D-1 ⓐ), 지역 페이지에서 랜딩으로 가는 링크(스위치를 켤 때 함께 — ADR-0062 §17 양방향 그래프).
