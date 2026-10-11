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
