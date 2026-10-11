# Engineer Review B — test-strategy · domain · usecase

대상: `docs/specs/2026-10-10-place-crawl-priority/spec.md` · `tasks.md` · `context/open-questions.yml`
기준: hns 0.16.1 체크리스트(test-strategy · domain · usecase), `docs/standards/test-rules.md`, `search/glossary.md`
근거 코드: 워크트리 `wt-impl` 의 `portal-fe/scripts/prerender-seo.mjs`, `portal-fe/nginx.conf`, `portal-fe/scripts/check-nginx-place-landings.sh`, `search/app/.../AttractionPage*`, 기존 테스트

## 관점별 판정

| 관점 | 판정 | 이슈 |
|---|---|---|
| test-strategy | REVISE | 9 |
| domain | REVISE | 5 |
| usecase | REVISE | 5 |

BLOCK 은 없다. 스펙 결정이 코드나 문서를 어기는 곳은 찾지 못했다. 다만 스펙대로 구현하면 기존 테스트 두 개는 반드시 깨진다(T2).

---

## 1. test-strategy

### T1 [높음] sitemap 전체 집합이 분리 전후로 같다는 검사가 없다
- 근거: SR-7.1(spec.md:67-69)과 tasks 1.1(tasks.md:12-14)이 보는 것은 셋이다. 티어 A 가 core 에만 있는지, 허브 항목이 core 에 있는지, 나머지 상세가 core 에 없는지. **나머지 상세가 어딘가에 실렸는지는 아무 단언도 보지 않는다.** 그래서 비 티어 A 상세를 통째로 버리는 구현도 초록불이다. 현재 구현은 `detailEntries` 를 자르기만 한다(`prerender-seo.mjs:958-973`). 분리 로직이 들어오면 상세가 빠지거나 두 번 실릴 수 있는 자리가 처음 생긴다.
- 운영 확인도 「같은 자리수」(tasks.md:67)라서 수천 건이 빠져도 통과한다.
- 수정안:
  - vitest 를 하나 더한다. `placeSitemapFiles(hub, detail)` 이 낸 모든 urlset 의 `<loc>` 을 모은다. 이것이 `hub ∪ detail` 의 loc 과 **정렬 후 정확히 같고**(중복 0) core-2 경우에도 같아야 한다.
  - SR-7.4 회귀 주입에 「나머지 상세를 버림」과 「티어 A 를 core·나머지 양쪽에 씀」을 더한다.
  - 5.5 운영 확인은 「core + 나머지 = 빌드 로그의 `place sitemap N URL`」로 **같은 수**를 비교한다(`prerender-seo.mjs:981` 이 이미 N 을 찍는다).

### T2 [높음] SR-5 와 정면으로 어긋나는 기존 테스트 두 개가 교체 목록에 없다
- 근거:
  - `AttractionPageControllerTest.kt:67-76`: 「영문 경로로 국문 문서 → canonical 은 국문」이고 200 본문을 읽는다. SR-5 이후에는 301 이고 본문이 없다.
  - `AttractionPageControllerTest.kt:186-191`: 「같은 id 를 국문·영문 경로로 받으면 ETag 가 같다」. `etagOf` 가 `shouldNotBeNull` 이라 301(ETag 없음)에서 실패한다.
  - 기존 sitemap 순서 단언(`prerenderPlace.test.ts:303-307`)은 tasks 1.1 이 교체를 명시했다. 위 두 개는 tasks 4.1(tasks.md:50-53)에 없다.
- 수정안: tasks 4.1 에 「위 두 케이스를 301 단언으로 교체」를 적는다. 교체 뒤 단언은 둘이다. ① `/internal/render/en/attractions/1001`(국문 문서) → 301 · `Location: /attractions/1001` · ETag 없음 ② 같은 언어 경로의 ETag 는 그대로. 말없이 지우면 회귀 주입 「서비스가 언어 비교 생략」이 무엇을 빨갛게 하는지 흐려진다.

### T3 [중간] lastmod 픽스처 `23:30` 은 「날짜 앞 10자」와 `isoDate` 를 가르지 못한다
- 근거: tasks 1.1 의 픽스처는 `contentUpdatedAt: '2026-10-09T23:30:00'` → `2026-10-09` 이다(tasks.md:15). `isoDate` 는 `new Date(value).toISOString().slice(0,10)` 이라(`prerender-seo.mjs:736-739`) 오프셋 없는 문자열을 실행 기기의 로컬 시각으로 읽는다. UTC 와 KST(+9)에서는 23:30 도 같은 날짜가 나온다. 그래서 `contentUpdatedAt` 을 `isoDate` 에 넣는 구현도 초록이다. SR-1.5 가 「KST 문자열 앞 10자」로 규칙을 고정한 이유가 바로 이 차이다.
- 수정안: 픽스처를 `'2026-10-09T00:30:00'` 으로 바꾸고 테스트 안에서 `process.env.TZ='Asia/Seoul'` 처럼 시간대를 고정한다. 그러면 `isoDate` 경로는 `2026-10-08` 이 나와 빨간불이 된다. 아니면 단언을 「입력 문자열 앞 10자와 같다」로 두고, 회귀 주입에 「contentUpdatedAt 을 isoDate 로 변환」을 더한다.

### T4 [중간] 「3클릭 안」을 재는 검사가 없다
- 근거: Goal(spec.md:7)과 User Story(spec.md:11)는 「상세가 허브에서 3클릭 안」이다. SR-7.1 은 「시군구 프리렌더에 대표 `<a href>` 가 있다」(spec.md:71)만 본다. 대표는 시군구당 최대 10곳 × 약 505 ≈ 5천이고, 티어 A 는 약 19,000이다(spec.md:25,29). 깊이 3 안에 드는 상세의 비율이나 집합을 보는 검사는 없다.
- 수정안: 프리렌더 산출물의 링크 그래프를 탐색하는 순수 함수를 둔다. 예: `reachableWithin(pages, start, depth)` 는 `placeHubPages`·`placeDetailPages`·`placeLandingPages` 출력의 `href` 를 BFS 로 따라간다.
  - vitest: 픽스처 그래프에서 「허브 → 시도 → 시군구 → 상세」가 깊이 3 이고, 시군구 대표에서 뺀 상세는 깊이 3 밖이다.
  - 빌드 로그: 「티어 A 중 깊이 3 안 N / 전체 M」을 한 줄로 찍고, 운영 확인에서 그 수를 남긴다.
  - 그 뒤 Goal 문장을 실제 범위에 맞춘다(U1).

### T5 [중간] `_noindex` 출력 경로와 nginx 조회 경로가 같은 공식으로 묶여 있지 않다. 영문 경우는 아무도 보지 않는다
- 근거: nginx 는 `try_files /prerender/_noindex$uri.html` 를 쓴다(spec.md:48). 영문 랜딩은 이것이 `/prerender/_noindex/en/regions/…` 다. 그런데 tasks 3.1 의 단언은 「모든 랜딩 `path` 가 `prerender/_noindex/regions/…`」(tasks.md:39)라 영문을 이 모양으로 쓰는 구현도 통과하고, 그러면 운영에서는 404 다.
- 계약 스크립트도 손으로 만든 고정 파일을 쓴다(`check-nginx-place-landings.sh:44-49`). 프리렌더 산출물과 nginx 규칙이 맞물리는지를 보는 검사가 아니다.
- 수정안:
  - vitest 단언을 `page.path === \`prerender/_noindex${new URL(page.url).pathname}.html\`` 로 둔다. nginx 와 같은 공식이고, 국·영 둘 다 본다.
  - 계약 스크립트에 영문 `_noindex` 케이스(`/en/regions/11110/free` → 200 · `noindex, follow`)를 더한다.

### T6 [중간] 301 경계 케이스가 빠졌다
- 근거: SR-7.2(spec.md:76)가 보는 것은 ko↔en 두 방향, 같은 언어, 없는 id 다.
- 빠진 것:
  - **숫자 아닌 id**: 지금은 조회 없이 404 다(`AttractionPageControllerTest.kt:94-105`, `nginx.conf:253-255`). 새 분기가 이 길에 끼지 않는다는 단언을 그대로 유지하라고 적어 둘 필요가 있다.
  - **영문 짝이 있는 국문 문서**: `alternateId` 가 있는 국문 문서를 `/en/attractions/{koId}` 로 받았을 때 행선이 `/attractions/{koId}`(문서 언어)인지 `/en/attractions/{alternateId}`(요청 언어의 짝)인지 스펙이 정하지 않았다(D4). 어느 쪽이든 픽스처로 못박는다.
  - **조회 실패(Fallback)**: 어긋난 경로에서 조회가 실패하면 지금처럼 200 셸이다. 이것도 단언으로 둔다.
  - **행사 문서**: 언어가 어긋나면 똑같이 301 인지 정한다.
- 수정안: 위 넷을 `AttractionPageServiceTest`·`AttractionPageControllerTest` 의 given 으로 더한다.

### T7 [중간] noindex 헤더가 스위치 켜짐에서 사라지는지는 반쪽만 본다
- 근거: tasks 3.1 은 스위치 true + 하한 이상이면 원래 경로라고 단언한다(tasks.md:39). 계약 스크립트는 「`indexed` 랜딩 200·X-Robots-Tag 없음」을 본다(tasks.md:42). 하지만 둘은 다른 입력이다. 스크립트는 손으로 만든 파일을 쓰므로 「스위치를 켜면 헤더가 사라진다」는 연결은 어디서도 한 번에 보지 않는다. 운영 확인(tasks.md:68)도 꺼진 상태만 본다.
- 수정안: 스크립트가 같은 조합(`/regions/11110/free`)을 두 벌로 띄운다. 원래 자리에만 둔 것은 헤더가 없고, `_noindex` 에만 둔 것은 헤더가 있다. **같은 URL 에서 파일 위치만 바꿔** 헤더 유무가 바뀌는 것을 본다. 양쪽에 다 있으면 원래 자리가 이긴다(헤더 없음)는 단언도 더한다. try_files 순서 회귀를 잡는다.

### T8 [낮음] 회귀 주입 목록의 빈 곳
- 근거: SR-7.4(spec.md:78)의 열 가지에 빠진 것이 있다.
  - 티어 A 의 **사진·place_id** 조건 제거(분류만 있다)
  - SR-6 홈 링크 제거
  - 301 → 302
  - `Location` 에 호스트 포함
  - 시군구 대표 질의에서 `category` 누락(SR-2.2 는 「질의 인자에 category」를 단언한다)
- 「named location 헤더 삭제」는 도커가 있어야만 빨간불을 볼 수 있다. 도커가 없으면 이 항목은 「미확인」으로 남긴다고 tasks 5.1 에 적는다.
- 수정안: 위 다섯을 목록에 더한다. 모두 컴파일되는 한 줄 회귀다.

### T9 [낮음] `SITEMAP_CHUNK` 가 export 되지 않았다
- 근거: `prerender-seo.mjs:943` 은 `const` 이고 export 하지 않는다. 테스트가 `SITEMAP_CHUNK + 1` 을 쓰려면 리터럴 20,001 을 사본으로 갖게 된다. 상수가 바뀌면 테스트가 엉뚱한 경계를 잰다.
- 수정안: export 하거나 `placeSitemapFiles` 에 chunk 를 인자로 받게 한다(기본값 유지).

체크리스트 그 밖: 층 배정(vitest 순수 함수 / Kotest BehaviorSpec / 실제 nginx 계약)은 적절하다. 목 경계는 포트만 대역이다(`AttractionPageControllerTest.kt:28-40` 방식). 이름 규칙(`*Test.kt`, `*.test.ts`)은 `test-rules.md:17` 과 맞다. 새 `prerenderPortalHome.test.ts` 의 「기존 출력 동일」은 `footerLinksGolden` 이 바닥글만 보므로, 함수를 꺼내기 전후의 홈 HTML 이 (추가한 링크를 빼면) 바이트 단위로 같은지 한 번 비교해 둔다.

---

## 2. domain

### D1 [중간] 티어 A 판정 함수의 입력 경계가 덜 고정됐다
- 근거: SR-1.2(spec.md:27)는 「`isTierA(doc)` 순수 함수 하나」로 정했다. 좋은 결정이다. 그런데 「사진 있음」「place_id 있음」이 빈 문자열을 어떻게 다루는지 정하지 않았다. `indexDoc` 은 `imageUrl: a.imageUrl ?? null` 이라 `""` 를 그대로 둔다(`prerender-seo.mjs:1126`). 짝 판정 쪽은 `googlePlaceId.isNullOrBlank()` 를 쓴다(`AlternateLanguagePairer.kt:41`). `hasGooglePlaceId` 를 `a.googlePlaceId != null` 로 만들면 두 BC 의 「place_id 있음」이 갈린다.
- 수정안:
  - SR-1.2 에 「`hasGooglePlaceId = Boolean(a.googlePlaceId?.trim())`, 사진도 공백이면 없음」을 적는다.
  - `isTierA` 가 `hasOverview` 를 먼저 보고(개요 없는 doc 에는 `category` 가 없다, `prerender-seo.mjs:1120`) 분류·사진·place_id 를 보는 순서를 적는다.
  - 픽스처에 `''`·`'  '` 을 더한다.

### D2 [중간] 분할 불변식이 문장으로 없다
- 근거: SR-1.3(spec.md:28)은 파일 구성만 말한다. 「core 상세 ∪ 나머지 = 지금 sitemap 상세 집합(`placeDetailSitemapEntries` 출력), 서로소」라는 불변식이 명시돼 있지 않다. 그래서 T1 같은 검사가 tasks 에서 빠졌다.
- 수정안: SR-1 에 이 불변식을 한 줄로 두고, T1 의 검사가 그것을 재게 한다.

### D3 [중간] 시군구 대표가 티어 A·sitemap 조건과 무관하다. 크롤을 얇은 상세로 보낼 수 있다
- 근거: SR-2.2(spec.md:35)의 질의는 `category` 만 걸고 개요·사진 조건이 없다. 시도 대표는 `regionTopCandidates` 가 「개요·제목 있음, 사진 먼저」로 거른다(`prerender-seo.mjs:1289-1292`). 시군구 대표에는 이 필터가 없어서 sitemap 에 없는 개요 없는 상세로 링크를 걸 수 있다. 「받은 크롤을 어디에 쓰게 할지」(spec.md:4)라는 목표와 어긋난다.
- 수정안: 응답을 `places[lang]` 의 id 집합으로 거른다(`isTierA` 우선, 그다음 `hasOverview`). 그렇게 하려면 `size` 를 30 쯤으로 받아 10 으로 자른다. SPA 와 같은 질의라는 근거(spec.md:35)는 「필터가 같다」로 남는다. SR-7.1 에 「개요 없는 문서는 시군구 대표에 없다」를 더한다.

### D4 [중간] 301 행선의 기준인 「문서 언어」 대 「요청 언어의 짝」이 정해지지 않았다
- 근거: SR-5.2(spec.md:54)는 「문서 언어의 상세 경로」다. 그런데 문서에 `alternateId` 가 있을 때(짝 스위치가 켜졌을 때, `SearchAttractionUseCase.kt:169-173`) `/en/attractions/{koId}` 요청은 영문 독자의 의도로 보면 `/en/attractions/{alternateId}` 가 더 맞다. 지금은 짝 스위치가 꺼져 있어 차이가 없다. 스위치를 켜는 순간 동작 기준이 문서에 없다.
- 수정안: SR-5 에 「행선은 항상 문서 자신의 canonical(문서 언어 경로) — 짝이 있어도 짝으로 보내지 않는다(canonical 과 같은 신호)」 또는 그 반대를 한 줄로 정하고, T6 의 픽스처로 고정한다.

### D5 [낮음] 용어. 새 말 둘과 정의 없는 말 하나
- 근거:
  - 「티어 A」는 tasks 5.2 가 `search/glossary.md` 에 행을 더한다고 했다(tasks.md:62). 같은 표에 이미 portal-fe 쪽 개념(속성 랜딩·색인 스위치, `search/glossary.md:97-100`)이 있어 위치는 선례와 맞다.
  - 「핵심 sitemap / core」는 행이 없다.
  - 「관련 관광지 13곳」(spec.md:34, 39)은 사전에 없다. 사전에는 「비슷한 곳」「주변 명소」(Avoid: 근처 관광지)가 있고, 상세 응답 필드로는 `relatedPlaces`(함께 간 곳)가 있다(`search/glossary.md:80-81`, `SearchAttractionUseCase.kt:165-166`). 어느 절인지 모호하다.
  - `Avoid` 동의어를 쓴 곳은 없다.
- 수정안: 「관련 관광지」를 실제 절 이름(예: 「비슷한 곳」·「함께 간 곳」)으로 바꾸고, glossary 행 추가에 「핵심 sitemap」도 넣는다. `RenderAttractionPageUseCase.Page` 는 `sealed interface` 이고 `val html: String` 을 요구한다(`RenderAttractionPageUseCase.kt:23-31`). 본문이 없는 이동 결과의 모양을 SR-5.2 에 적는다. 예: `Moved(val location: String)` 에 `html = ""` 를 줄지, `html` 을 Found·NotFound·Fallback 쪽으로 내릴지.

체크리스트 그 밖: BC 경계 누수 없음. 프리렌더는 공개 검색 API 만 부르고, `googlePlaceId` 는 값 없이 불리언으로만 들고 간다(spec.md:27). 판정은 application 서비스에 있고, controller 는 상태 매핑만 한다(`AttractionPageController.kt:36-41`). 레이어 방향 위반은 없다. 도메인 이벤트·애그리거트 변경은 없다.

---

## 3. usecase

### U1 [중간] Goal 과 User Story 의 「3클릭 안」이 설계 범위보다 크다
- 근거: Goal 「상세가 허브에서 3클릭 안에 닿게 한다」(spec.md:7)는 전체 상세로 읽힌다. 하지만 SR-2 가 깊이 3 안에 넣는 상세는 다음뿐이다.
  - 허브 60곳(`prerender-seo.mjs:1241`)
  - 시도 대표 10곳 × 시도 수
  - 시군구 대표 최대 10곳 × 약 505
- 티어 A 약 19,000의 대부분은 여전히 깊이 4 이상이다(상세 SSR 의 관련 링크로 이어짐).
- 수정안: Goal 을 「시도·시군구마다 대표 상세가 허브에서 3클릭 안」으로 좁히고 T4 의 수치(깊이 3 안 티어 A 비율)를 결과로 남긴다. 전체 도달이 목표라면 시군구 목록 쪽(페이지네이션된 정적 목록)이 별도 범위다. Out of Scope 에 적어 둔다.

### U2 [높음] 이 변경이 크롤 우선순위를 실제로 바꿨는지 판정하는 흐름이 없다. 봇 집계(H1)와 연결되지 않는다
- 근거: 스펙의 효과 신호는 GSC sitemap 별 색인 수(spec.md:12, tasks.md:6)와 Q1 의 「4주 본 뒤 재판단」(open-questions.yml:6)뿐이다. 유입 측정 스펙의 봇 집계는 경로 유형을 `detail` 하나로 접는다(`2026-10-10-place-inflow-measurement/spec.md:57,69`). 그래서 티어 A 상세와 나머지 상세에 대한 크롤을 가를 수 없다. `sitemap` 도 한 유형이라 core 파일이 더 자주 읽히는지도 그 표로는 보이지 않는다. 플랜의 기준선(Googlebot 상세 하루 ~17, `2026-10-10-place-search-inflow-plan.md:13,68`)을 배포 **전에** 떠 두는 단계도 tasks 에 없다.
- 수정안: SR-8 「효과 판정」을 둔다.
  1. 배포 전 기준선. `crawler_requests_hourly` 에서 googlebot × `detail` × 일 합계 7일치를 떠 둔다(I0-6 배포가 선행 조건 — tasks 의 Dependencies 에 적는다).
  2. 배포 전후 48시간 접근 로그 1회 대조. Googlebot `/attractions/{id}` 요청 id 와 `sitemap-places-core.xml` 의 loc 의 교집합 비율이 티어 A 크롤 비중이다. 기준치는 무작위면 약 30%(19k/63k)다.
  3. 같은 로그에서 `sitemap-places-core.xml` 과 `sitemap-places-{n}.xml` 각각을 Googlebot 이 받은 횟수.
  4. 판정 규칙. 4주 뒤 ①이 기준선 이상이고 ②가 기준치보다 높으면 「효과 있음」, 아니면 Q1 을 다시 연다.
- 결과는 `verifications/crawl-effect.md` 에 남긴다. 상세 경로 유형을 tier 로 더 가르는 것은 봇 집계 스펙의 변경이라 여기서는 1회 대조로 충분하다.

### U3 [중간] 301 이 쿼리(UTM)를 떨어뜨린다
- 근거: nginx 는 상세를 캡처한 값으로만 upstream 주소를 만들고 쿼리를 넘기지 않는다(`nginx.conf:219-220,234`). 그래서 search 는 쿼리를 모르고, `Location` 은 경로뿐이다(spec.md:54). `/en/attractions/1?utm_source=…` 는 `/attractions/1` 로 가면서 UTM 을 잃는다. 바로 앞 묶음인 유입 측정(I0-5)이 착지 URL 의 UTM 을 기록한다.
- 수정안: 둘 중 하나를 SR-5 에 정한다. ① 손실을 감수한다(어긋난 주소에 UTM 을 단 링크는 드물다)고 적는다. ② nginx 가 search 의 301 을 `proxy_intercept_errors` 로 받지 않고, Location 뒤에 `$is_args$args` 를 붙이도록 `proxy_redirect`/`add_header` 로 처리한다. ②는 검증 케이스가 하나 더 생긴다. SPA `<Navigate>`(SR-5.4)는 `search` 를 유지하는지도 함께 적는다.

### U4 [낮음] 사전·사후 조건이 흩어져 있다
- 근거:
  - 스위치 상태(지금 꺼짐)가 각 SR 의 전제다(spec.md:37,46,49).
  - 사후 조건은 운영 확인(tasks.md:65-73)에만 있다.
  - SR-4 사후 조건 「켠 뒤 헤더가 사라진다」는 운영에서 확인할 길이 없다. 스위치는 사용자 몫이고 이 스펙 범위 밖이다(spec.md:84).
- 수정안: SR-4.4 에 「스위치를 켜는 커밋의 확인 항목에 `curl -sI …/regions/{indexed 조합}` 에 `x-robots-tag` 없음을 넣는다」고 적어 켜는 쪽 체크리스트로 넘긴다.

### U5 [낮음] SR-6 의 흐름에는 검증 대상이 있지만 회귀 주입이 없다(T8 과 같은 내용). Q7(GSC 개별 제출 sitemap 정리)은 사용자 몫인데 tasks 5.5 에 체크 칸이 없다
- 수정안: 5.5 에 「사용자 확인: GSC 에서 `sitemap-places-hub.xml` 개별 제출 여부」 한 줄을 더한다. 또 GSC 「페이지」 보고서의 sitemap 필터에서 하위 sitemap(core)을 따로 고를 수 있는지 첫 확인 때 적어 둔다. 고를 수 없으면 User Story 3(spec.md:12)이 성립하려면 core 를 개별 제출해야 하고, 그러면 Q7 권고와 부딪힌다.

체크리스트 그 밖: 행위자·목표 짝(크롤러·운영자·검색엔진)은 분명하다. 대안·예외 흐름 중 상세 0건(SR-1.6), core 초과(SR-1.4), 대표 조회 실패(SR-2.3), 없는 조합 404(SR-4.3), 없는 id 404(SR-7.2)는 있다. AC 는 SR-7 로 추적된다. 단 Goal 의 「3클릭」(U1)과 「따로 잴 수 있게」(U2)는 추적되지 않는다.

---

## 요약 (부모 전달용)
- 판정은 셋 다 REVISE 다(test-strategy 9건 · domain 5건 · usecase 5건). BLOCK 은 없다.
- 높음 셋:
  - T1: core ∪ 나머지 = 이전 상세 집합을 보는 검사가 없다.
  - T2: 기존 테스트 `AttractionPageControllerTest.kt:67-76,186-191` 이 SR-5 와 충돌하는데 교체 목록에 없다.
  - U2: 크롤 효과 판정이 봇 집계(H1)와 끊겨 있다. 경로 유형이 `detail` 하나라 티어 A 를 가를 수 없다.
- 중간:
  - T3: lastmod 픽스처 23:30 이 시간대 회귀를 못 잡는다.
  - T4/U1: 「3클릭」을 재는 링크 그래프 탐색이 없고, Goal 이 실제 범위보다 크다.
  - T5: `_noindex` 영문 경로를 nginx 공식과 묶은 검사가 없다.
  - T6/D4: 301 경계. 짝 있는 문서의 행선, Fallback, 숫자 아닌 id.
  - T7: 같은 URL 에서 파일 위치만 바꿔 헤더 유무를 보는 검사가 없다.
  - D1: 빈 문자열 place_id·사진.
  - D3: 시군구 대표가 개요·티어 A 필터 없이 얇은 상세로 링크된다.
  - U3: 301 이 UTM 을 떨어뜨린다.

VERDICT: REVISE
