# Review Verdict — place 크롤 우선순위·색인 정리

대상: spec.md · tasks.md · open-questions.yml / 리뷰: engineer-review-a.md(arch·impl·security), engineer-review-b.md(test·domain·usecase)
판정 규칙: 기각·강등은 ⓐ표준 명시 ⓑ기존 동일 패턴 실존 ⓒ인용 원문 불일치 중 하나가 있을 때만 한다. 33건 모두 인용 원문을 대조했고 반증은 0건이다.

| id | 원판정 | 심판 | 근거(직접 확인) | 스펙에 반영할 편집 한 줄 |
|---|---|---|---|---|
| A-1 | REVISE | keep · REVISE | `RenderAttractionPageUseCase.kt:23-24` `sealed interface Page { val html: String }` · `AttractionPageRenderer.kt:844` `private fun attractionPath` | SR-5.2: `Page.Redirect(docLang, id)` 는 사실만 싣고 `html` 은 렌더된 변형 쪽으로 내린다. 경로는 렌더 포트 `canonicalPath(lang,id)` 로 canonical 과 같은 함수에서 만든다 |
| A-2 | REVISE | keep · REVISE | `PlacePage.tsx:731` 인라인 판정(`landingFirst.count`) · `prerender-seo.mjs:1478,1482,1493` 인라인 판정. 공용 함수 없음, RegionPage 에 count 없음 | SR-2.5·tasks 2.4: SPA 랜딩 링크는 스위치를 켤 때로 미룬다(사용자 판단 4) |
| A-3 | MINOR | keep · MINOR | `AttractionPageController.kt:36-41` 상태 계약 200/404/폴백(ADR-0103) | tasks 5.2: ADR-0103 개정 한 줄 「언어가 어긋난 경로는 301, Location 은 경로만」 |
| I-1 | REVISE | keep · REVISE | `AttractionPageRenderer.kt:56` `val lang = if (doc.lang == EN) EN else KO` · `AttractionPage.tsx:158` `attraction?.lang ?? lang` | SR-5.2·5.4: 렌더러와 같은 정규화(en 외 = ko)를 거친 뒤 비교한다. Kotest·vitest 에 `lang="xx"` → 이동 없음을, 회귀 주입에 「정규화 생략」을 더한다 |
| I-2 | REVISE | keep · REVISE | `prerender-seo.mjs:398-405` getJson 은 15초 타임아웃만 있고 재시도 0 · `:368` 실패 1 + 성공 1이면 throw · `:298` `fetched.includes('places')` | SR-2.3: `regionTops` 호출마다 백오프 재시도 1~2회. 예상 소요 시간 한 줄. tasks 2.2: `fetched.includes('places')` 안에서 호출 |
| I-3 | REVISE | keep · REVISE | `prerender-seo.mjs:958-974` 지금은 자르기만 하는 분할 | SR-7.1: 모든 urlset `<loc>` 멀티셋 = 입력 hub∪detail, 중복 0(core-2·0건 픽스처 포함). 5.5 는 「같은 자리수」 대신 정확 일치 |
| I-4 | REVISE | keep · REVISE | `AttractionPage.tsx:158` docLang 다음 `:165` `useSeo(` 훅 | tasks 4.4: 분기는 모든 훅 뒤, JSX 반환 직전. 쿼리 키가 `['attraction', id]` 이므로 테스트에서 「fetch 1회」 고정 |
| I-5 | MINOR | keep · MINOR | `SearchAttractionUseCase.kt:65,104` 필드는 있지만 빌드 수신을 보는 테스트 없음 | SR-1: 로그 `core 티어 A {n}건`. 상세 ≥ 10,000 인데 티어 A = 0이면 `PartialSeoFailure` |
| I-6 | MINOR | keep · MINOR | `prerender-seo.mjs:1554` `prerender/en/regions/…` 출력 | tasks 3.1: 영문 단언 `prerender/_noindex/en/regions/11110/free.html` + nginx 계약에 영문 `_noindex` |
| I-7 | MINOR | keep · MINOR | `SearchAttractionUseCase.kt:116` `LocalDateTime?` | SR-1.5: 앞 10자가 `^\d{4}-\d{2}-\d{2}$` 가 아니면 modifiedAt 규칙으로 넘김. 픽스처 1건 |
| I-8 | MINOR | keep · MINOR | spec.md:12 User Story 3 · open-questions Q7 | tasks 5.5: 「GSC 필터에서 core 를 따로 고를 수 있는지 확인. 안 되면 core 만 개별 제출」(사용자 판단 6, U5 와 한 줄로 합침) |
| S-1 | REVISE | keep · REVISE | `AttractionPageController.kt:46` 모든 응답에 `no-cache, must-revalidate` | SR-5.2: 301 에도 `Cache-Control: no-cache, must-revalidate`. 컨트롤러 테스트 단언 + 회귀 주입 |
| S-2 | MINOR | keep · MINOR | `AttractionPageController.kt:59` `Regex("\\d{1,12}")` | SR-5.2: Location id 는 검증된 `query.id`. 테스트 `^/(en/)?attractions/\d{1,12}$` |
| S-3 | MINOR | keep · MINOR | nginx.conf `location ~* \.html$` 가 `add_header X-Robots-Tag $host_robots_tag` 로 직접 경로를 잡음 · `_noindex`·`internal` 블록 없음(grep 0) | SR-4.3: `location ^~ /prerender/_noindex/ { internal; }` + 계약 「직접 경로 404」 |
| T1 | 높음 | keep · REVISE | `prerender-seo.mjs:958-973` · `:981` `place sitemap N URL` 로그 존재 | I-3 과 같은 편집 + 회귀 주입 「나머지 상세 버림」「티어 A 양쪽 기록」. 5.5 는 빌드 로그 N 과 같은 수 |
| T2 | 높음 | keep · REVISE | `AttractionPageControllerTest.kt:67-76` 영문 경로 국문 문서 → 200 본문 · `:186-191` 국·영 ETag 동일(`etagOf` shouldNotBeNull) | tasks 4.1: 두 케이스를 301·Location·ETag 없음 / 같은 언어 ETag 유지로 교체한다고 명시 |
| T3 | 중간 | keep · REVISE | `prerender-seo.mjs:736-738` `new Date(value).toISOString()` | tasks 1.1: 픽스처 `T00:30:00` + `TZ=Asia/Seoul` 고정(isoDate 경로면 10-08). 회귀 주입 「contentUpdatedAt 을 isoDate 로」 |
| T4 | 중간 | keep · REVISE | spec.md:7·11 「3클릭」, SR-7.1 은 `<a href>` 존재만 봄 | SR-7.1: 링크 그래프 깊이 검사(픽스처) + 빌드 로그 「티어 A 중 깊이 3 안 N/M」(U1 과 함께) |
| T5 | 중간 | keep · REVISE | `check-nginx-place-landings.sh:44-49` 손으로 만든 고정 파일 · tasks.md:39 국문만 | tasks 3.1: `path === prerender/_noindex${pathname}.html` 공식 단언(국·영) |
| T6 | 중간 | keep · REVISE | SR-7.2 는 4케이스뿐 · `SearchAttractionUseCase.kt:173` `alternateId` 존재 | SR-7.2: 숫자 아닌 id 404 유지 · 짝 있는 문서 행선 · Fallback 200 셸 · 행사 문서 301 을 given 으로 추가 |
| T7 | 중간 | keep · REVISE | 계약 스크립트는 손 파일, tasks.md:68 은 꺼진 상태만 확인 | tasks 3.1: 같은 URL 에서 파일 위치만 바꿔 헤더 유무 확인. 양쪽에 다 있으면 원래 자리가 이김 |
| T8 | 낮음 | keep · MINOR | spec.md:78 목록에 사진·place_id·홈 링크·302·호스트·category 회귀 없음 | SR-7.4: 다섯 개 추가. 도커가 없으면 「named location 헤더 삭제」는 미확인으로 기록 |
| T9 | 낮음 | keep · MINOR | `prerender-seo.mjs:943` `const SITEMAP_CHUNK`(export 없음) | tasks 1.4: export 하거나 chunk 를 인자로(기본값 유지) |
| D1 | 중간 | keep · REVISE | `prerender-seo.mjs:1126` `imageUrl: a.imageUrl ?? null` · `AlternateLanguagePairer.kt:41` `isNullOrBlank()` | SR-1.2: `hasGooglePlaceId = Boolean(a.googlePlaceId?.trim())`, 공백 사진은 없음, hasOverview 먼저. 픽스처 `''`·`'  '` |
| D2 | 중간 | keep · REVISE | SR-1.3 에 불변식 문장 없음(spec.md:28) | SR-1.3: 「core 상세 ∪ 나머지 = `placeDetailSitemapEntries` 출력, 서로소」 한 줄 |
| D3 | 중간 | keep · REVISE | `prerender-seo.mjs:1289-1292` 시도 대표는 hasOverview 필터 · `RegionPage.tsx:113-120` 질의는 category 만 | SR-2.2: size 30 으로 받아 `places[lang]` id 집합으로 걸러(티어 A 우선 → 개요 있음) 10개. SR-7.1 「개요 없는 문서 제외」 |
| D4 | 중간 | keep · REVISE | `SearchAttractionUseCase.kt:173` `alternateId` | SR-5.2: 행선은 문서 자신의 canonical 이고 짝으로 보내지 않는다(사용자 판단 1). T6 픽스처로 고정 |
| D5 | 낮음 | keep · MINOR | `search/glossary.md:80` 「비슷한 곳」, 「관련 관광지」 행 없음 | SR-2.1·2.6: 「관련 관광지」를 실제 절 이름으로 바꿈. tasks 5.2 glossary 에 「핵심 sitemap」 행 추가 |
| U1 | 중간 | keep · REVISE | spec.md:7 Goal 과 SR-2 범위(허브 60 · 시도/시군구 대표 10) | Goal: 「시도·시군구마다 대표 상세가 허브에서 3클릭 안」. 전체 도달은 Out of Scope(사용자 판단 3) |
| U2 | 높음 | keep · REVISE | `place-inflow-measurement/spec.md:49` 경로 유형 `detail` 하나 · tasks 에 배포 전 기준선 단계 없음 | SR-8 효과 판정: 배포 전 7일 기준선, 48시간 로그 대조(core loc 교집합), sitemap 파일별 수신 횟수, 4주 판정 규칙. I0-6 선행을 Dependencies 에(사용자 판단 5) |
| U3 | 중간 | keep · REVISE | nginx.conf 상세 location `proxy_pass …/${render_lang}attractions/$render_id`(쿼리 미전달, 주석 「$request_uri 를 넘기면 쿼리…」) | SR-5: UTM 손실 감수를 명시하고 SPA `Navigate` 는 search·hash 보존(사용자 판단 2) |
| U4 | 낮음 | keep · MINOR | spec.md:49·84 스위치는 범위 밖 | SR-4.4: 스위치를 켜는 커밋의 확인 항목에 `curl -sI` x-robots-tag 없음을 넘긴다 |
| U5 | 낮음 | keep · MINOR | spec.md:12 · Q7 · tasks.md:65-73 에 GSC 확인 칸 없음 | I-8 과 같은 한 줄 + 「`sitemap-places-hub.xml` 개별 제출 여부」 체크 칸 |

부가(리뷰 B 체크리스트 끝): `prerenderPortalHome` 함수를 꺼내기 전후의 홈 HTML 바이트를 비교하라는 제안은 T8 과 같은 묶음으로 유지한다(tasks 3.1 한 줄).

## Overall
**REVISE** — BLOCK 0 · REVISE 21 · MINOR 12. 스펙 결정이 표준을 어기는 곳은 없다. 구현 전에 반드시 넣을 것은 다음이다.
- I-1·S-1: 301 루프와 영구 캐시를 막는다
- A-1: 이동 결과의 모양과 경로 함수 위치
- T2: 깨질 기존 테스트 두 개
- I-3/T1/D2: 분할 전후 집합 동일성
- I-2: 505회 조회의 재시도

## 사용자 판단 목록 (권고 기본값으로 진행)
1. **영문 짝이 있는 국문 문서의 301 행선**(D4·T6): 기본값은 문서 자신의 canonical(`/attractions/{koId}`)이고 짝으로 보내지 않는다. 지금까지의 canonical 신호와 같고, 짝 스위치가 꺼져 있다.
2. **UTM 손실 감수 여부**(U3): 기본값은 감수한다. 어긋난 주소에 UTM 을 단 링크는 드물고, nginx 에서 쿼리를 붙이면 검증 경로가 하나 는다. SPA `Navigate` 는 search·hash 를 보존한다.
3. **Goal 범위 축소**(U1·T4): 기본값은 「시도·시군구 대표 상세가 3클릭 안」으로 좁히는 것이다. 깊이 3 안 티어 A 비율을 로그로 남기고, 전체 상세 도달(정적 목록 페이지네이션)은 Out of Scope 로 둔다.
4. **SPA 랜딩 링크 연기**(A-2): 기본값은 연기다. 스위치가 꺼져 있어 지금 양쪽 다 0이다. 켤 때 `landingIndexed` 공용 함수와 count 출처를 함께 정한다.
5. **크롤 효과 판정 SR-8 추가**(U2): 기본값은 추가하되 I0-6(봇 집계) 배포를 선행 조건으로 두는 것이다. 배포 전에 기준선을 못 뜨면 그 칸은 「미확인」으로 기록한다.
6. **GSC 에서 core 를 따로 볼 수 없을 때 개별 제출**(I-8·U5·Q7): 기본값은 배포 뒤 필터를 확인하고, 안 보이면 core 하나만 개별 제출하는 것이다(Q7 「sitemap.xml 만」 권고의 예외).
7. **행사 문서의 언어 어긋남**(T6): 기본값은 상세와 같은 301 규칙이다.
8. **티어 A 0건 게이트 임계값**(I-5): 기본값은 상세 ≥ 10,000 이면서 티어 A = 0일 때 빌드를 세우는 것이다.

NOTES: 리뷰 A 의 S-3 이 지적한 `/prerender/*.html` 직접 노출은 이 스펙 이전부터 있던 문제다. `_noindex` 범위만 막으면 나머지 프리렌더 파일의 직접 경로는 남는다.
