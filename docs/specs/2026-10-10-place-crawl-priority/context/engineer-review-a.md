# Engineer Review — architecture · implementation · security

대상: `docs/specs/2026-10-10-place-crawl-priority/spec.md` + `tasks.md` + `context/open-questions.yml`
기준 코드: 워크트리 `wt-impl` (읽기 전용 확인). 표준: ADR-0062 §8, ADR-0103, `portal-fe/nginx.conf`, `portal-fe/scripts/check-nginx-*.sh`.

## 요약

| 관점 | 판정 | BLOCK | REVISE | MINOR |
|---|---|---|---|---|
| architecture | REVISE | 0 | 2 | 1 |
| implementation | REVISE | 0 | 4 | 4 |
| security | REVISE | 0 | 1 | 2 |

BLOCK 은 없다. 바로잡아야 할 핵심은 셋이다. 첫째, 301 판정이 렌더러의 언어 정규화와 어긋나면 리다이렉트 루프가 난다. 둘째, 시군구 대표 조회 505회에 재시도가 없어 한 번의 일시 실패로도 빌드가 선다. 셋째, SPA 랜딩 링크 판정에서 「재사용할 판정 함수」라고 적은 것이 실제로는 없다.
Q7 은 사용자 화면 확인(2026-10-10, GSC 에는 `sitemap.xml` 색인 하나만 제출)으로 「하위 개별 제출 없음」으로 닫아도 된다. 단 I-8 을 함께 본다.

---

## Architecture

### A-1 [REVISE] 이동 결과가 `Page.html` 계약과 맞지 않고, 경로를 만드는 지식이 어디 있을지 정해져 있지 않다
- 스펙: `spec.md:54` (SR-5.2) — 「서비스는 이동 결과를 낸다, 컨트롤러는 `Location: {문서 언어의 상세 경로}`」. `tasks.md:54` (4.2) — 「`Page` 에 이동 결과 하나 추가」.
- 코드: `RenderAttractionPageUseCase.kt:23-31` — `sealed interface Page { val html: String }`. 본문이 없는 301 변형은 이 계약을 만족할 수 없다(빈 문자열로 채우면 「본문 없음」이 타입이 아니라 관례가 된다).
- 코드: 상세 경로는 `AttractionPageRenderer.kt:844` `private fun attractionPath(lang, id) = placePath(lang, "/attractions/$id")` 에만 있다. 이 함수는 infrastructure 의 private 이다. 서비스(application)가 경로 문자열을 만들면 이 지식이 둘로 갈리고, 컨트롤러가 만들면 presentation 에 셋째 사본이 생긴다.
- 수정안: `Page.Redirect(val docLang: String, val id: String)` 처럼 **경로가 아니라 사실(정규화된 문서 언어 + id)** 만 싣는다. `html` 은 `Found`·`NotFound`·`Fallback` 쪽으로 내리거나 `Rendered` 하위 인터페이스로 묶는다. 경로 문자열은 렌더 포트(`AttractionPageRenderPort`)에 `canonicalPath(lang, id)` 를 하나 열어 렌더러의 `attractionPath` 를 그대로 쓰게 한다. canonical 과 Location 이 같은 함수에서 나와야 둘이 어긋나지 않는다.

### A-2 [REVISE] SPA 랜딩 링크의 「프리렌더와 같은 판정 함수」가 실제로는 없다
- 스펙: `spec.md:38` (SR-2.5), `tasks.md:33` (2.4) — 「스위치·은퇴·하한 — 프리렌더와 같은 판정 함수 재사용」.
- 코드: 프리렌더 판정은 `prerender-seo.mjs:1478,1482,1493` 안에 인라인으로 있다(`indexable && !retired && count >= MIN`). SPA 판정도 `PlacePage.tsx:731` 에 따로 인라인이다. 공용 함수가 없다.
- 하한 조건은 **랜딩별 결과 건수(count)** 를 알아야 판정할 수 있다. 프리렌더는 빌드 때 랜딩마다 조회해 그 값을 갖지만, `RegionPage` 는 갖고 있지 않다. 지키려면 시군구 화면이 랜딩 수만큼 검색을 더 부르거나 판정을 다르게 해야 한다. 앞의 것은 비용이 늘고, 뒤의 것은 SSR·SPA 링크 집합이 어긋난다.
- 수정안(택1, 권고는 ①): ① SR-2.5 의 SPA 쪽은 스위치를 켤 때로 미룬다. 지금은 스위치가 꺼져 있어 양쪽 모두 0개이고, 이 스펙도 SR-2.4 를 「스위치를 켤 때 함께」라고 적어 두었다(YAGNI). ② 남긴다면 `copy.mjs` 에 순수 함수 `landingIndexed({ indexable, retired, count })` 를 추출해 프리렌더·`PlacePage` 가 함께 쓰게 한다. `RegionPage` 의 count 출처도 스펙에 명시해야 한다(예: 빌드가 생성하는 indexed 랜딩 목록 JSON).

### A-3 [MINOR] 301 은 ADR-0103 응답 계약의 변경이다
- 스펙: `open-questions.yml:38-41` (Q8) — ADR-0062 §8 개정 문단 하나로 처리한다.
- 근거: SSR 응답 상태 계약(200/404/셸 폴백, `AttractionPageController.kt:36-41`)은 ADR-0103 의 결정이다. 여기에 301 이 하나 늘어난다.
- 수정안: `tasks.md` 5.2 에 ADR-0103 개정 한 줄(「언어가 어긋난 경로는 301, Location 은 경로만」)을 더한다. 새 ADR 은 필요 없다는 Q8 판단은 유지한다.

Module Depth / Deletion Test: 새 모듈은 순수 함수 `isTierA` 와 로더 `regionTops` 둘이다. `isTierA` 는 core 분할과 테스트·회귀 주입 세 곳이 쓰므로 존재 이유가 있다. `regionTops` 는 기존 `defaultSeoLoaders` 주입 패턴(`prerender-seo.mjs:379-393`)을 그대로 따른다. 얕은 통과 계층은 없다.

**Architecture 판정: REVISE**

---

## Implementation

### I-1 [REVISE] 언어 비교가 렌더러 정규화와 다르면 301 루프가 난다 (서버·SPA 양쪽)
- 스펙: `spec.md:54` 「찾은 문서의 `lang` 이 경로 언어와 다르면」, `tasks.md:54` 「`doc.lang != query.pathLang` 판정」.
- 코드: 렌더러는 `AttractionPageRenderer.kt:56` `val lang = if (doc.lang == EN) EN else KO` 로 정규화한다. `en` 이 아닌 값은 모두 ko 로 본다.
- 문제: `doc.lang` 이 `""`·`"KO"`·미래의 `"ja"` 처럼 정규화 밖 값이면 `doc.lang != "ko"` 는 참이 된다. 이때 Location 을 렌더러 규칙으로 만들면 `/attractions/{id}`, 곧 **같은 경로**로 다시 301 한다. 결과는 무한 루프다. SPA 도 같다. `AttractionPage.tsx:158` `docLang = attraction?.lang ?? lang` 을 그대로 비교하면, `Navigate` 가 같은 경로로 계속 replace 한다.
- 수정안: 비교 전에 렌더러와 같은 정규화를 거친다(`normalizedLang = if (doc.lang == "en") "en" else "ko"`). 비교는 정규화된 값끼리 한다. Kotest 에 「`doc.lang = "xx"` + 경로 ko → Found(200), 이동 없음」을, vitest 에 같은 경우 「Navigate 없음」을 더한다. 회귀 주입 목록(SR-7.4)에도 「정규화 생략」을 넣는다.

### I-2 [REVISE] 시군구 대표 505회에 재시도가 없어, 일시 실패 한 번이 빌드를 세운다
- 스펙: `spec.md:35-36` (SR-2.2·2.3) — 약 505회, 동시성 4, 하나라도 실패하면 섹션 실패, 다른 섹션이 성공했으면 `PartialSeoFailure`.
- 코드: `getJson` 은 15초 타임아웃만 있고 재시도가 없다(`prerender-seo.mjs:398-405`). 가드는 「실패 1 + 성공 1 이상 → 빌드 중단」이다(`:368-374`). 지금 같은 규칙을 쓰는 랜딩 섹션은 커밋 목록(`place-landings.json`)만큼, 수십 회 수준이다(`:1426-1445`). 관광지 조각 조회는 실패를 `break` 로 흡수한다(`:1196-1199`). 505회짜리 「한 번이라도 실패하면 중단」 섹션은 지금까지 없었다. 일시 오류율이 0.1% 만 돼도 빌드 열 번에 네 번꼴로 선다(1−0.999^505 ≈ 40%).
- 수정안: `regionTops` 의 호출마다 짧은 백오프로 1~2회 재시도한다(그래도 실패하면 지금 규칙대로 섹션 실패). 스펙에 예상 소요 시간도 적는다(505 ÷ 4 × 평균 응답, 운영 실측 한 줄). 운영 API 부하는 문제가 아니다. `/api/search/**` 라우트에는 레이트 리미터가 없고(`GatewayRouteConfig.kt:393-397`), 빌드가 이미 관광지 조각 조회로 640회 이상을 부르기 때문이다.
- 부가: `regionTops` 는 `regions` 가 있어야 돈다. 랜딩과 같이 `if (fetched.includes('places'))` 안에서 부르라고 `tasks.md:31` (2.2)에 적는다(`prerender-seo.mjs:298`). 그러지 않으면 지역 색인이 실패했을 때 `place-region-tops` 가 실패로 두 번 잡힌다.

### I-3 [REVISE] sitemap 분할의 전체 집합 동일성을 검사하는 항목이 없다
- 스펙: `spec.md:67-69` (SR-7.1) — 「티어 A 는 core 에만, 허브는 core 에」까지만 있다.
- 코드: 지금 `placeSitemapFiles` 는 허브와 상세를 이어 붙여 청크로 자른다(`prerender-seo.mjs:958-974`). 분할 로직이 바뀌면 경계(core 상한 20,000, core-2 넘김, 나머지 청크 번호)에서 항목이 빠지거나 겹칠 자리가 생긴다.
- 수정안: vitest 에 「모든 urlset 파일의 `<loc>` 을 모은 멀티셋 == 입력 `hubEntries ∪ detailEntries`, 중복 0」 단언을 하나 더한다. core 가 `SITEMAP_CHUNK + 1` 인 픽스처와 상세 0건 픽스처에도 같은 단언을 돌린다. 회귀 주입에도 「core-2 넘김분 누락」(slice 경계 off-by-one)을 넣는다. `tasks.md:67` 운영 확인의 「같은 자리수」는 이 회귀를 못 잡는다. 「이전 빌드 상세 수와 정확히 같다」(같은 색인 기준)로 좁힌다.

### I-4 [REVISE] SPA `Navigate` 를 「`docLang` 자리」에 두면 훅 순서가 깨진다
- 스펙: `tasks.md:56` (4.4) — 「`AttractionPage.tsx` 의 `docLang` 자리에서 어긋나면 `<Navigate replace>`」.
- 코드: `docLang` 은 `AttractionPage.tsx:158` 에 있고, 그 뒤 `:165` 에 `useSeo(...)` 훅이 있다. 그 자리에서 early return 하면 렌더마다 훅 개수가 달라진다(Rules of Hooks 위반, 개발 모드 오류·상태 꼬임).
- 수정안: 모든 훅 호출이 끝난 뒤, JSX 반환 직전에 분기한다. `useSeo` 는 어긋난 문서에 대해 canonical 만 심고 곧바로 이동하므로 해가 없다. 이동 대상은 `attractionPath(normalizedDocLang, attraction.id)` 다(쿼리·해시 보존 여부도 한 줄 정한다). 쿼리 키는 `['attraction', id]` 라 언어를 담지 않는다(`:126`). 그래서 이동 뒤 다시 조회하지 않는다. 이 점은 장점이니 테스트에서 「fetch 1회」로 고정한다.

### I-5 [MINOR] 목록 API 가 `googlePlaceId`·`category` 를 내지 않으면 티어 A 가 조용히 0이 된다
- 스펙: `spec.md:27` (SR-1.2) — `indexDoc` 이 `category`·`hasGooglePlaceId` 를 싣는다. 표의 근거는 OpenSearch 색인 집계이지 빌드가 읽는 `/api/search/attractions` 응답이 아니다(`spec.md:18`).
- 코드: 응답 타입 `SearchAttractionUseCase.kt:65,104` 에 두 필드는 있다. 다만 빌드가 실제로 받는지는 테스트가 보지 않는다. 0이 되어도 빌드는 초록이고, core 는 허브 541건짜리가 된다.
- 수정안: 프리렌더 로그에 `core 티어 A {n}건` 을 남긴다. 상세가 1만 건 이상인데 티어 A 가 0이면 `PartialSeoFailure` 로 세운다. 이것은 grep·스크립트로 참/거짓이 나오는 규칙이라 게이트로 둔다.

### I-6 [MINOR] `_noindex` 영문 경로 모양을 스펙에 못박는다
- 스펙: `spec.md:47` 「`prerender/_noindex/` 아래 같은 경로」. `tasks.md:39` 예시는 국문(`prerender/_noindex/regions/…`)뿐이다.
- 코드: nginx 안(SR-4.3)은 `/prerender/_noindex$uri.html` 이므로 `/en/regions/11110/free` 의 파일은 `prerender/_noindex/en/regions/11110/free.html` 이어야 한다. 지금 영문 랜딩의 출력은 `prerender/en/regions/…` 다(`prerender-seo.mjs:1554`). 접두를 단순히 붙이면 `prerender/en/_noindex/…` 가 나올 수 있다.
- 수정안: `tasks.md:39` 에 영문 단언(`prerender/_noindex/en/regions/11110/free.html`)을 더한다. nginx 계약 스크립트에도 영문 `_noindex` 랜딩 200·헤더를 넣는다.

### I-7 [MINOR] lastmod 형식 가드
- 스펙: `spec.md:30` (SR-1.5) — `contentUpdatedAt` 앞 10자.
- 코드: 응답 필드는 `LocalDateTime`(`SearchAttractionUseCase.kt:116`)이다. 직렬화가 ISO 문자열일 때만 앞 10자가 날짜다.
- 수정안: `^\d{4}-\d{2}-\d{2}$` 에 맞지 않으면 다음 규칙(`modifiedAt`)으로 넘긴다. 픽스처 하나를 더한다(배열·잘못된 문자열 → `modifiedAt`).

### I-8 [MINOR] Q7 닫기와 User Story 3(sitemap 별 색인 수)의 측정 경로
- 근거: `spec.md:12` — 「Search Console 의 sitemap 별 색인 수로 티어 A 와 나머지를 따로 본다」. 사용자 확인에 따르면 GSC 에는 색인 `sitemap.xml` 하나만 제출돼 있다.
- 판단: Q7(`open-questions.yml:33-36`)은 「하위 개별 제출 없음 → 지울 것 없음」으로 닫혀도 된다. 다만 GSC 「페이지 색인 생성」 필터에서 색인 파일의 하위(`sitemap-places-core.xml`)를 따로 고를 수 있는지는 이 리뷰에서 확인하지 못했다.
- 수정안: `tasks.md:6`·5.5 에 「배포 뒤 GSC 필터에 core 가 보이는지 확인. 안 보이면 core 하나만 개별 제출」을 사용자 몫으로 한 줄 적는다.

nginx 순서·충돌 확인(문제 없음, 근거만 남긴다):
- 옛 지역 301(`nginx.conf:264-266`)은 랜딩 location(`:271`)보다 앞이고, 이 스펙은 순서를 바꾸지 않는다. 기존 계약 ④(`check-nginx-place-landings.sh:105-107`)가 계속 지킨다.
- 이름 있는 location 으로 넘어간 뒤에도 `$uri` 는 원래 요청 경로 그대로다. nginx 가 `..` 를 정규화한 값이라 `_noindex` 밖으로 나갈 수 없다. 랜딩 location 의 `add_header` 는 이름 있는 location 으로 이어지지 않으므로, SR-4.3 처럼 그쪽에 Cache-Control·X-Robots-Tag 를 직접 적는 것이 맞다.
- sitemap 정규식(`nginx.conf:131`) `sitemap[a-z0-9.\-]*\.xml` 은 `sitemap-places-core.xml`·`sitemap-places-core-2.xml` 를 모두 받는다. `= /sitemap-places-events.xml`(`:75`)이 정확 일치라 정규식보다 앞선다는 점도 그대로다.
- 301 통과: `error_page` 는 500~504 만 가로챈다(`nginx.conf:240`). `proxy_pass` 가 변수라 `proxy_redirect default` 가 적용되지 않으므로 상대 Location 은 그대로 나간다. search 쪽에는 `sendRedirect`·`ShallowEtagHeaderFilter` 가 없다(grep 0건). 그래서 Tomcat 이 Location 을 절대 주소(내부 호스트)로 바꾸지 않는다. 다만 이 경로는 스크립트로 확인할 수 있으니, `check-nginx-events-sitemap.sh` 식의 스텁 upstream 으로 nginx 계약에 「301 + 상대 Location 통과」 한 줄을 넣는 편이 「배포 뒤 운영 확인」(`spec.md:55`)보다 낫다(선택).

이관·되돌리기: 이미지 되돌리기로 옛 sitemap 이름이 돌아온다. 301 이 브라우저·검색엔진 캐시에 남는 문제는 S-1 에서 다룬다. 동시성: 빌드 단일 프로세스이고 공유 상태가 없다.

**Implementation 판정: REVISE**

---

## Security

### S-1 [REVISE] 301 응답의 Cache-Control 을 스펙에 명시한다
- 스펙: `spec.md:54` — 「본문·ETag 를 싣지 않는다」. Cache-Control 은 언급이 없다.
- 코드: 지금 빌더는 모든 응답에 `no-cache, must-revalidate` 를 단다(`AttractionPageController.kt:42-46`). 301 을 별도 분기로 짜면 이 줄이 빠지기 쉽다. Cache-Control 없는 301 은 브라우저가 휴리스틱으로 사실상 영구 캐시한다. I-1 같은 잘못된 Location 이 한 번 나가면 배포로 되돌려도 사용자 쪽에 남는다(가용성·무결성).
- 수정안: SR-5.2 에 「301 도 `Cache-Control: no-cache, must-revalidate`」를 적는다. `AttractionPageControllerTest` 에 단언 한 줄과 회귀 주입 한 줄을 더한다.

### S-2 [MINOR] Location 은 검증된 경로 id 로 만든다
- 근거: 컨트롤러는 경로 id 를 `\d{1,12}` 로 검증한다(`AttractionPageController.kt:31,59`). 문서의 `doc.id` 는 색인 값이다.
- 판단: 호스트를 싣지 않고 언어는 둘 중 하나로 정규화하므로 오픈 리다이렉트는 성립하지 않는다. 그래도 Location 의 id 는 **검증된 `query.id`** 로 만든다. 색인 값이 예기치 않은 문자를 가져도 헤더 주입(CRLF)·경로 조작 여지가 없게 하기 위해서다. 테스트로 「Location 은 `^/(en/)?attractions/\d{1,12}$`」를 단언한다.

### S-3 [MINOR] `_noindex` 파일이 직접 경로로 헤더 없이 열린다
- 코드: `/prerender/_noindex/regions/11110/free.html` 을 직접 요청하면 랜딩·지역 정규식이 아니라 `location ~* \.html$`(`nginx.conf:400-404`)이 잡는다. place 호스트의 `$host_robots_tag` 는 빈 값이라 X-Robots-Tag 없이 200 이 나간다. 문서 안의 meta noindex·canonical 이 있어 피해는 작다. 그래도 SR-4 의 목표(헤더로도 noindex)에 구멍이 생긴다. 지금의 `/prerender/...html` 직접 노출은 이 스펙 이전부터 있던 문제다.
- 수정안: `location ^~ /prerender/_noindex/ { internal; }` 한 블록을 더한다. 이름 있는 location 의 `try_files` 는 파일을 바로 내보내고 location 을 다시 찾지 않으므로 `internal` 에 막히지 않는다. 계약 스크립트에 「직접 경로 404」 한 줄을 더한다.

STRIDE 나머지: 인증·인가 경계 변경 없음(SSR 은 `/internal` 경로, `AttractionPageController.kt:15-16`). 쿠키·Authorization 은 nginx 가 지운다(`nginx.conf:237-238`). 새로 다루는 민감 데이터 없음(`hasGooglePlaceId` 는 불리언만 싣는다, `spec.md:27`). 빌드 조회는 공개 API 읽기이고 시크릿이 없다. 결제·주문·재고와 무관하다.

**Security 판정: REVISE**

---

## 수정 우선순위
1. I-1 언어 정규화(루프), S-1 301 Cache-Control: 서버·SPA·테스트·회귀 주입을 한 번에 손본다.
2. A-1 `Page.Redirect` 모양과 경로 함수 위치.
3. I-2 `regionTops` 재시도 + `fetched.includes('places')` 조건.
4. A-2 SPA 랜딩 링크는 미루기(권고), I-4 Navigate 위치.
5. I-3 전체 집합 동일성 단언, I-5 티어 A 0건 게이트, I-6 영문 `_noindex` 경로, S-3 `internal`.

VERDICT: REVISE
