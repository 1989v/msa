# Review Verdict — place 유입 측정 스펙 (2026-10-10)

대상: `spec.md` · `tasks.md` · `context/open-questions.yml`
입력: `engineer-review-a.md`(S1–S6 · I1–I9 · A1–A4), `engineer-review-b.md`(T-1–T-9 · D-1–D-8 · U-1–U-9), 총 45건
대조: 워크트리 `scratchpad/wt-impl` 의 레포 파일. 인용한 file:line 은 grep·sed 로 직접 확인했다.

## 판정 표

| id | 원판정 | 심판 | 근거(직접 확인) | 스펙에 반영할 편집 한 줄 |
|---|---|---|---|---|
| S1 | BLOCK | **keep BLOCK** | 스펙 결정: spec.md:83 「라벨 `app.kubernetes.io/name: place-ingest`(ClickHouse 허용을 그대로 받는다)」, :84 Role 범위가 ns `commerce`. 코드 위반: `11-allow-egress-https-public.yaml:34` `values: [auth, sideapp, …, place-ingest, …]` → `0.0.0.0/0` 443. 원칙: `main.py:29-30` 「배치 하나를 위해 권한을 늘리지 않는다」. 결정과 위반이 둘 다 인용됐으므로 BLOCK 자격이 있다 | SR-8.1 라벨을 `place-crawl-stats` 로 바꾸고 `09-allow-app-to-clickhouse.yaml:42` 에 추가한다. egress 는 DNS·CH 8123·API 서버 하나만 연다. 「이 SA 는 commerce 전 파드 로그를 읽는다 — 그래서 외부 egress 를 주지 않는다」를 위험 수용 문장으로 적는다. 7.1 단언과 8.1 주입(라벨 되돌림)을 추가한다 |
| S2 | REVISE | keep REVISE | spec.md:76 의 동작은 「나열 → pods/{name}/log」뿐이다. `pods get` 을 쓰는 단계가 없다 | SR-8.2 를 `pods: [list]`, `pods/log: [get]` 로 바꾼다. 7.1 은 정확히 일치하는지 비교한다 |
| S3 | REVISE | keep REVISE | `cronjob-visitors.yaml` env 에 `secretKeyRef: place-ingest-secrets / tour-api-key` 가 있다. SR-8.1 은 「기존 모양을 따른다」고만 적는다 | SR-8.1 에 「env 는 `CLICKHOUSE_URL` 뿐, secretKeyRef 없음 + securityContext(readOnlyRootFilesystem·runAsNonRoot·drop ALL)」를 적는다 |
| S4 | MINOR | keep MINOR | spec.md:61 「검색엔진 수집 로봇」, :67 분류에는 `gptbot`·`oai-searchbot` 이 있다. :60 「첫 방문」과 :26 「탭 세션당」이 어긋난다 | SR-5 문구를 「검색엔진·AI 수집 로봇」, 「place 방문을 시작할 때(탭마다 한 번)」로 고친다 |
| S5 | MINOR | keep MINOR | `EventCollectDtos.kt:89` `payload.orEmpty().filterValues { it != null }` — 값을 검증하지 않는다 | SR-9 에 「`referrerHost` 가 `^[a-z0-9.-]{1,253}$` 에 맞지 않으면 `other`」를 더한다 |
| S6 | MINOR | keep MINOR | `main.py:292` `log(f"… 실패: {e}")` 패턴이 실제로 있다 | SR-6.6·5.3 에 「파싱 예외는 건수만 센다. 깨진 줄 입력에도 stdout/stderr 에 IP·UA 가 없다」를 넣는다 |
| I1 | REVISE | keep REVISE | `portal-fe/tsconfig.json` 은 `"files": []` 이다. `ci.yml:288` 「`--noEmit` 이 아니라 `-b` 다」, `Dockerfile:45` `npx tsc -b --force` | tasks 1.4·2.5 를 `npx tsc -b` 로 바꾼다 |
| I2 | REVISE | keep REVISE | `images.yml` 에서 portal-fe context 는 `portal-fe` 뿐이다. `tsconfig.app.json:30` `include: ["src"]`(exclude 없음), `Dockerfile:45` 가 tsc -b 를 돈다. `ci.yml:193` 이 `place/ingest/*` 를 테스트 대상에서 뺀다 | 1.3 에 「픽스처는 `readFileSync` 로 런타임에 읽는다 — import 금지」를 적는다. SR-6.4 에 「파이썬 쪽 일치는 로컬 pytest 로만 확인된다」를 적는다 |
| I3 | REVISE | keep REVISE | `installFlushOnLeave` 를 부르는 곳은 PlacePage:535·RegionPage:156·AttractionPage:236·UnifiedSearchPage:43 넷뿐이다. GuidePage·GuideIndexPage 에는 없다. `tracker.ts:14` 는 5초다. U-6 과 같은 발견이다 | SR-1.6 을 「`recordPlaceEntry` 가 `installFlushOnLeave` 를 직접 설치하거나 track 직후 flush 한다」로 바꾼다. 2.1 beacon 케이스는 `/guides` 착지로 둔다 |
| I4 | REVISE | keep REVISE | 반증이 없다. pods/log 는 현재 파일만 주므로 회전 손실은 파드 시작 시각으로 드러나지 않는다 | SR-7.5 `partial` 을 「첫 줄 시각 > 시간 시작 OR 컨테이너 시작 > 시간 시작」으로 바꾸고 `first_line_at` 열을 더한다. 스트리밍 파싱과 `timeout` 을 명시한다 |
| I5 | MINOR | keep MINOR | `ClickHouseSchemaInitializer.kt` `statementsOf` 는 `startsWith("--")` 줄만 거르고 `;` 로 자른다 | SR-7.6 에 「꼬리 주석에 `;` 금지」를 적는다. 8.6 앞에 「analytics 로그 `[clickhouse] 적용 V0xx` 확인」을 넣는다 |
| I6 | MINOR | keep MINOR | `V005__events_two_axis.sql:11` `DROP TABLE IF EXISTS analytics.events`, `:50` 에 TTL 90 DAY 가 있다. T-4 와 겹친다 | SR-5.3 인용을 `V005__events_two_axis.sql:50` 으로 고친다 |
| I7 | MINOR | keep MINOR | 반증이 없다. spec.md:77 `hour DateTime` 에 시간대를 지정하지 않았다. U-5 와 같은 발견이다 | SR-7.4 열을 `DateTime('UTC')` 로 하고 JSONEachRow 에는 epoch 초를 쓴다 |
| I8 | MINOR | keep MINOR | `nginx.conf:79` 등에 `resolver ${NGINX_LOCAL_RESOLVERS}` 가 있고, `Dockerfile:78-79` 에서 환경 변수로 주입한다. `Dockerfile:71` 은 `nginx:1.27-alpine` 이다 | 7.1 명령에 `-e NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 -e NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS` 와 `nginx:1.27-alpine` 을 쓴다 |
| I9 | MINOR | keep MINOR | `oci-arm/README.md` 「CronJob 28종」 표가 있다. visitors 잡의 resources 는 256Mi/512Mi 다 | SR-8.1 에 requests 64Mi·limits 128Mi, history 1/2, `ttlSecondsAfterFinished` 를 적는다. 8.2 문서 목록에 README 표를 더한다 |
| A1 | REVISE | keep REVISE | `ADR-0095:98` 소유 「원장·ClickHouse 스키마·집계 산출물」, `09-allow…clickhouse.yaml:10-11` 「전용 집계 표만 읽는다」. D-5 와 같은 발견이다 | 8.2 에 ADR-0095 §5 한 줄(「스키마 소유 analytics, 쓰는 쪽 crawl-stats 잡」)과 09 정책 주석 수정을 넣는다 |
| A2 | REVISE | keep REVISE | CLAUDE.md 「구조 변경 시 ADR 필수」. `main.py:29-30` 이 권한을 늘리지 않는 원칙을 밝힌다 | ADR-0070 에 개정 절(얹는 이유 · 이 잡만 SA·API egress · 관측이 넓어지면 이미지 분리 재검토)을 둔다. `main.py` 잡 목록 주석에 한 줄을 더한다 |
| A3 | MINOR | keep MINOR | ADR-0095 §3 「같은 화면 한 벌을 식별하는 키」 | 8.2 의 ADR-0095 §3 행에 「place-entry 의 view_id 는 단독 키 — 착지는 payload 가 말한다」를 적는다 |
| A4 | MINOR | keep MINOR | `App.tsx:109-114` `PlaceHostRedirect` 가 `location.replace` 로 넘긴다. U-3 후반과 같은 발견이다 | SR-9 `internal` 정의에 「apex→place 리다이렉트 포함」을 적는다. 8.5 에 구글 앱 행이 0 일 수 있는 원인을 메모한다 |
| T-1 | REVISE | keep REVISE | `PlacePage.tracking.test.tsx:172` 는 `toMatchObject`, `PlacePage.test.tsx:501` 은 `toEqual` 이다. 2.5 명령에 PlacePage.test.tsx 가 없다 | 2.5 에 `src/pages/place/__tests__/PlacePage.test.tsx` 를 더한다. 8.1 허브 주입 행에 빨개질 파일:줄을 적는다 |
| T-2 | REVISE | keep REVISE | `App.tsx:80` `isPlaceHost` 는 모듈 상수다. 2.4 대안은 App.tsx 의 호출 줄을 재지 않는다 | 2.4 를 「App 을 place/비 place 호스트로 렌더해 대기열 1/0 건 단언」으로 바꾼다. 불가하면 grep 게이트를 둔다. 8.1 에 「App.tsx 호출 제거」 주입을 더한다 |
| T-3 | REVISE | keep REVISE | `datagokr_test.py:14,123` 에 `REPO`·`(REPO / "k8s").rglob("*.yaml")` 로 k8s 를 단언하는 선례가 있다. 스크래치 스크립트는 게이트로 남지 않는다 | 7.1 RBAC 단언을 `place/ingest/tests/crawl_stats_k8s_test.py` 로 커밋한다(verbs·resources 정확 일치, automount 는 이 잡만, S1 라벨 egress 미포함) |
| T-4 | REVISE | keep REVISE | `privacyRetention.test.ts:162-178` 가 V005 TTL 을 정규식으로 읽어 방침 행과 비교한다 | 4.1 을 `privacyRetention.test.ts` 의 `describe('place 첫 방문 유입')` 로 옮기고 V005 TTL 일수를 단언한다 |
| T-5 | REVISE | keep REVISE | tasks.md:86 「오류 없이 행을 낸다」만 본다. 분류의 의미를 재는 검사가 없다 | 8.7 에 리터럴 호스트 표 → `multiIf` 기대 라벨 대조를 넣고 `verifications/` 에 남긴다. `$` 제거 주입을 더한다 |
| T-6 | REVISE | keep REVISE | 반증이 없다. 헤더만 넣으면 `document.referrer` 가 빈 값일 수 있다. 그러면 검사가 스스로 근거를 만든다 | 8.5 를 `Page.navigate({referrer, referrerPolicy:'unsafe-url'})` 로 바꾸고 `document.referrer` 값을 기록한다. `q=` 를 담았을 때만 증거로 인정한다 |
| T-7 | MINOR | keep MINOR | `ci.yml:193` 이 place/ingest 를 테스트 대상에서 뺀다. 픽스처 모양이 정해져 있지 않다 | 1.3 픽스처를 `[{path, landing, crawl}]` 로 정한다. 5.4 와 그룹 8 커밋 전 체크에 pytest 를 넣는다 |
| T-8 | MINOR | keep MINOR | `ClickHouseSchemaInitializerTest.kt:54,128` `shouldBe 7`, V007 은 내용을 단언하는 선례(:85-93)다 | 6.1 에 새 V 파일의 엔진·ORDER BY·TTL 단언을, 5.1 에 coverage INSERT 단언을, 8.1 에 버전 열 주입을 더한다 |
| T-9 | MINOR | keep MINOR | `datagokr_test.py:33-42` `Recorder` 는 `__call__(url)` 로 주입하는 fetch 다. HTTP 서버가 아니다 | 5.1 「가짜 HTTP 서버」를 「fetch 함수를 주입하는 Recorder 선례」로 고친다 |
| D-1 | REVISE | keep REVISE | `PlaceLandingRoute.tsx` 가 `<PlacePage preset…>` 를 렌더한다. `PlacePage.tsx:536-540` 은 마운트 시 발화한다 | SR-1.2 를 「같은 세션에서 place-hub ⊆ place-entry. place-hub 는 허브·속성 랜딩을 한 번이라도 연 세션」으로 고친다. SR-9 에 불일치 세션 수 지표를 더한다 |
| D-2 | REVISE | keep REVISE | `PlacePage.tsx:305` 트리거 유니온에 `'landing'` 이 있다. 이것은 원장 어휘 충돌이지 문장 다듬기가 아니다 | payload 키를 `landingType` 으로, 값 `landing` 을 `attr_landing` 으로 바꾼다(SR-4·6.4·픽스처·SR-9 함께) |
| D-3 | REVISE | keep REVISE | spec.md:33 「호스트가 현재 `location.hostname` 과 같음」을 빈 값으로 둔다. 반증이 없다 | SR-2.2 의 같은 호스트를 `'self'` 로 바꾼다. SR-9 유입원에 `self` 를 따로 둔다 |
| D-4 | REVISE | keep REVISE | `EventCollectDtos.kt:67-68` eventId 는 viewId 기반이다. 폴백 경로에서는 새로고침마다 다른 id 가 생긴다 | SR-9 질의를 세션당 `argMin(…, timestamp)` 로 먼저 접은 뒤 집계한다 |
| D-5 | REVISE(사람) | keep REVISE | `V006…sql:1` 「`links` 잡이 **이 표만** 읽는다」, CLAUDE.md 「서비스 간 DB 공유 금지」. A1 과 같은 발견이다 | 권고 (a): 「표 주인 analytics, place-ingest 이미지는 실행 장소」를 ADR-0095 §5 에 한 줄 적는다. 잡 README 에 「place 도메인 아님」을 적는다 |
| D-6 | MINOR | keep MINOR | `nginx.conf:406-409` `/assets/` 가 immutable 이다. ADR-0105 §4 「위 경로만 캐시」가 CF 기본 정적 캐시까지 끈다는 반증은 확인하지 못했다. 애매하므로 유지한다 | SR-6 에 「수치는 원본 도달 요청, asset 칸은 추이용」을 적는다 |
| D-7 | MINOR | keep MINOR | spec.md:69 「대개 other」 — 다른 호스트의 `/` 는 `hub` 가 된다 | SR-9 에 「path_type 은 host='place.1989v.com' 에서만 읽는다」를 적는다 |
| D-8 | MINOR | keep MINOR | `docs/product/` 에 glossary 파일이 없다(ls 확인) | 구현 뒤 용어집에 등록한다(사용자 판단 9) |
| U-1 | REVISE | keep REVISE | spec.md:94 `(^|\\.)naver\\.com$` 는 `blog.naver.com`·`cafe.naver.com` 도 맞춘다 | SR-9 유입원을 `search_*` 와 `community_*` 로 나눈다. 「검색 유입 세션」은 `search_*` 만 센다 |
| U-2 | REVISE | keep REVISE | 플랜 :10 「검색엔진에서 사람이 들어온 요청 0건 / 24시간」 — 검증 1행이 지표 전부가 된다 | SR-9 공통 조건에 `utmMedium != 'spec'` 을 넣는다. SR-8.4 에 검증 표지를 의무로 적는다 |
| U-3 | REVISE | keep REVISE | `AttractionShortLinkControllerTest.kt` `query = "utm_source=x"` → Location 이 `…/attractions/4321`(쿼리 없음) | SR-3 에 「캠페인은 정규 주소에 UTM, 단축 주소는 UTM 을 넘기지 않는다」를 적는다. SR-9 internal 주석은 A4 와 같다 |
| U-4 | REVISE | keep REVISE | `portal-fe/deployment.yaml:10` `replicas: 1`, `cronjob-visitors.yaml` `backoffLimit: 0`. 키에 pod 가 없어 `ReplacingMergeTree(requests)` 가 최댓값만 남긴다 | SR-7.4 키에 `pod` 를 더하고 `--hour=` 수동 인자, 컨테이너 `startedAt` 기준 partial, coverage 도 최대 덮음 기준을 넣는다. 주기는 사용자 판단 5 |
| U-5 | REVISE | keep REVISE | I7 과 같다. 반증이 없다 | I7 편집 + 5.1 에 「19:18 +0000 → KST 다음 날 04시」 경계 케이스를 넣는다 |
| U-6 | MINOR | keep MINOR | I3 과 같다 | I3 편집. nginx 사람 UA 대조 지표는 선택으로 둔다 |
| U-7 | MINOR | keep MINOR | spec.md:67 분류에 GoogleOther·ChatGPT-User 가 없다 | SR-9 읽는 법에 「googlebot 칸은 UA 에 Googlebot 이 있는 것만」을 적는다 |
| U-8 | MINOR | keep MINOR | tasks.md:85 grep 명령이 정해져 있지 않다 | 8.6 에 고정 grep(대소문자·OAI/GPTBot 제외·시간 창)을 적는다 |
| U-9 | MINOR | keep MINOR | spec.md:94(표)와 :105(SQL)의 구글 앱 처리 글자가 다르다 | SR-9 에 「주간 합계로 읽는다, 커버리지 24 미만은 하한」을 적고 표와 SQL 을 한 문안으로 맞춘다 |

## 중복 묶음
- 같은 것을 두 번 고치지 않는다: I3≈U-6, I7≈U-5, A1≈D-5, I6⊂T-4, A4⊂U-3.
- 판정은 각각 유지했다. 편집은 한 번만 하면 된다.

## Overall
- **BLOCK 1 (S1) · REVISE 25 · MINOR 19 — keep 45 / demote 0 / dismiss 0.**
- 기각·강등할 실측 반증을 찾지 못했다. 인용한 file:line 은 모두 원문과 맞았다.
- 판정은 **BLOCK** 이다. S1 편집(전용 라벨 + egress 축소 + 위험 수용 문장 + 7.1·8.1 단언)을 반영하기 전에는 구현에 들어가지 않는다.
- REVISE 는 스펙·tasks 편집으로 해소된다.

## 사용자 판단 목록 (권고 기본값으로 진행)
1. **S1 네임스페이스 전체 로그 읽기 수용** — 권고: 수용한다. 조건은 셋이다. 전용 라벨 `place-crawl-stats` 로 외부 443 egress 를 받지 않는다. egress 는 DNS·CH 8123·API 서버 하나만 연다. Role 은 `pods list` + `pods/log get` 뿐이다. RBAC 으로는 portal-fe 만 읽게 좁힐 수 없다는 사실을 스펙에 적는다.
2. **D-5 / A1 표 소유** — 권고: 표 주인은 analytics(V 파일·스키마 초기화), place-ingest 이미지는 실행 장소일 뿐이다. ADR-0095 §5 에 한 줄을 적고 09 정책 주석을 고친다.
3. **A2 ADR 위치** — 권고: 새 ADR 없이 ADR-0070 에 개정 절을 둔다.
4. **I2 / T-7 파이썬 CI 게이트** — 권고: 이번에는 CI 설정을 바꾸지 않는다(최소 수정). 로컬 pytest 와 그룹 8 커밋 전 체크로 둔다. frontend-gate 에 pytest 한 줄을 넣을지는 별도로 결정한다.
5. **U-4 크롤 주기** — 권고: `5 * * * *` 를 유지하고 키에 `pod` 를 추가하며 `--hour` 재실행 인자를 둔다. `*/15` 는 하루 Job 96개와 kine 부피(I9)를 감안해 보류하고, coverage 의 partial 이 하루 2시간 이상이면 다시 본다(Q4).
6. **D-3 같은 호스트 리퍼러** — 권고: `'self'` 로 남긴다. place 세션 집계에는 포함하고 유입원에서만 따로 센다.
7. **D-2 어휘 변경** — 권고: `landingType` / `attr_landing` 을 채택한다.
8. **U-1 검색·커뮤니티 분리** — 권고: 채택한다. `search_*`·`community_*` 를 리터럴 표(T-5)로 검증한다.
9. **D-8 용어집 신설** — 권고: 이번 슬라이스 밖으로 미룬다. 구현 뒤 등록 여부를 묻는다.
10. **T-3 k8s 단언 테스트 커밋** — 권고: 커밋한다(선례 `datagokr_test.py` 가 있다).

S1 해소: 반영 위치 — spec.md SR-8.1(전용 라벨 `place-crawl-stats` · 파드 템플릿 `part-of` 제외 · 위험 수용 문장) · SR-8.2(Role `pods: [list]`, `pods/log: [get]`) · SR-8.3(egress 는 DNS·ClickHouse 8123·API 서버 하나, `09` 목록 추가 + 새 정책 `21-allow-crawl-stats-egress.yaml`), tasks.md 7.1(`crawl_stats_k8s_test.py` 단언 (a)~(g)) · 8.1(라벨 `place-ingest` 되돌림 주입), open-questions.yml J1.
