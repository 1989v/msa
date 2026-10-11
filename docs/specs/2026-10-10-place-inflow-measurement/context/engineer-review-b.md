# Engineer Review B — test-strategy · domain · usecase

대상: `spec.md` · `tasks.md` · `context/open-questions.yml` (2026-10-10). 리뷰 2026-10-11.
판정 요약: **test-strategy REVISE · domain REVISE · usecase REVISE**. BLOCK 없음. 사람의 판단이 필요한 것은 D-5 하나다.

Seed: 스펙 3종 + `planning/initialization.md`, `docs/standards/test-rules.md`, 선례 스펙 `2026-10-08-place-hub-instrumentation/spec.md`, 코드(`tracker.ts`·`identity.ts`·`events.ts`·`App.tsx`·`PlacePage.tsx`·`PlaceLandingRoute.tsx`·`nginx.conf`·`EventCollectController.kt`·`EventCollectDtos.kt`·`VisitorIdFilter.kt`·`V005__events_two_axis.sql`·`ClickHouseSchemaInitializerTest.kt`·`privacyRetention.test.ts`·`AttractionShortLinkControllerTest.kt`·`cronjob-visitors.yaml`·`ci.yml`·ADR-0105).

---

## 1. test-strategy — REVISE

| # | 심각도 | 발견 | 근거 | 수정안 |
|---|---|---|---|---|
| T-1 | REVISE | **「허브 SESSION_START 에 payload 추가」 주입이 지정된 검증 명령으로는 빨개지지 않는다.** 2.5 가 돌리는 `PlacePage.tracking.test.tsx` 는 `toMatchObject` 라서 payload 가 더 붙어도 초록이다. 빨개지는 것은 `PlacePage.test.tsx` 의 `toEqual` 하나뿐인데, 그 파일은 2.5·8.1 명령에 없다. | `PlacePage.tracking.test.tsx:173`(`toMatchObject`), `PlacePage.test.tsx:501`(`toEqual`), tasks.md:24·80 | 2.5 명령에 `src/pages/place/__tests__/PlacePage.test.tsx` 를 더하고, 8.1 의 이 주입 행에 어느 파일의 어느 줄이 빨개져야 하는지 적는다. |
| T-2 | REVISE | **App 의 호출을 빼는 회귀를 잡는 검사가 없다.** `isPlaceHost` 는 모듈을 import 할 때 정해지는 상수라서(App.tsx:80) 2.4 대안처럼 분기 함수를 `inflow.ts` 에 두면, 검사는 그 함수만 재고 App.tsx 의 호출 한 줄은 재지 않는다. 그 줄을 지워도 1~7 그룹 테스트는 모두 초록이다. 이 기능에서 가장 빠지기 쉬운 줄인데 8.1 주입 목록에도 없다. | App.tsx:80, tasks.md:23(2.4)·80(8.1) | (a) App 을 place 호스트 `location` 으로 렌더해 대기열에 `place-entry` 한 건, 비 place 호스트에서는 0건임을 보는 테스트를 둔다. 또는 (b) App 이 부르는 함수를 export 해 그 함수를 직접 검사하고, 「App.tsx 가 그 함수를 부른다」는 사실은 grep 게이트로 잡는다. 어느 쪽이든 8.1 에 「App.tsx 호출 제거」 주입을 더한다. |
| T-3 | REVISE | **RBAC 범위 검사가 레포에 남지 않는다.** 7.1 스크립트는 스크래치패드에만 두고, 8.1 의 「Role 에 `secrets` get 추가」 주입도 그 스크립트로 빨간불을 본다. 구현이 끝나면 게이트가 사라져, 다음에 누가 Role 을 넓혀도 잡히지 않는다. 레포에는 place-ingest 테스트가 k8s 파일을 읽어 egress 범위를 단언하는 선례가 이미 있다. | tasks.md:69·80, `place/ingest/tests/datagokr_test.py:1,14`(`REPO` 로 k8s 파일 단언) | Role 의 verbs·resources 정확 일치와 `automountServiceAccountToken: true` 가 crawl-stats CronJob 하나뿐인지를 `place/ingest/tests/crawl_stats_k8s_test.py` 로 커밋한다. |
| T-4 | REVISE | **방침 테스트가 리터럴만 확인한다.** 4.1 은 문구가 있는지만 본다. 새 행의 「90일」은 `analytics.events` TTL 과 같아야 하는데, 레포의 같은 종류 검사(검색어 행)는 V005 SQL 에서 TTL 을 읽어 방침 행의 숫자와 비교한다. 4.1 은 그 선례를 쓰지 않고, 이미 있는 테스트 파일 대신 새 파일(`PrivacyPage.test.tsx`)을 만든다. 근거 인용(`V004__events.sql:22`)도 틀렸다. V004 의 표는 V005 가 DROP 했으므로 TTL 원본은 V005 다. | `privacyRetention.test.ts:162-178`, `V005__events_two_axis.sql:11,50`, spec.md:62, tasks.md:41 | 4.1 을 `privacyRetention.test.ts` 에 `describe('place 첫 방문 유입')` 로 넣고, V005 의 TTL 정규식으로 뽑은 일수가 새 행에 있는지 단언한다. spec SR-5.3 의 근거 인용은 `V005__events_two_axis.sql:50` 으로 고친다. |
| T-5 | REVISE | **SR-9 질의는 문법만 검증된다.** 8.7 은 「오류 없이 행을 낸다」만 본다. 그래서 유입원 `multiIf` 분류가 틀려도(정규식 이스케이프, 순서) 잡히지 않는다. SR-9 는 「이 슬라이스의 산출물」인데 의미를 재는 검사가 없다. | spec.md:88-117, tasks.md:86 | 운영 ClickHouse 에서 리터럴 표(`SELECT … FROM values('rh String', 'www.google.com', 'www.google.co.kr', 'com.google.android.googlequicksearchbox', 'm.search.naver.com', 'search.daum.net', 'www.bing.com', 'chatgpt.com', 'blog.1989v.com', '')`)에 같은 `multiIf` 를 돌린다. 기대 라벨과 한 표로 맞춰 `verifications/` 에 남긴다. 주입은 정규식의 `$` 하나를 지워 보는 것으로 한다. |
| T-6 | REVISE | **운영 확인 (a)가 「q= 없음」을 증명하지 못할 수 있다.** CDP 로 `Referer` 헤더만 넣으면 `document.referrer` 는 빈 값이거나 origin 만 남을 수 있다(기본 referrer-policy 가 strict-origin-when-cross-origin). 그러면 payload 에 `q=` 가 없는 것은 우리가 잘라서가 아니라 애초에 들어오지 않아서다. 검사가 스스로 만든 근거다. | spec.md:86, tasks.md:84 | 측정 명령 안에서 `Runtime.evaluate('document.referrer')` 값을 같이 기록한다. 그 값이 `q=x` 를 담고 있을 때만 (a) 를 증거로 인정한다. 진입은 `Page.navigate({url, referrer, referrerPolicy:'unsafe-url'})` 로 한다. |
| T-7 | MINOR | 공용 픽스처의 모양이 정해져 있지 않다. TS 는 SR-4 행만, 파이썬은 봇 전용 5유형까지 읽어야 하는데 둘을 가르는 필드가 없다. 그리고 파이썬 테스트는 CI 가 돌리지 않으므로, TS 쪽만 바꾸고 픽스처를 고치면 파이썬 불일치가 CI 에서 드러나지 않는다. | tasks.md:12, `ci.yml:193`(`place/ingest/*` 는 테스트 대상 아님) | 픽스처를 `[{path, landing, crawl}]` 로 정한다. 「파이썬은 로컬에서만 돈다」는 사실을 tasks 5.4 에 적고, 그룹 8 의 커밋 전 체크에 `pytest tests/crawl_stats_test.py` 를 넣는다. |
| T-8 | MINOR | 6.1 은 스키마 테스트의 개수 단언(7)을 올리라고만 한다. V005 선례처럼 **배포 파일 내용**(엔진 `ReplacingMergeTree(requests)`·ORDER BY·`TTL … 400 DAY`)을 단언하는 항목이 없다. 5.1 의 쓰기 단언도 `crawler_requests_hourly` 만 보고 coverage 표 INSERT 는 보지 않는다. | `ClickHouseSchemaInitializerTest.kt:54,128,68-83`, tasks.md:50·60 | 6.1 에 V00N 파일 내용 단언을, 5.1 에 coverage 표 본문 단언을 더한다. 8.1 에 「버전 열을 `collected_at` 으로 바꿈」 주입을 하나 더한다. |
| T-9 | MINOR | 5.1 이 말하는 「가짜 HTTP 서버(Recorder 선례)」는 실제로는 주입받는 fetch 함수다. 표현이 어긋나 HTTP 서버를 새로 띄우는 과잉 구현을 부를 수 있다. | `datagokr_test.py:33-42` | 「fetch 함수를 주입하는 Recorder 선례」로 고친다. |

체크리스트: AC→테스트 매핑(부분 — SR-9·App 배선·방침 숫자 빈칸), 레이어 배치(적절), 목 경계(실제 트래커 사용, 적절), 테스트 데이터(픽스처 모양 미정), 부정·경계(UTM·리퍼러는 충분, 봇 로그의 깨진 요청줄 `"-"` 과 400 쓰레기 줄 케이스는 없음 — 5.1 에 1건 추가 권고), 명명(`*.test.ts`·`*_test.py`·BehaviorSpec 모두 기존과 일치).

---

## 2. domain — REVISE

| # | 심각도 | 발견 | 근거 | 수정안 |
|---|---|---|---|---|
| D-1 | REVISE | **「허브 세션」과 place-entry 의 관계가 틀리게 적혀 있다.** 스펙은 「허브로 착지한 세션은 두 행」이라고 하지만 실제 `place-hub` 행은 착지가 아니라 **PlacePage 를 처음 마운트할 때** 나간다. 상세에 착지한 뒤 SPA 로 허브로 가도, 속성 랜딩(`/regions/:code/:attr`, PlacePage 를 렌더)으로 착지해도 `place-hub` 행이 생긴다. Q1 의 「허브 SESSION_START 는 상세·지역 착지 세션을 못 센다」도 반쯤만 맞다. | spec.md:25, open-questions.yml:6, `PlacePage.tsx:536-540`, `PlaceLandingRoute.tsx:32`, 선례 스펙 `2026-10-08-place-hub-instrumentation/spec.md:26` | SR-1.2 를 「같은 session_id 에서 `place-hub` ⊆ `place-entry` 다. place-hub 는 그 세션이 허브 또는 속성 랜딩을 한 번이라도 연 것을 뜻한다」로 고친다. SR-9 에 **일치 점검 지표**를 더한다: `place-hub` 는 있고 `place-entry` 는 없는 세션 수(배포 뒤 0 이어야 한다. 저장소 실패 폴백만 예외). 이 지표는 기존 허브 계측이 새 계측을 독립적으로 재는 장치가 된다. |
| D-2 | REVISE | **같은 원장에서 `landing` 이 세 가지 뜻으로 쓰인다.** payload 키 `landing`(착지 유형), 그 값 중 하나인 `landing`(속성 랜딩 페이지), 허브 SEARCH 의 `trigger: 'landing'`(마운트 뒤 첫 질의)이다. `JSONExtractString(payload,'landing')='landing'` 같은 질의는 읽는 사람이 해독해야 한다. | spec.md:28·51, `PlacePage.tsx:305` | 키를 `landingType` 으로, 값 `landing` 을 `attr_landing`(또는 `region_attr`)으로 바꾼다. SR-4·SR-6.4 표, 픽스처, SR-9 질의를 같이 고친다. |
| D-3 | REVISE | **「같은 출처」와 「리퍼러 없음」이 같은 빈 값이다.** 같은 호스트에서 새 탭을 열면(noopener 라 sessionStorage 를 새로 받는다) 새 세션이 `direct` 로 잡힌다. 그러면 직접 유입이 실제보다 부푼다. | spec.md:33(SR-2.2) | 같은 호스트일 때 `referrerHost='self'` 를 넣고, SR-9 유입원에 `self` 를 따로 둔다. 「place 세션」 집계에서 뺄지는 SR-9 에 명시한다. |
| D-4 | REVISE | **세션 불변식이 집계에서 지켜지지 않는다.** 「세션당 1행」은 클라이언트만 지킨다. 저장소 폴백 경로에서는 새로고침마다 한 행이 생겨서(SR-1.3) 한 세션이 착지 유형 두 칸에 잡힐 수 있다. 그러면 착지 유형별 합이 세션 수보다 커진다. | spec.md:26·96, `EventCollectDtos.kt:67-68`(eventId 가 viewId 기반이라 새로고침 행은 서로 다른 id) | SR-9 질의를 세션당 첫 행 기준으로 바꾼다: `argMin(landingType, timestamp)`, `argMin(rh, timestamp)` 를 `GROUP BY session_id` 한 뒤 집계한다. |
| D-5 | REVISE (사람 판단) | **경계: place-ingest(place BC) 잡이 analytics 가 스키마를 가진 표에 쓴다.** 지금까지 place-ingest 는 analytics ClickHouse 를 읽기만 했다(V006 은 「`links` 잡이 이 표만 읽는다」). 프로젝트 규칙은 「서비스 간 DB 공유 금지」이고, 데이터 자체도 place 도메인이 아니라 portal-fe 전체 호스트의 운영 로그다. | spec.md:74·77·79, `V006__attraction_popularity_daily.sql:1`, CLAUDE.md 「Architecture」 | 둘 중 하나를 스펙에 명시한다. (a) 「표의 주인은 analytics, place-ingest 이미지는 실행 장소일 뿐」이라는 결정을 ADR-0095 또는 0077 에 한 줄 남기고, 잡 이름·README 에 「place 도메인 아님」을 밝힌다. (b) 다른 실행 위치를 고른다. 무료 티어 근거(SR-7.1 a)는 타당하므로 (a) 를 권한다. |
| D-6 | MINOR | 「봇 요청」이 실제로는 「원본(nginx)에 도달한 봇 요청」이다. Cloudflare 가 기본 확장자(js·css·이미지)를 캐시하므로 `asset` 칸은 실제 크롤보다 작게 잡힌다. HTML·xml 은 `no-cache`/짧은 TTL 이라 영향이 작다. | `nginx.conf:406-409`(`/assets/` immutable), ADR-0105:40 | SR-6 에 「수치는 원본 도달 요청」을 한 줄 적는다. `asset` 칸은 추이용으로만 읽는다. |
| D-7 | MINOR | `path_type` 은 place 표로 분류하므로 다른 호스트의 `/`·`/en` 도 `hub` 가 된다(게임 허브 등). SR-6.4 는 「대개 other」라고 하지만 루트는 예외다. | spec.md:69 | 비 place 호스트는 SR-4 표를 건너뛰고 `other`(또는 봇 전용 5유형)로만 분류하거나, SR-9 에 「path_type 은 host='place.1989v.com' 에서만 읽는다」를 적는다. |
| D-8 | MINOR | 용어집(`docs/product/glossary.md`)이 없다. 이 스펙이 만든 용어(유입원·착지 유형·place 세션·커버리지·partial)가 정의되지 않은 채 쓰인다. | Glob 결과 0건 | 구현 뒤 `/hns:glossary` 로 위 용어를 등록한다. |

체크리스트: BC 경계(D-5), 용어집(없음 → REVISE), 어휘 일치(D-2), 불변식(D-4), 이벤트 범위(PAGE/place-entry 는 기존 PAGE 규약과 맞다 — `events.ts:79-88`), 교차 참조(D-5), VO 분류(`referrerHostOf`·`utmOf`·`landingTypeOf` 순수 함수 — 적절).

---

## 3. usecase — REVISE

| # | 심각도 | 발견 | 근거 | 수정안 |
|---|---|---|---|---|
| U-1 | REVISE | **「검색 유입」 정의에 커뮤니티 유입이 섞인다.** `naver.com$`·`daum.net$`·`google.` 이 `blog.naver.com`·`cafe.naver.com`·`cafe.daum.net`·`mail.google.com`·`docs.google.com` 까지 「검색엔진」으로 센다. 사용자 스토리 1(검색 작업의 효과)과 2(커뮤니티 출시 I2-4)를 가르는 것이 이 지표의 목적인데, 네이버 카페·블로그 출시 유입이 검색으로 잡힌다. | spec.md:10-11·94-95·105-108 | 유입원을 `search_google`(`^(www\.)?google\.[a-z.]+$` + 구글 앱), `search_naver`(`^(m\.)?search\.naver\.com$`), `search_daum`(`^(m\.)?search\.daum\.net$`), `search_bing`(`^www\.bing\.com$`), `community_naver`(blog·cafe·in), `community_daum`(cafe) 등으로 나눈다. 「검색 유입 세션」은 `search_*` 만 센다. 이 분류를 T-5 의 리터럴 표로 검증한다. |
| U-2 | REVISE | **운영 확인 행이 지표를 오염시킨다.** 8.5 가 `utm_source=test` + google 리퍼러로 넣는 행은 그날 「google 검색 유입 세션」 1건으로 잡힌다. 기준선이 하루 0건(플랜 §1)이라 그 1건이 지표 전부가 된다. 허브 세션 51건이 「대부분 측정·검증 트래픽」이었던 것과 같은 문제다. | tasks.md:84, spec.md:86·89, `docs/plans/2026-10-10-place-search-inflow-plan.md:10-11` | SR-9 공통 조건에 `JSONExtractString(payload,'utmMedium') != 'spec'`(검증 표지)를 넣고, 검증 진입은 그 표지를 꼭 달게 한다. 앞으로 운영 확인은 모두 같은 표지를 쓴다고 SR-8.4 에 적는다. |
| U-3 | REVISE | **단축 주소로 붙인 UTM 은 사라진다.** `/p/{code}` 리다이렉터가 요청 쿼리를 버리고 상세로 302 한다(테스트가 `utm_source=x` 를 넣고 Location 에 쿼리가 없음을 확인한다). 커뮤니티 출시 링크를 단축 주소로 공유하면 스토리 2 가 성립하지 않는다. apex 옛 주소(`/place/...`·`/regions/...`·`/attractions/...`)로 들어온 방문은 `PlaceHostRedirect` 가 JS 로 넘기므로 원래 리퍼러가 사라지고 `internal`(1989v.com)로 잡힌다. | `AttractionShortLinkControllerTest.kt:67-75`, `App.tsx:109-120` | SR-3 에 「캠페인 링크는 place 정규 주소에 UTM 을 붙인다. 단축 주소는 UTM 을 전달하지 않는다」를 적는다. SR-9 에 「`internal` 중 apex 리퍼러는 옛 apex 주소 경유일 수 있다」를 적는다. 봇 집계의 `host=1989v.com`·`path_type=detail` 건수로 옛 주소의 잔존 규모를 같이 본다. |
| U-4 | REVISE | **시간별 크롤 집계의 누락을 줄이지 못하는 모양이다.** 키에 파드가 없어서, 교체 전후 두 번 읽은 부분합을 합칠 수 없다. `ReplacingMergeTree(requests)` 는 최댓값만 남기므로 「옛 파드 50(14:20 실행)」과 「새 파드 10(15:05 실행)」이 있으면 60 이 아니라 50 이 된다. 결국 교체가 있었던 시간은 늘 덜 센다. portal-fe 는 replicas 1 이고 커밋마다 교체된다. 실패한 시간은 `backoffLimit: 0` 이라 재시도가 없다. 대상 시간을 「지금 기준 직전 정시」로만 정하므로 늦게 다시 돌리면 다른 시간을 읽는다. 중복은 없다(같은 줄을 두 번 읽어도 최댓값). | spec.md:75-78, `k8s/base/portal-fe/deployment.yaml:10`, `cronjob-visitors.yaml:32` | (a) 키에 `pod`(파드 이름 — 개인정보 아님)를 더한다. 질의는 `FINAL` 뒤 파드를 합한다. (b) 주기를 `*/15` 로 두고 현재·직전 시간을 함께 읽는다. 그러면 교체 손실이 「마지막 실행 뒤 ≤15분」으로 준다. (c) `--hour=YYYY-MM-DDTHH` 인자로 수동 재실행할 시간을 고정할 수 있게 한다. (d) `partial` 판정 기준을 파드 시작 시각이 아니라 컨테이너 `state.running.startedAt` 으로 한다(재시작은 파드 시작 시각을 바꾸지 않는다). (e) coverage 는 최신 실행을, requests 는 최댓값을 남겨 둘이 서로 다른 실행을 가리킬 수 있다. coverage 에도 같은 「최대 덮음」 기준을 쓴다. |
| U-5 | REVISE | **`hour DateTime` 의 시간대가 정해져 있지 않다.** nginx 는 `+0000` 이고 질의는 `toDate(hour,'Asia/Seoul')` 인데, 잡이 문자열로 쓰면 ClickHouse 서버 시간대로 해석된다. 레포에 파이썬이 ClickHouse 에 DateTime 을 쓰는 선례가 없다. | spec.md:77·115 | 열을 `DateTime('UTC')` 로 하고 JSONEachRow 에는 epoch 초를 쓴다. 5.1 에 「19:18 +0000 줄 → hour=19:00 UTC → KST 날짜 다음 날 04시」 경계 케이스를 둔다. |
| U-6 | MINOR | **이른 이탈 유실.** 착지 행은 5초 타이머나 pagehide 로 나가는데, `installFlushOnLeave` 는 허브·상세·지역·통합검색에만 있다. 편집(`/guides`)·기타 착지에서 5초 안에 떠나면 그 행은 사라진다. JS 가 뜨기 전에 떠난 방문도 안 잡힌다. | spec.md:29, `installFlushOnLeave` 사용처 4곳(`PlacePage.tsx:535`·`RegionPage.tsx:156`·`AttractionPage.tsx:236`·`UnifiedSearchPage.tsx:43`) | `recordPlaceEntry` 가 `installFlushOnLeave` 를 한 번 설치한다(중복 설치는 무해하다 — 두 번째 flush 는 빈 큐). 독립 대조로 nginx 로그의 사람 UA·HTML 요청·외부 리퍼러 건수와 `place-entry` 건수를 주 1회 비교하는 지표를 SR-9 에 넣는 것을 권한다(로그에 리퍼러가 이미 있다 — 플랜 §1 의 「0건 / 24시간」이 그 측정이다). |
| U-7 | MINOR | 봇 분류가 Google 의 다른 크롤러(`Google-InspectionTool`·`GoogleOther`·`Storebot-Google`)와 `ChatGPT-User`(사용자 요청 가져오기)를 버린다. GSC 크롤 통계와 맞춰 볼 때 차이의 원인이 된다. | spec.md:67 | `google-other` 칸을 하나 더하거나 「googlebot 칸은 UA 에 Googlebot 이 있는 것만」을 SR-9 읽는 법에 적는다. |
| U-8 | MINOR | SR-8.4(b) 의 grep 대조 명령이 정해져 있지 않다(시간 창, 대소문자, OAI/GPTBot 이 같이 든 줄 제외, 교체된 파드). 독립 계측기가 되려면 명령이 고정돼야 한다. | spec.md:86, tasks.md:85 | `grep -i 'googlebot' | grep -vi -e 'oai-searchbot' -e 'gptbot' | grep '\[DD/Mon/YYYY:HH:'` 형태를 tasks 8.6 에 적고, 잡과 같은 실행 창에서 잰다. |
| U-9 | MINOR | 사용자가 무엇을 보고 판단하는지 적혀 있지 않다. 하루 0~수 건이라 일 단위는 잡음이 크다. 그리고 표의 유입원 정의(spec.md:94)와 SQL(:105)이 구글 앱 처리에서 글자가 다르다(결과는 같다). | spec.md:88-117 | SR-9 에 「주간 합계로 읽는다. 커버리지 24/24 미만인 날의 봇 수치는 하한값이다」를 한 줄 넣고, 표와 SQL 을 한 문안으로 맞춘다. |

체크리스트: 행위자-목표(운영자·방문자는 명확, 「검색 로봇」은 행위자 아닌 대상 — 적절), 주·대체·예외 흐름(저장소 실패·수집 거절·CH 500 은 있음. 이른 이탈·교체 중 실행·실패 시간 재실행은 없음 → U-4·U-6), 사전·사후조건(배포 순서 nginx→잡이 SR-6.6 의 `unknown` 으로 다뤄짐 — 적절), AC 추적(SR-5.4 개정일·SR-9 의미에 대응 태스크 없음 → T-4·T-5), 경계 확장(U-1·U-3·D-3), 테스트 매핑(§1 참조).

---

## 요청 질문에 대한 답

- **회귀 주입이 컴파일되는 회귀로 빨강을 내는가 / 자기 사본을 재지 않는가** — 11건 중 9건은 리터럴 기대값과 공용 픽스처로 대상의 산출물을 본다. 예외는 두 건이다. 허브 payload 주입은 지정 명령으로는 초록이다(T-1). RBAC 주입은 레포에 남지 않는 스크립트를 잰다(T-3). 빠진 주입이 둘 있다: App 호출 제거(T-2), SR-9 분류(T-5). 운영 확인 (a)는 자기 근거가 될 위험이 있다(T-6).
- **일 집계 정의의 모호성** — 검색과 커뮤니티가 섞이고(U-1), self 와 direct 가 섞이고(D-3), 한 세션이 여러 칸에 잡히고(D-4), 시간대가 정해져 있지 않다(U-5).
- **허브 SESSION_START 와의 관계** — 착지 기준이 아니라 PlacePage 마운트 기준이다. ⊆ 관계와 일치 점검 지표를 넣는다(D-1).
- **시간별 크롤 집계의 누락·중복** — 중복은 없다. 누락은 교체가 있었던 시간마다 생기고 지금 키 구조로는 줄일 수 없다(U-4).
- **사용자가 유입을 판단할 수 있는가** — U-1·U-2·U-3 을 고치기 전에는 아니다. 검증 행 1건이 기준선 전체가 되고, 커뮤니티 출시 효과가 검색 효과로 읽힌다.

VERDICT: REVISE
