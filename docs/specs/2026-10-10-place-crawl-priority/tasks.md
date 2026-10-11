# Task Breakdown: place 크롤 우선순위·색인 정리

## Overview
Total Task Groups: 5. 정본은 `spec.md`. 열린 질문은 `context/open-questions.yml` 권고 기본값을 따른다(Q9~Q16 은 심판 판정의 사용자 판단, 권고 기본값으로 반영 · 확인 대기). 심판 판정은 `context/review-verdict.md`.
같은 파일을 고치는 그룹은 순서대로 한다 — `prerender-seo.mjs`(TG1 → TG2 → TG3), `nginx.conf`(TG3). TG4(search)는 독립이다.
테스트는 바꾼 파일만 지정해 돌린다(전체 스위트 금지 규칙). 사용자 몫: 배포 뒤 Search Console 에서 sitemap 별 색인 수 확인(Q7 하위 sitemap 개별 제출 여부 포함, Q14 core 필터 확인).
외부 선행: SR-8(크롤 효과 판정)은 I0-6(봇 일 집계) 배포가 선행한다 — TG5.6.

### Task Group 1: 핵심 sitemap 분리 (SR-1)
**Dependencies:** None · **Phase:** portal-fe `scripts`·`src/seo` · **Required Skills:** JS(ESM), vitest
- [x] 1.1 테스트 먼저 — `portal-fe/src/seo/__tests__/prerenderPlace.test.ts` 증보
  - `isTierA`: 분류·사진·place_id 를 하나씩 뺀 픽스처 false, place_id·사진이 `''`·`'  '` 인 픽스처 false, 다 갖춘 것 true, 개요 없는 문서 false
  - `placeSitemapFiles`: 색인 순서 core → `sitemap-places-1.xml`… → `sitemap-places-events.xml`, `sitemap-places-hub.xml` 없음(기존 단언 `:304-305` 교체)
  - 티어 A 상세는 core 에만, 허브 항목은 core 에, 나머지 상세는 core 에 없음
  - 집합 동일성: 모든 urlset `<loc>` 멀티셋 = 입력 hub ∪ detail, 중복 0 — core-2 가 생기는 픽스처와 상세 0건 픽스처에서도
  - core 가 `SITEMAP_CHUNK + 1` → `sitemap-places-core-2.xml` 생성, 색인에서 core 바로 다음
  - lastmod: `contentUpdatedAt: '2026-10-09T00:30:00'` → `2026-10-09`(날짜 부분). 테스트는 `TZ=Asia/Seoul` 로 고정한다 — `isoDate` 경로로 잘못 가면 `2026-10-08` 이 나와 갈린다(`prerender-seo.mjs:736-738` 이 UTC 로 바꾼다). 앞 10자가 날짜 형식이 아닌 값(픽스처 1건) → `modifiedAt` 규칙, 없으면 `modifiedAt` 규칙, 둘 다 없으면 `<lastmod>` 없음
  - 티어 A 0건 게이트: 상세 10,000건 · 티어 A 0 → `PartialSeoFailure`, 상세 9,999건 · 티어 A 0 → 통과
  - 상세 0건 → `sitemap.xml` urlset 하나(기존 분기 유지)
- [x] 1.2 `indexDoc` 에 `category`·`hasGooglePlaceId = Boolean(a.googlePlaceId?.trim())` 추가, 공백뿐인 `imageUrl` 은 null 로, `export function isTierA(doc)`(`hasOverview` 먼저) — `SIGHT_CATEGORIES` 는 `copy.mjs` 에서 import(리터럴 재정의 금지). 빌드 로그 `core 티어 A {n}건` + 0건 게이트(SR-1.2)
- [x] 1.3 `placeDetailSitemapEntries` 가 항목에 `tierA` 표지를 달고 lastmod 규칙(SR-1.5 — 앞 10자 날짜 형식 검사, `isoDate` 를 거치지 않음) 적용
- [x] 1.4 `placeSitemapFiles(hubEntries, detailEntries)` 를 core/나머지로 가르기, `writeRobotsAndSitemaps` 호출부는 그대로. `SITEMAP_CHUNK`(`prerender-seo.mjs:943`, 지금 export 없음)를 export 하거나 `placeSitemapFiles(hub, detail, chunk = SITEMAP_CHUNK)` 로 인자를 받아(기본값 유지) 테스트가 상한 경계를 만든다
- [x] 1.5 `nginx.conf:129` 주석의 파일 이름 예시를 core 기준으로 고침(동작 변화 없음)
- [x] 1.6 검증: `cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlace.test.ts`

### Task Group 2: 내부 링크 깊이 (SR-2)
**Dependencies:** TG1 · **Phase:** portal-fe `scripts`·`src/pages/place` · **Required Skills:** JS(ESM), React, vitest
- [x] 2.1 테스트 먼저
  - `prerenderPlace.test.ts`: 시군구 페이지에 대표 `<a href="/attractions/{id}">` 최대 10개, 주입한 `get` 이 받은 질의에 `category=nature,history,culture,leisure` · 3자리 `sigunguCode` · `size=30`. 응답 30건 중 `places[lang]` 에 없는 id · 개요 없는 문서는 빠지고 티어 A 가 먼저
  - 링크 그래프 깊이: 픽스처 허브·시도·시군구 HTML 에서 `<a href>` 만 따라 BFS → 시군구 대표가 깊이 3 안. 빌드 로그 「티어 A 중 깊이 3 안 N/M」 출력
  - 시도 페이지는 지금 출력 그대로(대표 10)
  - 스위치 false → 시군구 페이지 랜딩 링크 0, `indexed: true` 랜딩 픽스처 → 그 시군구 페이지에만 링크
  - 시군구 대표 조회 하나가 재시도까지 실패 → `failed` 에 `place-region-tops`, 다른 섹션 성공 → `PartialSeoFailure`. 첫 시도 실패 · 재시도 성공 → 섹션 성공
  - `places` 섹션 실패 → `regionTops` 호출 0회
- [x] 2.2 `defaultSeoLoaders` 에 `regionTops(regions)`(동시성 4, size 30, 호출마다 백오프 재시도 1~2회 — 공용 `getJson` 은 그대로) 추가, `fetchSeoSections` 의 `fetched.includes('places')` 안(랜딩 조회 `:298` 과 같은 자리)에서 섹션 `place-region-tops` 가드로 호출. 실제 소요를 로그로
- [x] 2.3 `placeDetailPages` 가 시군구 대표(`places[lang]` id 로 걸러 티어 A → 개요 있음 순 10개)·`indexed` 랜딩을 `renderRegionDetail` 로 넘김. 랜딩 페이지 계산(`placeLandingPages`)이 지역 페이지보다 먼저 끝나도록 호출 순서 확인
- [x] 2.4 ~~`RegionPage.tsx` 에 `indexed` 랜딩 링크~~ — 스위치를 켤 때로 미룬다(SR-2.5, Q12). 공용 판정 함수가 없고(`prerender-seo.mjs:1478,1482,1493` · `PlacePage.tsx:731` 각자 인라인) `RegionPage` 는 랜딩별 count 가 없다. 이 그룹에서는 `RegionPage.tsx` 를 바꾸지 않는다
- [x] 2.5 검증: `cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlace.test.ts`

### Task Group 3: noindex 헤더 · 서비스 간 링크 (SR-4 · SR-6)
**Dependencies:** TG2 · **Phase:** portal-fe `scripts`·`nginx.conf` · **Required Skills:** JS(ESM), nginx, bash
- [x] 3.1 테스트 먼저
  - `prerenderPlaceLandings.test.ts`: 스위치 false → 모든 랜딩 `path` 가 `prerender/_noindex/regions/…`, true + 하한 이상 → `prerender/regions/…`, 은퇴 → `_noindex`. 영문은 `prerender/_noindex/en/regions/11110/free.html`. 공식 단언: 모든 랜딩·편집 `path === \`prerender/_noindex${pathname}.html\``(국·영) — nginx `try_files /prerender/_noindex$uri.html` 과 같은 식
  - `prerenderGuides.test.ts`: draft → `prerender/_noindex/guides/{slug}.html`, published → `prerender/guides/{slug}.html`
  - 새 `src/seo/__tests__/prerenderPortalHome.test.ts`: apex 홈 본문에 `https://place.1989v.com/regions/11` 링크 1개(`renderPortalPages` 는 export 되지 않아 홈 본문 조립만 순수 함수로 꺼내 export — 기존 출력 동일, `footerLinksGolden.test.ts` 그대로 통과). 함수를 꺼내기 전후 홈 HTML 바이트를 비교해 링크 한 줄 외 차이 0을 증거로 남긴다
  - `scripts/check-nginx-place-landings.sh` 증보: `indexed` 랜딩 200·`X-Robots-Tag` 없음, `_noindex` 랜딩 200·`noindex, follow`(국문·영문 `/en/regions/11110/free`), 초안 편집 같은 것, 없는 조합 404, `/sitemap-places-core.xml` 200, `/prerender/_noindex/regions/11110/free.html` 직접 경로 404. 지금 스크립트는 손으로 만든 고정 파일이다(`:44-49`) — 픽스처 파일 경로를 `prerender/_noindex${pathname}.html` 공식으로 만든다. 같은 URL 에서 파일 위치만 바꿔(원래 자리 → `_noindex` → 양쪽) 헤더 유무가 따라 바뀌고, 양쪽에 다 있으면 원래 자리가 이김(헤더 없음)
- [x] 3.2 `placeLandingPages`·`placeGuidePages` 의 `path` 를 `indexed` 로 가름(판단은 이미 있는 `indexed` 하나)
- [x] 3.3 `nginx.conf` 랜딩·편집 location `try_files … @place_noindex`, `location @place_noindex`(SR-4.3), `location ^~ /prerender/_noindex/ { internal; }` 추가
- [x] 3.4 `renderPortalPages` 홈 본문 place 항목에 서울 지역 링크(SR-6.2)
- [x] 3.5 검증: `cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlaceLandings.test.ts src/seo/__tests__/prerenderGuides.test.ts src/seo/__tests__/prerenderPortalHome.test.ts src/seo/__tests__/footerLinksGolden.test.ts && bash scripts/check-nginx-place-landings.sh` (exit 2 는 미완료로 보고, 출력 전문을 `verifications/nginx-contract.md` 에)

### Task Group 4: 언어가 어긋난 상세 주소 301 (SR-5)
**Dependencies:** None · **Phase:** search `application`·`presentation`, portal-fe `pages/place` · **Required Skills:** Kotlin, Kotest BehaviorSpec + MockK, React, vitest
- [ ] 4.1 테스트 먼저
  - `AttractionPageServiceTest`: 경로 ko + 문서 en → `Page.Redirect("en", id)`, 경로 en + 문서 ko → `Page.Redirect("ko", id)`, 같은 언어 → Found, 없음 → NotFound, 조회 1회. 더해서 `lang="xx"` 문서 + 경로 ko → Found(정규화), 짝(`alternateId`) 있는 문서 → Redirect id 는 문서 자신의 id, 행사 문서 어긋남 → Redirect, 조회 실패 → Fallback(Redirect 아님)
  - `AttractionPageControllerTest`: 이동 결과 → 301, `Location` 이 `^/(en/)?attractions/\d{1,12}$`(경로만, 렌더 포트 `canonicalPath` 출력), 본문 비움, ETag 없음, `Cache-Control: no-cache, must-revalidate` 있음. 숫자 아닌 id → 404 그대로
  - **기존 테스트 교체**: `AttractionPageControllerTest.kt:67-76`(영문 경로로 국문 문서 → 200 본문·canonical)은 301 · Location · ETag 없음 단언으로, `:186-191`(국·영 경로 ETag 동일)은 같은 언어 경로에서 ETag 유지 단언으로 바꾼다 — 둘 다 SR-5 와 정면으로 충돌해 그대로 두면 빨강이다
  - `AttractionPage.test.tsx`: 라우트 en + 문서 ko → `/attractions/{id}` 로 replace 이동(search·hash 보존), 같은 언어는 이동 없음, `lang="xx"` 문서 + 국문 라우트 → 이동 없음. 쿼리 키가 `['attraction', id]`(`AttractionPage.tsx:126`)이라 언어가 바뀌어도 다시 받지 않는다 — 상세 fetch 1회를 단언
- [ ] 4.2 `RenderAttractionPageUseCase.Page` 에 `Redirect(docLang, id)`(사실만, `html` 없음) 추가 — `val html` 을 `Page` 에서 렌더된 변형(`Found`·`NotFound`·`Fallback`) 쪽으로 내린다. `AttractionPageRenderPort` 에 `canonicalPath(lang, id)` 를 열고 렌더러의 `attractionPath`(`AttractionPageRenderer.kt:844`)를 쓴다. `AttractionPageService.render` 는 정규화(en 외 = ko) 뒤 `docLang != query.pathLang` 판정(Query 주석 「404 문구에만 쓴다」도 고침)
- [ ] 4.3 `AttractionPageController` 가 이동 결과를 301 + `Location: renderPort.canonicalPath(...)`(id 는 검증된 `query.id`) + `Cache-Control: no-cache, must-revalidate` 로. 본문·ETag 없음
- [ ] 4.4 `AttractionPage.tsx`: `docLang` 을 정규화(en 외 = ko)하고, 어긋나면 `<Navigate replace>`(search·hash 보존). 분기는 **모든 훅 뒤, JSX 반환 직전**에 둔다 — `docLang`(`:158`) 다음에 `useSeo(`(`:165`) 등 훅이 이어지므로 그 자리에서 반환하면 훅 순서가 깨진다
- [ ] 4.5 검증: `./gradlew :search:app:test --tests '*AttractionPageServiceTest' --tests '*AttractionPageControllerTest' && (cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx)`

### Task Group 5: 회귀 주입 · 문서 · 배포 · 운영 확인
**Dependencies:** TG1~TG4 · **Phase:** 검증·문서·배포 · **Required Skills:** bash, git, kubectl(읽기, `ssh msa-oci`)
- [ ] 5.1 테스트 먼저 — 회귀 주입은 **워크트리 밖 임시 사본**에서 한다. 각 주입마다 해당 테스트만 돌려 빨강을 보고 결과를 `verifications/regression-injection.md` 에 남긴다(SR-7.4 목록 전부, 컴파일되는 회귀만). 도커가 없으면 「named location 헤더 삭제」는 「미확인」으로 기록한다
- [ ] 5.2 문서: ADR-0062 §8 에 「개정 — 핵심 sitemap 분리·noindex 헤더·언어 어긋난 주소 301 (2026-10-10)」 문단, ADR-0103 상태 계약(200/404/폴백, `AttractionPageController.kt:36-41`)에 개정 한 줄 「언어가 어긋난 경로는 301, Location 은 경로만」, `place/CLAUDE.md`·`search/CLAUDE.md` 해당 절 한 줄씩, `search/glossary.md` 에 「티어 A」·「핵심 sitemap」 행
- [ ] 5.3 전 그룹 검증 명령 재실행(TG1.6 · TG2.5 · TG3.5 · TG4.5) 출력 줄을 증거로 남김
- [ ] 5.4 경로 지정 커밋(`git add <경로>`) → `git diff --cached` 로 핵심 줄(`isTierA`·`@place_noindex`·301 분기) 확인 → 푸시. 이미지 두 개(portal-fe · search)가 나오는지 Actions 확인
- [ ] 5.5 운영 확인(배포 반영 뒤, 새 번들 해시 확인 후):
  - `curl -s https://place.1989v.com/sitemap.xml` 첫 `<loc>` 이 `sitemap-places-core.xml`, 행사가 마지막, `sitemap-places-hub.xml` 404
  - core URL 수 ≈ 19,500(±5%), core + 나머지 합 = 이번 빌드 로그의 `place sitemap N URL`(`prerender-seo.mjs:981`) 의 N + 허브 항목 수와 정확히 일치(「같은 자리수」 아님)
  - `curl -sI https://place.1989v.com/regions/11110/free` 에 `x-robots-tag: noindex, follow`
  - `curl -sI https://place.1989v.com/en/attractions/1` → 301 `location: /attractions/1` · `cache-control: no-cache, must-revalidate`, `/attractions/21` → 301 `/en/attractions/21`, `/attractions/1` → 200
  - `curl -sI https://place.1989v.com/prerender/_noindex/regions/11110/free.html` → 404
  - `curl -s https://place.1989v.com/regions/11110 | grep -c 'href="/attractions/'` ≥ 1
  - `curl -s https://place.1989v.com/llms.txt | grep -cE '/regions/[0-9]+/|/guides'` = 0
  - `curl -s https://1989v.com/ | grep -c 'place.1989v.com/regions/11'` = 1
  - 사용자 확인(Q14·Q7): GSC 「페이지」 보고서 sitemap 필터에서 core 를 따로 고를 수 있는지 — 안 되면 `sitemap-places-core.xml` 하나만 개별 제출(Q7 「sitemap.xml 만」의 예외)
  - [ ] 사용자 확인: GSC 에 `sitemap-places-hub.xml` 이 개별 제출돼 있는지(있으면 지움)
  - 결과를 `verifications/deploy-check.md` 에
- [ ] 5.6 크롤 효과 판정(SR-8, 선행 I0-6 배포): 배포 **전** Googlebot × `detail` 일 합계 7일 기준선(못 뜨면 「미확인」) → 배포 전후 48시간 접근 로그로 Googlebot 상세 요청 id ∩ core `<loc>` 비율(기준치 ~30%)과 sitemap 파일별 수신 횟수 → 4주 뒤 판정 규칙. `verifications/crawl-effect.md` 에
