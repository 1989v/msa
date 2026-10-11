<!-- source: portal-fe/scripts/prerender-seo.mjs, portal-fe/nginx.conf, portal-fe/src/pages/place/AttractionPage.tsx, search/app/src/main/kotlin/com/kgd/search/application/attraction/service/AttractionPageService.kt, search/app/src/main/kotlin/com/kgd/search/presentation/render/controller/AttractionPageController.kt, search/app/src/main/kotlin/com/kgd/search/application/attraction/usecase/RenderAttractionPageUseCase.kt, search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt -->
# Specification: place 크롤 우선순위·색인 정리 (I1-1 · I1-3 · I2-6 · I3-3 + 랜딩 헤더 · 언어 어긋난 상세 주소)

> 2026-10-10 유입 플랜(`docs/plans/2026-10-10-place-search-inflow-plan.md`) 묶음 H2. Googlebot 의 place 상세 크롤은 하루 약 17건이고 sitemap 은 64,076 URL(허브 541 · 상세 62,984 · 행사 551)이다. Search Console 은 하위 sitemap 을 3~9일마다 읽는다. 크롤을 늘리는 것은 외부 신뢰의 몫이고, 이 스펙은 **받은 크롤을 어디에 쓰게 할지**와 **같은 문서가 두 주소로 나가는 것**만 다룬다. 열린 질문은 권고 기본값(`context/open-questions.yml`)으로 진행한다. 리뷰 심판 판정(`context/review-verdict.md`, REVISE 21 · MINOR 12)을 반영했다 — 사용자 판단 1~8 은 권고 기본값이고 확인 대기다(Q9~Q16).

## Goal
허브·지역·티어 A 상세를 sitemap 색인의 첫 파일로 모아 Search Console 에서 따로 잴 수 있게 한다. 시도·시군구마다 대표 상세가 허브에서 3클릭 안에 닿게 한다(전체 상세의 도달은 범위 밖 — 깊이 3 안의 티어 A 비율을 빌드 로그로 남긴다). 색인 스위치가 꺼진 랜딩은 헤더로도 noindex 를 낸다. 언어가 어긋난 상세 주소는 정규 주소로 301 한다.

## User Stories
- 크롤러로서, sitemap 색인의 첫 파일에서 본문·사진이 갖춰진 관광지와 허브·지역 페이지를 먼저 받는다.
- 크롤러로서, 허브 → 시도 → 시군구 → 대표 상세를 `<a href>` 만 따라 3클릭 안에 닿는다(JS 없이).
- 운영자로서, Search Console 의 sitemap 별 색인 수로 티어 A 와 나머지의 색인 비율을 따로 본다.
- 검색엔진으로서, `/en/attractions/{국문 id}` 를 다른 문서로 세지 않고 정규 주소 하나만 본다.

## Specific Requirements

### SR-1 핵심 sitemap 분리 (I1-1)
1. 티어 A 상세 = 지금 sitemap 에 실리는 상세(`placeDetailSitemapEntries` 의 개요·숙박 사진 조건) 중 `category ∈ SIGHT_CATEGORIES`(`copy.mjs:505`) · `imageUrl` 있음 · `googlePlaceId` 있음을 모두 만족하는 것이다. 근거는 운영 색인(2026-10-11, `attractions_20261010213013`, 행사 제외)이다:
   | 조건 | ko | en |
   |---|---|---|
   | 개요 있음 | 50,151 | 15,016 |
   | + 사진 | 42,400 | 13,672 |
   | + 사진 + place_id | 29,552 | 4,654 |
   | 관광 분류 + 개요 + 사진 | 17,107 | 2,088 |
   | **관광 분류 + 개요 + 사진 + place_id (티어 A)** | **16,969** | **2,031** |
   place_id 만으로는 가르지 못한다 — 사진·place_id 를 가진 ko 의 41%(12,060)가 쇼핑(유형 38)이다. 갈림은 분류가 만든다. 지역 페이지·허브 목록이 이미 같은 관광 분류만 보이므로(`RegionPage.tsx:117`) 기준이 하나로 맞는다.
2. `indexDoc` 은 판정에 필요한 `category`·`hasGooglePlaceId`(불리언 — 값은 싣지 않는다)를 더 싣는다. 판정은 순수 함수 `isTierA(doc)` 하나가 한다.
   - `hasGooglePlaceId = Boolean(a.googlePlaceId?.trim())` — 짝 판정(`AlternateLanguagePairer.kt:41` `isNullOrBlank()`)과 같은 기준이다. 사진도 공백뿐이면 없음으로 본다(지금 `indexDoc` 은 `a.imageUrl ?? null` 이라 `''` 이 그대로 실린다, `prerender-seo.mjs:1126`).
   - 조건은 `hasOverview` 를 먼저 본다(개요 없는 문서는 `indexDoc` 이 `{ id, hasOverview: false }` 만 싣는다).
   - 빌드 로그에 `core 티어 A {n}건`(언어별)을 남긴다. 상세 ≥ 10,000 인데 티어 A = 0이면 수신 필드가 빠진 것으로 보고 `PartialSeoFailure` 로 빌드를 세운다(Q16 — `SearchAttractionUseCase.kt:104` 에 필드는 있지만 빌드 쪽 수신을 보는 테스트가 없다).
3. 파일 구성: `sitemap-places-core.xml` = 허브 항목(허브·지역·색인 켜진 랜딩·게시된 편집 페이지) + 티어 A 상세. `sitemap-places-{n}.xml` = 나머지 상세. 색인(`sitemap.xml`)의 순서는 core → 나머지 → 행사(`PLACE_EVENT_SITEMAP`). `sitemap-places-hub.xml` 은 더 만들지 않는다.
   불변식: core 상세 ∪ 나머지 = `placeDetailSitemapEntries` 출력이고 둘은 서로소다. 모든 urlset 의 `<loc>` 멀티셋 = 입력 허브 ∪ 상세, 중복 0이다(core-2 가 생길 때도 같다).
4. core 가 `SITEMAP_CHUNK`(20,000)를 넘으면 넘는 부분은 `sitemap-places-core-2.xml`… 로 이어 쓰고 색인에서 core 다음에 둔다. 지금 약 19,540(541 + 19,000)으로 상한에 가깝다. 빌드를 세우지 않는다.
5. 상세 항목의 `lastmod` = `contentUpdatedAt` 의 날짜 부분(KST 문자열 앞 10자) → 없으면 지금 규칙(`isoDate(modifiedAt)`) → 둘 다 없으면 비운다. 빌드일로 대신 적지 않는다(`prerender-seo.mjs:1129`). 앞 10자가 `^\d{4}-\d{2}-\d{2}$` 가 아니면 `contentUpdatedAt` 을 없는 것으로 보고 `modifiedAt` 규칙으로 넘긴다(원천은 `LocalDateTime?` 직렬화 문자열, `SearchAttractionUseCase.kt:116`). `isoDate` 를 쓰지 않는 이유: `new Date(value).toISOString()`(`:736-738`)은 KST 자정 근처 시각을 UTC 로 바꿔 하루 앞 날짜를 낸다. 운영 색인에서 `contentUpdatedAt` 은 ko 3,920 · en 222건에만 있고 티어 A 에는 아직 0건이다 — 이 규칙은 본문 수집이 돌수록 효과가 난다.
6. 상세가 0건이면 지금처럼 `sitemap.xml` urlset 하나만 낸다(`placeSitemapFiles` 의 기존 분기).

### SR-2 내부 링크 깊이 (I1-3)
1. 지금 경로(운영 확인): 허브 → 시도 전부·관광지 60곳, 시도 → 시군구·대표 10곳, **시군구 → 상세 링크 0개**(`placeDetailPages` 가 시군구 대표를 비운다 — 검색 응답에 시군구 축이 없다), 상세 SSR → 시도·시군구와 「같은 분류 가까운 곳」·「비슷한 곳」·「여기 온 사람들이 함께 간 곳」 절(합쳐 최대 13곳, `AttractionPageRenderer.kt:715,785,804`). 그래서 시도 대표에 못 든 상세는 허브에서 3클릭 안에 닿지 않는다.
2. 지역 프리렌더의 시군구 페이지에 대표 관광지 최대 10곳을 싣는다. 재료는 빌드 때 시군구마다 `GET /api/search/attractions?lang&sidoCode&sigunguCode={3자리}&category=SIGHT_CATEGORIES&size=30` 1회다(SPA `RegionPage.tsx:113-121` 과 같은 질의, 크기만 30). 받은 30건을 `places[lang]` 의 id 집합(`indexDoc` 결과)으로 걸러 티어 A 먼저 → 개요 있는 문서 순으로 10개를 고른다. 개요 없는 문서는 넣지 않는다 — 시도 대표가 이미 `hasOverview` 로 거른다(`regionTopCandidates`, `prerender-seo.mjs:1289-1292`). 약 505회가 늘고 동시성 4로 돈다.
3. 이 조회는 `fetched/failed` 부분 실패 가드 안이다(섹션 `place-region-tops`). 실패하면 그 섹션 실패로 빌드가 서는 것은 기존 규칙(`PartialSeoFailure`)을 따른다.
   - `getJson` 은 15초 타임아웃만 있고 재시도가 없다(`prerender-seo.mjs:398-405`). 505회 중 하나만 실패해도 섹션 실패라 빌드가 서므로(`:368`) `regionTops` 는 호출마다 백오프 재시도 1~2회(예: 0.5초 → 1초)를 한다. 공용 `getJson` 은 바꾸지 않는다.
   - 지역 색인(`places`) 섹션이 성공했을 때만 부른다(`fetched.includes('places')` 안, 랜딩 조회 `:298` 과 같은 자리) — 걸러 낼 id 집합이 그 결과다.
   - 예상 소요(추정): 505회 ÷ 동시성 4 ≈ 127 회차 × 응답 0.2~0.5초 ≈ 30~65초 증가(재시도 제외). 빌드 로그에 실제 소요를 남긴다.
4. 시군구 페이지는 같은 시군구의 속성 랜딩 중 `indexed` 인 것만 링크한다. 스위치가 꺼진 지금은 0개다(ADR-0062 §17 양방향 그래프는 스위치를 켤 때 함께 — longtail 스펙 Out of Scope 를 여기서 조건부로 구현).
5. SPA `RegionPage` 는 이미 대표 12곳을 `<Link>` 로 보인다. 랜딩 링크는 **스위치를 켤 때로 미룬다**(Q12). 지금 스위치가 꺼져 있어 양쪽 다 0개이고, 공용 판정 함수가 없다 — 프리렌더(`prerender-seo.mjs:1478,1482,1493`)와 SPA(`PlacePage.tsx:731`)가 각자 인라인으로 판정하고, `RegionPage` 는 하한 판정에 필요한 랜딩별 count 를 갖지 않는다. 켤 때 `landingIndexed` 공용 함수와 count 출처를 함께 정한다.
6. 상세 SSR 의 링크 절(브레드크럼의 시도·시군구, 「같은 분류 가까운 곳」·「비슷한 곳」·「여기 온 사람들이 함께 간 곳」)은 이미 있으므로 바꾸지 않는다.

### SR-3 llms.txt (I3-3)
1. 이미 구현돼 있다(longtail 스펙 G1): `placeLlmsTxt` 가 `indexed` 인 랜딩·게시된 편집 페이지만 싣고(`prerender-seo.mjs:2294-2297`), 테스트가 있다(`prerenderPlaceLandings.test.ts:185-189`, `prerenderGuides.test.ts:57,73`). 운영 `place.1989v.com/llms.txt` 에 `/regions/`·`/guides` 줄은 0이다.
2. 이 스펙은 코드를 바꾸지 않고 회귀 주입 목록에만 넣는다.

### SR-4 noindex 페이지의 `X-Robots-Tag` 헤더
1. 지금 랜딩은 200 + `<meta name="robots" content="noindex, follow">` 뿐이고 헤더는 없다(`$host_robots_tag` 가 place 에 빈 값, 운영 `/regions/11110/free` 확인).
2. 프리렌더가 `indexed: false` 인 랜딩·편집 초안 파일을 `prerender/_noindex/` 아래 같은 경로로 쓴다. `indexed: true` 는 지금 자리 그대로다. 판단은 프리렌더 한 곳에만 있다 — nginx 는 스위치를 모른다.
3. nginx 랜딩·편집 location 은 `try_files {지금 경로} @place_noindex;` 로 바꾸고, `location @place_noindex { add_header Cache-Control "no-cache, must-revalidate"; add_header X-Robots-Tag "noindex, follow" always; try_files /prerender/_noindex$uri.html =404; }`. 없는 조합은 지금처럼 404 다. 영문은 `$uri` 가 `/en/…` 이므로 파일이 `prerender/_noindex/en/regions/…` 다.
   `_noindex` 파일을 직접 경로로 받지 못하게 `location ^~ /prerender/_noindex/ { internal; }` 를 둔다 — 지금은 `location ~* \.html$`(`nginx.conf:400`)가 `/prerender/….html` 직접 요청을 `$host_robots_tag`(place 는 빈 값)로 내보낸다. 계약: 직접 경로 404.
4. 스위치를 켜면 파일이 원래 자리로 가서 헤더가 저절로 사라진다. 은퇴·하한 미달 랜딩은 켠 뒤에도 헤더가 남는다(메타와 같은 규칙). 스위치를 켜는 커밋의 확인 항목으로 「`curl -sI https://place.1989v.com/regions/{indexed 랜딩}` 에 `x-robots-tag` 없음」을 넘긴다(그 커밋은 이 스펙 범위 밖이다).
5. 편집 목록 `/guides` 는 게시본만 있으므로 바꾸지 않는다.

### SR-5 언어가 어긋난 상세 주소
1. 지금(운영 확인): `/en/attractions/1`(국문 문서)과 `/attractions/21`(영문 문서)이 둘 다 200 SSR 이고, canonical 은 문서 언어 쪽을 가리킨다(`/attractions/1`, `/en/attractions/21`). 같은 문서가 두 주소로 200 이다.
2. `AttractionPageService.render` 는 찾은 문서의 `lang` 이 경로 언어와 다르면 이동 결과를 낸다. 조회는 지금처럼 한 번이다.
   - **비교는 정규화 뒤에 한다**: 렌더러와 같이 en 외는 ko 로 본다(`AttractionPageRenderer.kt:56` `if (doc.lang == EN) EN else KO`). `lang="xx"` 문서는 ko 로 보아 국문 경로에서 이동하지 않는다 — 정규화 없이 비교하면 어느 경로에서도 「어긋남」이 되어 301 루프가 된다.
   - **모양**: `Page.Redirect(val docLang: String, val id: String)` 는 사실(정규화된 문서 언어 + id)만 싣는다. 지금 `sealed interface Page { val html: String }`(`RenderAttractionPageUseCase.kt:23-24`)이므로 `html` 은 렌더된 변형(`Found`·`NotFound`·`Fallback`) 쪽으로 내린다. 본문 없음을 빈 문자열 관례로 두지 않는다.
   - **경로 함수**: 렌더 포트 `AttractionPageRenderPort` 에 `canonicalPath(lang, id)` 를 열고, 렌더러의 `attractionPath`(`AttractionPageRenderer.kt:844`, 지금 private) — canonical 을 만드는 그 함수 — 를 쓴다. 서비스·컨트롤러가 경로 문자열을 따로 조립하지 않는다.
   - **행선**: 문서 자신의 canonical 이다. 영문 짝(`alternateId`, `SearchAttractionUseCase.kt:173`)이 있어도 짝으로 보내지 않는다(Q9) — 지금까지의 canonical 신호와 같고 짝 스위치가 꺼져 있다. 행사 문서도 같은 규칙이다(Q15).
   - **응답**: 컨트롤러는 **301** + `Location: {canonicalPath}`(경로만, 호스트 없음)로 응답하고 본문·ETag 를 싣지 않는다. `Cache-Control: no-cache, must-revalidate` 는 301 에도 단다(`AttractionPageController.kt:46` 의 모든 응답 규칙) — 빠지면 브라우저·CDN 이 301 을 영구 캐시해 언어 판정을 고쳐도 되돌릴 수 없다. Location 의 id 는 컨트롤러가 이미 검증한 `query.id`(`Regex("\\d{1,12}")`, `:59`)다.
3. nginx 상세 location 은 그대로다 — `error_page` 가 500~504 만 가로채므로 301 은 그대로 나간다. 배포 뒤 운영에서 확인한다.
4. SPA `AttractionPage` 는 받은 문서의 `lang` 을 같은 규칙(en 외 = ko)으로 정규화해 라우트 언어와 다르면 `<Navigate replace>` 로 문서 언어 경로로 옮긴다(클라이언트 이동으로 들어온 경우). 이때 `location.search`·`location.hash` 를 보존한다. 지금 `docLang = attraction?.lang ?? lang`(`AttractionPage.tsx:158`)은 정규화가 없다.
5. 쿼리 손실: nginx 상세 location 은 `proxy_pass …/${render_lang}attractions/$render_id`(`nginx.conf:234`)로 쿼리를 넘기지 않으므로 서버 301 의 Location 에는 UTM 이 없다. 이 손실은 감수한다(Q10) — 어긋난 주소에 UTM 을 단 링크는 드물고, nginx 에서 쿼리를 붙이면 검증 경로가 하나 는다.
6. 404 를 고르지 않는 이유: 이미 canonical 이 정규 주소를 가리켜 왔고, 밖에서 걸린 링크가 있으면 301 이 그 신호를 정규 주소로 넘긴다.

### SR-6 1989v 서비스 간 맥락 링크 (I2-6)
1. 현황(운영 확인): apex·blog·rank·deal 프리렌더는 모두 바닥글 `SITE_LINKS` 로 place 루트 하나에 링크한다. 블로그 글 13편은 전부 기술 글이라 관광지와 맥락이 맞는 글이 없다. rank 보드는 오피넷 지역 코드라 place 지역과 짝이 없다. deal 은 관광과 무관하다.
2. 추가는 하나다: apex 홈 프리렌더(`renderPortalPages`)의 서비스 소개에서 place 항목 옆에 「서울 가볼 만한 곳」 → `https://place.1989v.com/regions/11` 링크. 홈 카드 디스펜서가 서울 관광지를 보이므로(`ServiceShowcase.tsx:148`) 맥락이 같다.
3. 블로그 → 관광지 링크는 데이터 스토리 글(H6, `docs/specs/2026-10-10-place-stories/`)이 본문에 갖는다.

### SR-7 검증
1. vitest(대상 함수 출력으로 판정):
   - `isTierA`: 분류·사진·place_id 하나씩 빠진 픽스처 → false, place_id·사진이 `''`·`'  '` → false, 다 갖춘 것 → true
   - `placeSitemapFiles`: 색인 첫 `<loc>` 이 core, 행사가 마지막, `sitemap-places-hub.xml` 없음
   - 티어 A 가 core 에만 있고 나머지 파일에 없음, 허브 항목이 core 에 있음
   - 집합 동일성: 모든 urlset `<loc>` 멀티셋 = 입력 hub ∪ detail, 중복 0(core-2 · 상세 0건 픽스처 포함)
   - core 가 `SITEMAP_CHUNK + 1` 이면 `sitemap-places-core-2.xml` 이 생기고 색인에서 core 바로 다음
   - lastmod: `contentUpdatedAt` 있으면 그 날짜(KST 자정 직후 시각 + `TZ=Asia/Seoul` 로 고정), 날짜 형식이 아니면 `modifiedAt`, 없으면 `modifiedAt`, 둘 다 없으면 없음
   - 티어 A 0건 게이트: 상세 ≥ 10,000 · 티어 A 0 → `PartialSeoFailure`
   - 시군구 프리렌더에 대표 상세 `<a href="/attractions/{id}">` 가 있고 질의 인자에 `category`·3자리 `sigunguCode`, 개요 없는 문서는 제외, 티어 A 가 먼저
   - 링크 그래프 깊이: 픽스처 허브에서 `<a href>` 만 따라 BFS — 시도·시군구 대표는 깊이 3 안. 빌드 로그 「티어 A 중 깊이 3 안 N/M」
   - `regionTops` 재시도: 첫 호출 실패 · 둘째 성공 → 섹션 성공
   - 스위치 false → 시군구 페이지에 랜딩 링크 0, `indexed` 랜딩 픽스처 → 링크 있음
   - `indexed: false` 랜딩·초안의 출력 경로가 `prerender/_noindex/…`
   - SPA: 어긋난 언어 문서 → `Navigate` 로 문서 언어 경로(search·hash 보존), 같은 언어 → 그대로, `lang="xx"` 문서 + 국문 라우트 → 이동 없음, 상세 fetch 1회
   - apex 홈 프리렌더에 `/regions/11` 링크
2. Kotest(`AttractionPageServiceTest`·`AttractionPageControllerTest`): 경로 ko + 문서 en → 301 · `Location: /en/attractions/{id}`, 반대도 같음, 같은 언어 → 200, 없는 id → 404 그대로. 더해서(given):
   - 숫자 아닌 id → 404 그대로(조회 0회)
   - 짝(`alternateId`) 있는 국문 문서를 영문 경로로 → 301 행선은 문서 자신의 `/attractions/{id}`(짝 아님)
   - 조회 실패(Fallback) → 200 셸 그대로, 301 아님
   - 행사 문서 언어 어긋남 → 301(상세와 같은 규칙)
   - `lang="xx"` 문서 + 국문 경로 → 200(이동 없음)
   - 301 응답: `Cache-Control: no-cache, must-revalidate` 있음 · ETag 없음 · 본문 없음 · `Location` 이 `^/(en/)?attractions/\d{1,12}$`
   - 기존 두 케이스 교체: 영문 경로 국문 문서 → 200 본문(`AttractionPageControllerTest.kt:67-76`)은 301 단언으로, 국·영 경로 ETag 동일(`:186-191`)은 같은 언어 경로의 ETag 유지 단언으로
3. nginx 계약(`scripts/check-nginx-place-landings.sh` 증보, 실제 nginx:1.27-alpine): `indexed` 랜딩 200·`X-Robots-Tag` 없음 · `_noindex` 랜딩 200·`noindex, follow` · 초안 편집 같은 것 · 없는 조합 404 · sitemap 이름 `sitemap-places-core.xml` 200 · 영문 `_noindex` 랜딩 같은 것 · `/prerender/_noindex/…html` 직접 경로 404 · 같은 URL 에서 파일 위치만 바꿔(원래 자리 ↔ `_noindex`) 헤더 유무가 따라 바뀜, 양쪽에 다 있으면 원래 자리가 이김. 픽스처 파일 경로는 프리렌더의 `path` 공식(`prerender/_noindex${pathname}.html`)으로 만든다. 도커가 없으면 exit 2 이고 통과로 세지 않는다.
4. 회귀 주입(임시 사본, 각각 빨강): 티어 A 분류 조건 제거 · lastmod 가 `contentUpdatedAt` 무시 · 색인에서 core 를 뒤로 · 시군구 대표 제거 · 스위치 false 인데 랜딩 링크 · noindex 파일을 원래 자리에 씀 · named location 헤더 삭제 · 서비스가 언어 비교 생략 · SPA `Navigate` 제거 · llms 가 `indexed` 필터 생략(SR-3) · 나머지 상세 일부 버림 · 티어 A 를 core·나머지 양쪽에 기록 · `contentUpdatedAt` 을 `isoDate` 로 · 언어 정규화 생략 · 301 에서 `Cache-Control` 누락 · 티어 A 의 사진·place_id 조건 제거 · SR-6 홈 링크 제거 · 301 → 302 · `Location` 에 호스트 포함 · 시군구 대표 질의에서 `category` 누락. 도커가 없으면 「named location 헤더 삭제」는 「미확인」으로 기록한다.

### SR-8 크롤 효과 판정 (사용자 판단 5, Q13)
1. 선행: I0-6(봇 일 집계, 플랜 `2026-10-10-place-search-inflow-plan.md:38`) 배포. 그 집계는 경로 유형을 `detail` 하나로 접으므로(`2026-10-10-place-inflow-measurement/spec.md:49`) 티어 A 와 나머지를 가르는 것은 아래 ②의 1회 대조가 한다.
2. ① 배포 전 기준선: Googlebot × `detail` × 일 합계 7일치(지금 하루 ~17). 배포 전에 못 뜨면 그 칸은 「미확인」으로 기록한다.
   ② 배포 전후 48시간 접근 로그 1회 대조: Googlebot `/attractions/{id}` 요청 id 와 `sitemap-places-core.xml` `<loc>` 의 교집합 비율(무작위 기준치 약 30% = 19k/63k).
   ③ 같은 로그에서 `sitemap-places-core.xml` 과 `sitemap-places-{n}.xml` 파일별 Googlebot 수신 횟수.
3. 판정: 4주 뒤 ①이 기준선 이상이고 ②가 기준치보다 높으면 「효과 있음」, 아니면 Q1 을 다시 연다. 결과는 `verifications/crawl-effect.md`.

## Dependencies
- SR-8 은 I0-6(봇 일 집계) 배포가 선행한다. SR-1~SR-7 은 독립이다.

## Existing Code to Leverage
`prerender-seo.mjs:264-330(섹션 가드),555-580(SITE_LINKS),734-990(sitemap),1060-1140(indexDoc),1285-1395(지역 프리렌더),1465-1600(랜딩),1644-1740(편집),2089(apex),2293-2310(llms)`, `nginx.conf:8-12,131-135,230-300`, `scripts/check-nginx-place-landings.sh`, `RegionPage.tsx:111-125,240-280`, `AttractionPage.tsx:156-170`, `AttractionPageService.kt:25-41`, `RenderAttractionPageUseCase.kt:23-31`, `AttractionPagePorts.kt`(렌더 포트), `AttractionPageRenderer.kt:56,844`, `AttractionPageController.kt:29-59`, `AttractionPageControllerTest.kt:67-76,186-191`, `prerenderPlace.test.ts:300-310`, `copy.mjs:505,1615`.

## Out of Scope
크롤 수 자체를 늘리는 일(외부 링크·제출은 플랜 0·2단계), 빈약 상세 noindex(I1-2 — GSC 실적 뒤), 랜딩 색인 스위치·hreflang 켜기(사용자), 검색 응답에 시군구 코드를 싣는 백엔드 변경(Q5), rank·deal·blog 기존 글의 place 링크, 상세 SSR 링크 절 변경, 지역 페이지 lastmod, 전체 상세의 3클릭 도달(정적 목록 페이지네이션 — Q11), SPA `RegionPage` 랜딩 링크(스위치를 켤 때 — Q12), 301 Location 의 쿼리(UTM) 보존(Q10), `_noindex` 밖 `/prerender/*.html` 직접 경로 노출(이 스펙 이전부터 있던 문제 — `_noindex` 만 막는다), 봇 집계의 경로 유형을 티어로 가르는 변경.

## Open Questions
`context/open-questions.yml` Q1~Q8(설계 단계, 권고 기본값) · Q9~Q16(심판 판정의 사용자 판단 1~8, `answered-default` — 권고 기본값으로 반영했고 사용자 확인 대기).
