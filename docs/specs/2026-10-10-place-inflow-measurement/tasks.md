# Tasks: place 유입 측정 — 세션 유입 기록 · 봇 크롤 집계

스펙: `spec.md`. 심판 판정: `context/review-verdict.md`(S1 BLOCK 반영 완료 — 구현 착수 가능). 작업 위치는 워크트리 `scratchpad/wt-impl` 만. 커밋은 경로를 지정해 그룹마다. 테스트는 바꾼 파일만 지정해 돌린다(전체 스위트 금지). 타입 검사는 `npx tsc -b` 다 — `portal-fe/tsconfig.json` 이 `"files": []` 솔루션 파일이라 `--noEmit -p .` 는 0개 파일을 검사하고 성공한다(`ci.yml:284-290`).

## Task Group 1: 유입 값 정규화 (화면 순수 함수)
**Dependencies:** 없음
**Phase:** 1
**Required Skills:** TypeScript, vitest

- [ ] 1.1 테스트 먼저: `portal-fe/src/analytics/__tests__/inflow.test.ts` — `referrerHostOf` 표 케이스(빈 값·파싱 실패·`javascript:` 스킴·같은 호스트 → `'self'`·다른 1989v 서브도메인 유지·`https://www.google.com/search?q=비밀&token=x` → `www.google.com`·포트·사용자 정보 제거·대문자 → 소문자·`android-app://com.google.android.googlequicksearchbox/` → 패키지명·254자 → 빈 값), `utmOf` 케이스(정상·65자 → `invalid`·`a@b.com` → `invalid`·한글 → `invalid`·공백만 → 키 없음·다른 키 무시), `landingTypeOf` 를 SR-4 표 전 행(`/regions/11/pet` → `attr_landing`) + 끝 슬래시 + `/en` 접두 + `/favorites` → `other` 로. 기대값은 리터럴로 쓴다(함수 출력으로 기대값을 만들지 않는다)
- [ ] 1.2 `portal-fe/src/analytics/inflow.ts` 에 `referrerHostOf`·`utmOf`·`landingTypeOf`·`langOf` 구현 (SR-2·SR-3·SR-4)
- [ ] 1.3 같은 SR-4·SR-6.4 경로 표를 공용 픽스처 `place/ingest/tests/fixtures/path_types.json` 으로 둔다. 모양은 `[{"path": "/regions/11/pet", "landing": "attr_landing", "crawl": "attr_landing"}, {"path": "/sitemap-places-4.xml", "landing": "other", "crawl": "sitemap"}, …]` — `landing` 은 화면(`landingTypeOf`), `crawl` 은 파이썬 봇 집계의 기대값이다. 1.1 테스트는 이 파일을 **`readFileSync` 로 런타임에 읽는다 — `import` 하지 않는다**(`tsconfig.app.json:30` 의 `include: ["src"]` 밖이고, 이미지 빌드 컨텍스트가 `portal-fe` 뿐이라 import 하면 `Dockerfile:45` 의 `tsc -b` 가 깨진다). 레포 루트는 `privacyRetention.test.ts` 의 `REPO` 선례로 찾는다
- [ ] 1.4 검증: `cd portal-fe && npx vitest run src/analytics/__tests__/inflow.test.ts && npx tsc -b`

## Task Group 2: 유입 이벤트 발화
**Dependencies:** Task Group 1
**Phase:** 1
**Required Skills:** React, vitest

- [ ] 2.1 테스트 먼저: `portal-fe/src/analytics/__tests__/placeEntry.test.ts` — 실제 트래커(`resetTrackerForTest`·`resetIdentityForTest`·`sessionStorage.clear()`)로 `recordPlaceEntry()` 를 두 번 불러 대기열에 `SESSION_START`/`PAGE`/`place-entry`/`PLACE_ENTRY` 한 건, payload 가 `{ referrerHost, landingType, lang, utmSource, utmMedium, utmCampaign }` 이고 `null`·`undefined` 값이 없음(`Object.values` 단언), UTM 없는 진입에서 UTM 키 부재, `sessionStorage.setItem` 이 던질 때 모듈 변수로 1회. beacon 케이스는 **`/guides` 착지**(화면 쪽 `installFlushOnLeave` 가 없는 화면)로 두고, 화면을 렌더하지 않은 채 `navigator.sendBeacon` stub + `pagehide` 로 beacon 본문에 그 행이 있음을 단언한다 — `recordPlaceEntry` 가 직접 설치했는지를 재는 케이스다(SR-1.6). `document.referrer`·`location` 은 `Object.defineProperty`/`history.replaceState` 로 둔다
- [ ] 2.2 `inflow.ts` 에 `recordPlaceEntry()`(첫 호출에서 `installFlushOnLeave()` 한 번 설치)·`resetPlaceEntryForTest()` (플래그 `kgd.place.entryRecorded`, SR-1.3·1.6), `events.ts` `ScreenType` 에 `PLACE_ENTRY`
- [ ] 2.3 `App.tsx` 부팅 시 `isPlaceHost` 일 때 한 번 호출(SR-1.1·1.4). 허브 `PlacePage.tsx:536-540` 은 바꾸지 않는다
- [ ] 2.4 `App` 을 place 호스트(`place.1989v.com`)와 비 place 호스트(`1989v.com`)로 각각 렌더해 대기열의 `place-entry` 가 1건/0건임을 단언한다. `isPlaceHost` 는 모듈 상수(`App.tsx:80`)라 호스트마다 `vi.resetModules()` 후 `location` 을 바꾸고 동적 import 한다. 렌더가 불가하면(지연 라우트·전역 부작용) 대안으로 `App.tsx` 에 `recordPlaceEntry()` 호출 줄이 `isPlaceHost` 분기 안에 있는지 보는 grep 게이트를 2.5 명령에 넣고, 그 사실을 기록한다
- [ ] 2.5 검증: `cd portal-fe && npx vitest run src/analytics/__tests__/placeEntry.test.ts src/analytics/__tests__/inflow.test.ts src/analytics/__tests__/tracker.test.ts src/pages/place/__tests__/PlacePage.tracking.test.tsx src/pages/place/__tests__/PlacePage.test.tsx <2.4 의 App 테스트 파일> && npx tsc -b`

## Task Group 3: 수집 서버 확인 (코드 변경 없음이 목표)
**Dependencies:** 없음
**Phase:** 1
**Required Skills:** Kotlin, Kotest, MockMvc

- [ ] 3.1 테스트 먼저: `EventCollectControllerTest.kt` 에 1케이스 — 사람 브라우저 UA, `SESSION_START`/`PAGE`/`place-entry`, payload 여섯 키(`landingType` 포함)를 보내 `slot<List<AnalyticsEvent>>` 의 `payload` 가 같은 키·값(리터럴)이고 `accepted == 1`
- [ ] 3.2 `EventRepositoryAdapter` 의 `objectMapper.writeValueAsString(event.payload)` 를 거친 문자열에서 `JSONExtractString` 으로 읽힐 모양(평평한 문자열 맵)인지 기존 어댑터 테스트에 단언 1줄 — 없으면 3.1 로 갈음하고 그 사실을 기록
- [ ] 3.3 서버 코드가 바뀌지 않았음을 `git diff --stat -- analytics/app/src/main/kotlin` 이 빈 출력으로 확인(리소스의 새 V 파일은 그룹 6 몫)
- [ ] 3.4 검증: `./gradlew :analytics:app:test --tests '*EventCollectControllerTest'`

## Task Group 4: 개인정보처리방침
**Dependencies:** Task Group 2
**Phase:** 1
**Required Skills:** React, 문서

- [ ] 4.1 테스트 먼저: `portal-fe/src/pages/__tests__/privacyRetention.test.ts` 에 `describe('place 첫 방문 유입')` 를 더한다 — 선례(`:162-178`)처럼 `V005__events_two_axis.sql` 의 TTL 일수를 정규식으로 읽고, 방침 2항의 「place 방문을 시작할 때」 행이 「직전 사이트의 도메인」과 **그 일수**를 담는지, 접속 로그 문단에 「검색엔진·AI 수집 로봇」·「시간당 건수로만」 문장이 있는지 단언
- [ ] 4.2 `PrivacyPage.tsx` §2 표 한 행 + 접속 로그 문단 한 문장, 개정일(SR-5)
- [ ] 4.3 검증: `cd portal-fe && npx vitest run src/pages/__tests__/privacyRetention.test.ts`

## Task Group 5: 봇 로그 파서·집계 잡
**Dependencies:** Task Group 1 (경로 표 픽스처)
**Phase:** 2
**Required Skills:** Python, pytest

- [ ] 5.1 테스트 먼저: `place/ingest/tests/crawl_stats_test.py` — 파서: 운영 실측 줄 + `"place.1989v.com"` → `(googlebot, place.1989v.com, sitemap, 200)`, 호스트 칸 없는 옛 줄 → `unknown`, 위조 호스트 → `other`, 쿼리 절단, UA 우선순위(`OAI-SearchBot` 와 `GPTBot` 이 같이 있으면 `oai-searchbot`), 사람 UA → None, 상태 칸 7종, 픽스처 `path_types.json` 전 행의 `crawl` 값. 시간 경계: `[10/Oct/2026:19:18:01 +0000]` 줄이 `hour` epoch `1791658800`(2026-10-10T19:00Z)에 들고, SR-9 의 `toDate(hour,'Asia/Seoul')` 기준 **KST 다음 날(10-11) 04시**임을 리터럴로 단언. 집계: 두 파드의 같은 칸이 파드별 두 행으로 남음, 정시 경계 밖 줄 제외, `partial` 판정 3케이스(첫 줄 시각 > 시간 시작 · 컨테이너 시작 > 시간 시작 · 둘 다 아님). `--hour=` 인자가 그 시간 창을 고름. 쓰기: fetch 함수를 주입하는 `Recorder` 선례(`datagokr_test.py:33-42`)로 받은 본문이 `INSERT INTO analytics.crawler_requests_hourly FORMAT JSONEachRow` + 기대 행(`hour` 가 epoch 초, `pod` 포함)이고, `INSERT INTO analytics.crawler_log_coverage_hourly FORMAT JSONEachRow` 본문에 `first_line_at`·`container_started_at`·`partial` 이 기대값으로 있음, ClickHouse 500 → 잡 종료 코드 ≠ 0. 쿠버네티스 API 호출은 SA 토큰 헤더, `labelSelector=app.kubernetes.io/name%3Dportal-fe` 경로, `timeout` 인자 전달을 단언
- [ ] 5.2 `place/ingest/src/crawl_stats.py`(파서·집계·API 읽기(스트리밍)·쓰기), `main.py` 에 `--job=crawl-stats` 디스패치와 docstring 잡 목록 한 줄. 경로 유형은 픽스처와 같은 표를 코드 상수로
- [ ] 5.3 IP·UA 원문·전체 경로가 반환값·로그 메시지에 없음을 테스트로 단언(SR-6.6) — 정상 줄과 **깨진 줄**(따옴표 짝 안 맞음·상태 코드 자리에 문자) 둘 다 넣고 `capsys` 로 stdout/stderr 에 IP(`10.42.0.73`)·UA 조각(`Googlebot/2.1`)이 없고 파싱 실패 **건수**만 있음을 본다
- [ ] 5.4 검증: `cd place/ingest && python -m pytest tests/crawl_stats_test.py -q` (CI 가 `place/ingest/*` 를 테스트하지 않으므로 그룹 8 커밋 전에도 다시 돈다)

## Task Group 6: ClickHouse 표
**Dependencies:** 없음
**Phase:** 2
**Required Skills:** ClickHouse, Kotlin

- [ ] 6.1 테스트 먼저: `ClickHouseSchemaInitializerTest.kt` — 스크립트 수 단언(`:54`, `:128` 의 `shouldBe 7`)을 새 수로 올리고, V007 선례(`:85-93`)처럼 새 V 파일을 `statementsOf` 로 갈라 두 표의 엔진(`ReplacingMergeTree(requests)`·`ReplacingMergeTree(lines)`)·`ORDER BY`(`pod` 포함)·`TTL hour + INTERVAL 400 DAY`·`DateTime('UTC')` 를 단언한다. 문장 수도 단언한다(꼬리 주석 `;` 가 문장을 더 만들면 빨개진다)
- [ ] 6.2 `analytics/app/src/main/resources/clickhouse/analytics/V{다음}__crawler_requests.sql` — SR-7.4·7.5 두 표. 꼬리 주석에 `;` 금지(SR-7.6). 번호는 `git fetch && git ls-tree origin/main analytics/app/src/main/resources/clickhouse/analytics/` 로 확인
- [ ] 6.3 검증: `./gradlew :analytics:app:test --tests '*ClickHouseSchemaInitializerTest'`

## Task Group 7: 쿠버네티스 배선 · nginx 로그 형식
**Dependencies:** Task Group 5, 6
**Phase:** 2
**Required Skills:** Kubernetes, nginx, NetworkPolicy

- [ ] 7.1 테스트 먼저: `place/ingest/tests/crawl_stats_k8s_test.py` 를 **레포에 커밋한다**(선례 `datagokr_test.py:14,120-130` 이 `REPO / "k8s"` 매니페스트를 읽어 단언한다). 단언: (a) Role `place-crawl-stats` 의 규칙이 정확히 `{pods: [list], pods/log: [get]}` 와 같다(포함이 아니라 일치) (b) SA `place-crawl-stats` 를 `serviceAccountName` 으로 쓰는 CronJob 은 `place-crawl-stats` 하나뿐이고, 그 파드 스펙에 `automountServiceAccountToken: true`, 다른 place-ingest CronJob 의 `serviceAccountName` 은 없다 (c) 그 파드 템플릿 라벨 `app.kubernetes.io/name` 이 `place-crawl-stats` 이고 `part-of` 라벨이 없다 (d) `0.0.0.0/0` egress 를 여는 정책(`11-…`)의 선택 목록에 `place-crawl-stats` 가 없다 (e) `09-allow-app-to-clickhouse.yaml` 목록에 있다 (f) `21-allow-crawl-stats-egress.yaml` 의 egress 목적지가 ClickHouse 8123 과 API 서버 한 곳뿐이다 (g) env 에 `secretKeyRef` 가 없고 `securityContext` 가 SR-8.1 값이다. nginx 문법: `docker run --rm -e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS -v $PWD/portal-fe/nginx.conf:/etc/nginx/templates/default.conf.template:ro nginx:1.27-alpine nginx -t` (`nginx.conf:79` 의 `${NGINX_LOCAL_RESOLVERS}` 를 이미지와 같은 방식으로 채운다, `Dockerfile:71,78-79`)
- [ ] 7.2 `portal-fe/nginx.conf` — `log_format` + `access_log` (SR-6.1)
- [ ] 7.3 `k8s/base/place-ingest/cronjob-crawl-stats.yaml`·`rbac-crawl-stats.yaml`, kustomization 등록 (SR-8.1·8.2). `k8s/base/network-policy/09-allow-app-to-clickhouse.yaml:42` 목록에 `place-crawl-stats` 추가 + 주석 한 줄(쓰는 쪽 crawl-stats 잡, 표 주인 analytics), `21-allow-crawl-stats-egress.yaml` 새로 + network-policy kustomization 등록 (SR-8.3)
- [ ] 7.4 NetworkPolicy egress 의 API 서버 목적지 — 먼저 `ssh msa-oci` 로 임시 파드 탐침(15초 대기 + 무관 라벨 대조군)으로 `10.43.0.1:443` 과 노드 `:6443` 중 통하는 쪽을 정하고(Q2) 그 하나만 연다
- [ ] 7.5 검증: `cd place/ingest && python -m pytest tests/crawl_stats_k8s_test.py -q` 와 `kubectl kustomize k8s/overlays/oci-arm | grep -c 'place-crawl-stats'`(렌더만, 클러스터 접속 없음)

## Task Group 8: 회귀 주입 · 문서 · 배포 · 운영 확인
**Dependencies:** Task Group 1–7
**Phase:** 3
**Required Skills:** 검증, 문서, 배포(OCI)

- [ ] 8.1 회귀 주입은 임시 사본(`git worktree add` 또는 `cp -r`)에서 한 건씩 넣고 빨간불을 본 뒤 버린다: `referrerHostOf` 가 `href` 를 돌려줌 · 같은 호스트 `'self'` 분기 제거 · UTM 정규식 상한 제거 · `landingTypeOf` 의 `attr_landing` 행을 `region` 으로 · 세션 플래그 확인 제거(두 건 발화) · payload 에 `undefined` 키 하나 · `recordPlaceEntry` 의 `installFlushOnLeave` 설치 제거(2.1 beacon 케이스) · `App.tsx` 의 `recordPlaceEntry()` 호출 제거(2.4) · 허브 SESSION_START 에 payload 추가(빨개질 곳: `PlacePage.test.tsx:501` 의 `toEqual` — `PlacePage.tracking.test.tsx:172` 는 `toMatchObject` 라 안 빨개진다) · 파서 호스트 허용 목록 제거 · UA 우선순위 뒤집기 · 파싱 예외 메시지에 줄 원문 넣기(5.3) · ClickHouse 500 을 삼키기(종료 코드 0) · V 파일 버전 열을 `requests` → `collected_at` 으로(6.1) · V 파일 ORDER BY 에서 `pod` 제거(6.1) · **파드 라벨을 `place-ingest` 로 되돌림(7.1 (c)(d) 빨간불 — S1)** · Role 에 `pods get` 추가(7.1 (a) 정확 일치 빨간불) · Role 에 `secrets` get 추가(7.1 (a)) · SR-9 `multiIf` 의 `$` 하나 제거(8.7 리터럴 표 대조 빨간불). 결과를 `verifications/regression-injection.md` 에 주입·명령·빨간 줄로 적는다
- [ ] 8.2 문서: ADR-0095 §3 에 `place-entry` 행·payload 키와 「place-entry 의 view_id 는 단독 키 — 착지는 payload 가 말한다」, §5 소유 표 아래에 「`crawler_requests_hourly`·`crawler_log_coverage_hourly` — 스키마 소유 analytics, 쓰는 쪽 place-ingest 이미지의 crawl-stats 잡(실행 장소일 뿐 place 도메인 아님)」 한 줄. ADR-0070 에 개정 절 「crawl-stats 잡을 place-ingest 이미지에 얹는다」(얹는 이유: 새 이미지 없음·OCIR 10GB · 이 잡만 전용 SA·API egress·외부 egress 없음 · 관측 잡이 늘면 이미지 분리 재검토). `main.py` docstring 의 「배치 하나를 위해 권한을 늘리지 않는다」 옆에 예외 한 줄(crawl-stats 는 전용 라벨·SA 라 다른 잡 권한이 늘지 않는다). ADR-0077 원장 표에 봇 집계 표(개인정보 없음, TTL 400일). `place/ingest/README.md` 잡 목록에 `crawl-stats` 행 + 「place 도메인 아님 — 표 주인 analytics」. `k8s/overlays/oci-arm/README.md:163` CronJob 수 표(28 → 29). `analytics/CLAUDE.md` 표 목록. 플랜 `2026-10-10-place-search-inflow-plan.md` I0-5·I0-6 상태
- [ ] 8.3 커밋 전: `cd place/ingest && python -m pytest tests/crawl_stats_test.py tests/crawl_stats_k8s_test.py -q`(CI 밖 게이트), `git diff --cached` 로 핵심 줄(`recordPlaceEntry` 호출, `log_format`, CronJob·라벨 `place-crawl-stats`, Role, V 파일) 스테이지 확인 → 경로 지정 커밋 → 푸시(1989v 계정 전환·복귀·`gh api user`)
- [ ] 8.4 배포 확인: `ssh msa-oci 'sudo k3s kubectl -n commerce get cronjob place-crawl-stats; sudo k3s kubectl -n commerce logs deploy/portal-fe --tail=3'` — 줄 끝에 호스트가 붙었는지
- [ ] 8.5 운영 확인 SR-8.4 (a): 헤드리스 크롬(start·측정·stop 한 명령, 일반 Chrome UA, 크롤러 UA 금지)에서 `Page.navigate({url: 'https://place.1989v.com/attractions/{id}?utm_source=test&utm_medium=spec&utm_campaign=i0-5', referrer: 'https://www.google.com/search?q=x', referrerPolicy: 'unsafeUrl'})` 로 진입하고 **그 페이지의 `document.referrer` 값을 기록한다** — `q=` 를 담았을 때만 이 확인을 증거로 인정한다(헤더만 넣으면 `document.referrer` 가 빈 값일 수 있어 검사가 스스로 근거를 만든다). 이어서 ClickHouse 에서 그 행의 payload 원문을 읽어 `referrerHost='www.google.com'`·`landingType='detail'`·`search`·`q=` 부재까지 적는다. 메모: 구글 앱 행(`com.google.android.googlequicksearchbox`)은 0 일 수 있다 — 앱이 리퍼러를 안 보내거나, apex `/place/…` 로 들어와 `PlaceHostRedirect`(`App.tsx:109-114`)가 리퍼러를 apex 로 바꾸면 `internal` 로 잡힌다
- [ ] 8.6 운영 확인 SR-8.4 (b): 먼저 `ssh msa-oci "sudo k3s kubectl -n commerce logs deploy/analytics | grep '\[clickhouse\] 적용 V0'"` 로 새 V 파일 적용을 확인. 그 뒤 `ssh msa-oci 'sudo k3s kubectl -n commerce create job --from=cronjob/place-crawl-stats crawl-stats-check'`, 잡 로그, `crawler_requests_hourly FINAL` 의 직전 시간 `googlebot` 합(파드 합)과 같은 시간 portal-fe 로그의 고정 grep 수를 한 표에. grep 은 `ssh msa-oci "sudo k3s kubectl -n commerce logs deploy/portal-fe --since=2h" | grep -F '[10/Oct/2026:19:' | grep -i 'googlebot' | grep -vi -e 'OAI-SearchBot' -e 'GPTBot' | wc -l` 모양으로, 시간 창(`[dd/Mon/yyyy:HH:`)은 비교하는 UTC 시간으로 바꾼다(대소문자 무시·OAI/GPTBot 제외 — 파서의 첫 일치 순서와 같게)
- [ ] 8.7 검증: `ssh msa-oci "sudo k3s kubectl -n commerce exec deploy/analytics -- wget -qO- 'http://clickhouse:8123/?query=SELECT+count()+FROM+analytics.crawler_requests_hourly+FINAL'"` 가 0 보다 크고, SR-9 두 질의가 오류 없이 행을 낸다. 분류의 뜻: 리터럴 호스트 표(`www.google.com`·`www.google.co.kr`·`com.google.android.googlequicksearchbox` → `search_google`, `m.search.naver.com` → `search_naver`, `blog.naver.com`·`m.cafe.naver.com` → `community_naver`, `search.daum.net` → `search_daum`, `cafe.daum.net` → `community_daum`, `www.bing.com` → `search_bing`, `chatgpt.com` → `ai`, `blog.1989v.com`·`1989v.com` → `internal`, `self` → `self`, `''` → `direct`, `google.com.evil.io`·`naver.com.evil.io`·`www.naver.com`·`a b` → `other`)를 `SELECT … FROM values(...)` 로 SR-9 의 `multiIf` 에 그대로 넣어 기대 라벨과 대조하고 결과를 `verifications/source-classification.md` 에 남긴다
