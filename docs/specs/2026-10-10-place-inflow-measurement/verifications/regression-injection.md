# 회귀 주입 — 그룹 1·3·5·6

2026-10-11. 워크트리를 `rsync`(node_modules·build·.git 제외)로 복사한 임시 사본에서 한 건씩 넣고, 빨간불을 본 뒤 원본으로 되돌렸다.
모두 컴파일·실행되는 회귀다(구문 오류로 낸 빨간불 없음). 그룹 2·4·7 의 주입(세션 플래그·beacon·`App.tsx` 호출·허브 payload·k8s 라벨·Role·SR-9 `multiIf`)은 그 그룹 몫이다.

| # | 주입 | 파일 | 명령 | 빨간 줄 |
|---|---|---|---|---|
| 1 | `referrerHostOf` 가 `href` 를 돌려줌 | `portal-fe/src/analytics/inflow.ts` | `npx vitest run src/analytics/__tests__/inflow.test.ts` | `Tests 10 failed \| 34 passed (44)` — `경로·쿼리·프래그먼트 제거` 등 |
| 2 | 같은 호스트 `'self'` 분기 제거 | 같음 | 같음 | `× 같은 호스트는 self` · `× 같은 호스트 대문자도 self` — `2 failed` |
| 3 | UTM 정규식 상한 제거(`{1,64}` → `{1,}`) | 같음 | 같음 | `× 64자는 그대로, 65자는 invalid` — `1 failed` |
| 4 | `landingTypeOf` 의 `attr_landing` 행을 `region` 으로 | 같음 | 같음 | `× /en/regions/11/pet → attr_landing` · `× 공용 픽스처의 landing 값과 일치한다` — `3 failed` |
| 5 | 파서 호스트 허용 목록 제거 | `place/ingest/src/crawl_stats.py` | `python3 -m pytest tests/crawl_stats_test.py -q` | `FAILED test_host_allowlist[1989v.com.evil.io-other]` 등 `4 failed, 44 passed` |
| 6 | UA 우선순위 뒤집기(`gptbot` 을 `oai-searchbot` 앞으로) | 같음 | 같음 | `FAILED test_bot_classification_first_match[...OAI-SearchBot/1.0; GPTBot/1.2)-oai-searchbot]` — `1 failed` |
| 7 | 파싱 예외 메시지·로그에 줄 원문 넣기 | 같음 | 같음 | `FAILED test_raw_fields_never_leave_parser_or_logs` — `E assert ('10.42.0.73' not in '10.42.0.73 ...` |
| 8 | ClickHouse 500 을 삼키기(종료 코드 0) | 같음 | 같음 | `FAILED test_clickhouse_failure_exits_non_zero` — `E assert 0 != 0` |
| 9 | 시간 창 끝 포함(`< end` → `<= end`) | 같음 | 같음 | `FAILED test_two_pods_same_cell_stay_two_rows_and_out_of_window_lines_are_dropped` |
| 10 | `partial` 판정에서 컨테이너 시작 조건 제거 | 같음 | 같음 | `FAILED test_partial_coverage[10/Oct/2026:18:30:00 +0000-started1-1]` |
| 11 | V008 요청 표 버전 열 `requests` → `hour` | `analytics/.../V008__crawler_requests.sql` | `./gradlew :analytics:app:test --tests '*ClickHouseSchemaInitializer*'` | `Then: 요청 표는 파드별 행을 남기고 같은 칸은 큰 건수로 덮는다` 실패, exit 1 |
| 12 | V008 `ORDER BY` 에서 `pod` 제거 | 같음 | 같음 | 같은 케이스 실패, exit 1 |
| 13 | V008 문장 뒤 꼬리 주석에 `;` | 같음 | 같음 | `Then: 표 둘, 문장도 둘이다 — 꼬리 주석의 세미콜론이 문장을 더 만들면 안 된다` 실패, exit 1 |
| 14 | 수집 서버가 payload 를 버림(`payload = emptyMap()`) | `analytics/.../EventCollectDtos.kt` | `./gradlew :analytics:app:test --tests '*EventCollectControllerTest'` | `Then: 서버 코드 변경 없이 같은 키·값이 원장으로 넘어가고, 직렬화하면 평평한 문자열 맵이다` 실패, exit 1 |

메모
- 11 은 tasks 8.1 의 「`requests` → `collected_at`」 대신 `hour` 로 넣었다 — 요청 표에는 `collected_at` 열이 없다(커버리지 표에만 있다). 검사가 보는 것은 버전 열이 `requests` 인지라 뜻은 같다.
- 8 은 처음엔 가짜 ClickHouse 가 응답 하나만 준비해 두어 두 번째 쓰기에서 `IndexError` 로 빨개졌다 — 주입이 아니라 가짜의 한계가 낸 빨간불이다. 커버리지 쓰기 응답(200)을 더해 `assert 0 != 0` 으로 빨개지는 것을 다시 확인했다.

# 회귀 주입 — 그룹 4·7

2026-10-11. 임시 사본(`scratchpad/regr-tg47` — `settings.gradle.kts`·`k8s/`·`place/ingest/`·V 파일·`portal-fe`(node_modules 는 원본 심링크))에서 한 건씩 넣고 빨간불을 본 뒤 되돌렸다. 모두 파싱·실행되는 회귀다.
k8s 명령: `python3 -m pytest tests/crawl_stats_k8s_test.py -q` (기준 `10 passed`). 방침 명령: `npx vitest run src/pages/__tests__/privacyRetention.test.ts -t 'place 첫 방문'` (기준 `2 passed`).

| # | 주입 | 파일 | 빨간 줄 |
|---|---|---|---|
| 15 | 파드 템플릿 라벨을 `place-ingest` 로 되돌림 (S1) | `k8s/base/place-ingest/cronjob-crawl-stats.yaml` | `FAILED test_pod_label_is_dedicated_and_has_no_part_of` · `FAILED test_no_public_egress_policy_selects_the_pod` — `2 failed, 8 passed` |
| 16 | 파드 템플릿에 `part-of: commerce-platform` | 같음 | `FAILED test_pod_label_is_dedicated_and_has_no_part_of` — `1 failed` |
| 17 | Role `pods` 에 `get` 추가 | `k8s/base/place-ingest/rbac-crawl-stats.yaml` | `FAILED test_role_is_exactly_pods_list_and_pods_log_get` — `1 failed` |
| 18 | Role 에 `secrets` `get` 규칙 추가 | 같음 | 같은 케이스 — `1 failed` |
| 19 | 11 외부 egress 목록에 `place-crawl-stats` | `k8s/base/network-policy/11-allow-egress-https-public.yaml` | `FAILED test_no_public_egress_policy_selects_the_pod` — `1 failed` |
| 20 | 21 에 API 목적지(`10.43.0.1/32:443`) 하나 더 | `k8s/base/network-policy/21-allow-crawl-stats-egress.yaml` | `FAILED test_egress_is_clickhouse_8123_plus_one_apiserver_address` — `1 failed` |
| 21 | env 에 `secretKeyRef`(`place-ingest-secrets`) | `cronjob-crawl-stats.yaml` | `FAILED test_env_has_no_secret_and_security_context_is_locked_down` — `1 failed` |
| 22 | `readOnlyRootFilesystem: false` | 같음 | 같은 케이스 — `1 failed` |
| 23 | 다른 잡(`cronjob-links.yaml`)이 `serviceAccountName: place-crawl-stats` | `k8s/base/place-ingest/cronjob-links.yaml` | `FAILED test_only_this_cronjob_uses_the_service_account` — `1 failed` |
| 24 | 방침 로봇 문장의 「검색엔진·AI 수집 로봇」 → 「검색엔진 로봇」 | `portal-fe/src/pages/PrivacyPage.tsx` | `× 접속 로그 문단에 로봇 요청은 시간당 건수로만 남긴다는 문장이 있다` — `1 failed` |
| 25 | 유입 행 보관 「90일」 → 「30일」 | 같음 | `× 2항에 place 유입 행이 있고, 원장 TTL 과 같은 일수…` — `1 failed` |
| 26 | 유입 행 「직전 사이트의 도메인(주소 전체 아님)」 → 「직전 사이트 주소」 | 같음 | 같은 케이스 — `1 failed` |
| 27 | nginx `log_format` 끝 `"$host"` 제거 | `portal-fe/nginx.conf` | 게이트 없음 — 수동 확인: 그 설정으로 띄운 nginx 컨테이너에 Googlebot UA·`Host: place.1989v.com` 요청을 보내 나온 줄을 `crawl_stats.parse_line` 에 넣으면 `host='unknown'` (원본 설정이면 `host='place.1989v.com'`) |

메모
- 15 는 처음엔 (c) 하나만 빨개졌다 — (d) 가 상수 `place-crawl-stats` 가 선택 목록에 있는지를 보고 있어서, 라벨이 `place-ingest` 로 돌아가 11 이 실제로 그 파드를 고르는 경우를 못 잡았다. (d) 가 CronJob 이 실제로 붙인 파드 라벨을 읽도록 고친 뒤 두 케이스가 함께 빨개지는 것을 확인했다.
- 27 은 pytest 게이트로 만들지 않았다 — 파서 쪽 형식 검사(`crawl_stats_test.py`)는 테스트가 직접 쓴 줄을 읽고, nginx 설정을 읽어 줄을 합성하면 검사가 근거를 스스로 만든다. 실제 nginx 1.27-alpine 이 낸 줄로 대조한 결과만 남긴다.

# 회귀 주입 — 그룹 2

2026-10-11. 임시 사본(`scratchpad/regr-tg2` — `portal-fe` 전체, node_modules 는 원본 심링크)에서 한 건씩 넣고 빨간불을 본 뒤 되돌렸다. 모두 `npx tsc -b` 가 exit 0 인(컴파일되는) 회귀다.
명령: `npx vitest run src/analytics/__tests__/placeEntry.test.ts src/__tests__/placeEntryBoot.test.tsx` (기준 `6 passed`).

| # | 주입 | 파일 | 빨간 줄 |
|---|---|---|---|
| 28 | 세션 플래그 확인 제거(`if (!claimEntry()) return;` → `claimEntry();`, 두 건 발화) | `portal-fe/src/analytics/inflow.ts` | `× 두 번 불러도 탭 세션에 한 행 …` · `× 세션 저장소에 쓸 수 없으면 모듈 변수로 한 번만` — `2 failed` |
| 29 | payload 에 `section: undefined` 키 하나 | 같음 | `× 두 번 불러도 탭 세션에 한 행 …` · `× UTM 이 없는 진입은 UTM 키가 없다 …` — `2 failed` (`toEqual` 은 `undefined` 키를 무시하므로 `Object.values` 단언이 잡는다) |
| 30 | `recordPlaceEntry` 의 `installFlushOnLeave()` 설치 제거 | 같음 | `× 떠날 때 흘리는 것을 스스로 설치한다 — … 편집 글 착지에서도 beacon 에 실린다` — `1 failed` |
| 31 | `App.tsx` 의 `recordPlaceEntry()` 호출 제거 | `portal-fe/src/App.tsx` | `× 앱 부팅 — place 유입 기록 > place 호스트에서는 한 행을 남긴다` — `1 failed` |
| 32 | 호출을 `isPlaceHost` 분기 밖으로(무조건 호출) | 같음 | `× 앱 부팅 — place 유입 기록 > place 가 아닌 호스트에서는 남기지 않는다` — `1 failed` |

메모
- 2.4 는 grep 게이트 대안 없이 렌더로 됐다 — `vi.resetModules()` 뒤 `jsdom.reconfigure({ url })` 로 호스트를 바꾸고 `App`·트래커를 같은 모듈 그래프에서 동적 import 한다. 테스트 파일은 `portal-fe/src/__tests__/placeEntryBoot.test.tsx`.
- 허브 SESSION_START 에 payload 를 더하는 주입(tasks 8.1)은 이번 그룹이 허브 발화 코드를 바꾸지 않아 넣지 않았다 — 그룹 8 몫.
