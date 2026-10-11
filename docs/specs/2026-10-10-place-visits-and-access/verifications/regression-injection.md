# 회귀 주입 — 방문 근거 하한·이름 (TG1)

워킹트리가 아니라 임시 사본(스크래치패드 `regress-tg1/`, `node_modules`·`build`·`.git` 을 뺀 rsync 사본 + `node_modules` 심링크)에서 했다.
주입은 하나씩 넣고 검사를 돌린 뒤 원본으로 되돌렸다(`cmp` 로 원본과 같은지 확인). 모든 주입은 **컴파일·타입체크를 통과하는 회귀**다 —
구문 오류로 난 빨간불은 증거가 아니라서다.

판정 근거: 하한 검사는 리터럴 경계(찜 2·3, 클릭 4·5)와 **Kotlin 파일에서 뽑은 값**이고, 이름 검사는 서버 렌더 소스의 문자열 리터럴이다.
테스트 안에 하한을 상수 이름으로 적은 곳은 없다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R1 | `visitSignals.ts` `SAVED_MIN = 3` → `2` | `npx tsc -b` exit 0 | `visitSignals.test.ts` 「하한 — 리터럴 경계 > 하한 값」 · 「찜 2 → 줄 없음, 3 → 줄 있음」, `visitSignalsGate.test.ts` 「찜 하한: visitSignals SAVED_MIN == AttractionSaveSignal.SAVED_MIN」 (3 failed / 23) |
| R2 | `visitSignals.ts` `FREQUENTLY_CLICKED_MIN = 5` → `4` | `npx tsc -b` exit 0 | 「하한 값」 · 「placeAttributes 는 같은 값을 다시 내보낸다(사본 아님)」 · 「클릭 4 → 줄 없음, 5 → 줄 있음」 · 「클릭 하한: visitSignals FREQUENTLY_CLICKED_MIN == AttractionClickSignal.MIN_SAMPLE」 (4 failed / 23) |
| R3 | search/domain `AttractionSaveSignal.SAVED_MIN = 3` → `2` | `:search:domain:test` 가 컴파일 후 실행 | `AttractionSaveSignalTest` 「하한은 3명이다」 · 「2명 이하·값 없음은 근거가 아니다」 (3 중 2 failed), `visitSignalsGate.test.ts` 「찜 하한 …」 (1 failed / 10) |
| R4 | `RegionPage.tsx` 에 `[...xs].sort((a, b) => (b.congestion ?? 0) - (a.congestion ?? 0))` 함수 한 개 | `npx tsc -b --force` exit 0 | `visitSignalsGate.test.ts` 「portal-fe/src/pages/place/RegionPage.tsx 에 congestion 정렬·순위가 없다」 (1 failed / 10) |
| R5 | `AttractionPageRenderer.kt` 에 `private const val REGRESSION_POPULAR = "인기 관광지"` | `:search:app:compileKotlin` BUILD SUCCESSFUL | 「서버 렌더 문구 > 「인기」「많이 본」「핫플」이 없다」 |
| R6 | 같은 파일에 `private const val REGRESSION_SITE = "이 사이트 방문자 클릭"` (R5 와 한 번에 컴파일) | 〃 | 「서버 렌더 문구 > 이 사이트 근거 문구에 「방문자 · visitor」가 없다」 (R5·R6 2 failed / 10, 각자 다른 테스트) |

명령(사본 루트에서):

```bash
(cd portal-fe && npx tsc -b && npx vitest run src/pages/place/__tests__/visitSignals.test.ts src/pages/place/__tests__/visitSignalsGate.test.ts)
./gradlew :search:domain:test --tests '*AttractionSaveSignal*'
./gradlew :search:app:compileKotlin
```

못 잡는 것(알고 둔다): `placeAttributes.ts` 가 다시 내보내기 대신 **같은 값 5** 의 사본 상수를 두면 초록이다 — 값이 어긋나는 순간(R2)부터 잡힌다.
서버 렌더 금지어 검사는 문자열 리터럴만 보므로, 문구를 다른 파일에서 가져와 조립하면 그 파일은 보지 않는다(지금 렌더러 문구는 전부 이 파일 리터럴이다).

남은 회귀 주입(TG6.7): batch 가 넘기는 `min` 2 · 「직선거리」 문구 빼기 · 헤더 검사 한 줄 삭제 — 해당 코드가 생기는 TG3·TG5·TG6 에서.

# 회귀 주입 — 시도 순위 · 찜 집계 → 색인 (TG2 · TG3)

TG1 과 같은 방식이다. 임시 사본(스크래치패드 `regress-tg23/`, `node_modules`·`build`·`.git`·`.gradle` 을 뺀 rsync 사본 + `node_modules` 심링크)에
하나씩 넣고, 검사를 돌린 뒤 원본으로 되돌렸다(`cmp` 확인). 주입은 전부 컴파일·타입체크를 통과하는 회귀다. 주입 스크립트는
스크래치패드 `inject-tg23.py`(문자열 한 곳 치환 → 명령 → 원복)이고, 판정은 JUnit XML 의 실패 테스트 이름이다.

판정 근거: 순위는 리터럴 입력(현지인을 거꾸로 크게 준 12구, 하루 빠진 한 구, 2·3개 시군구)에서 나온 응답 JSON,
찜 하한은 실제 MySQL 질의(2·3명)와 저장소에 넘어간 값, 정렬 하한은 어댑터가 낸 요청 JSON 의 `range` 에 리터럴(찜 2·3, 클릭 4·5)을 넣은 결과다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R7 | `RegionVisitorRanking` 값에 현지인을 더함 | 〃 | `RegionVisitorRankingServiceTest` 「8월의 외지인+외국인으로 상위 10 …」 (1 failed / 12) |
| R8 | 다 받은 달 판정 `codes.all` → `codes.any`(시군구마다 따로) | 〃 | 「시도 전체로 판정해 그 앞의 다 받은 달(7월)로 간다」 (1 / 12) |
| R9 | `MIN_SIGUNGU = 3` → `2` | 〃 | 「제주(50, 2개)도 빈 결과다」 (1 / 12) |
| R10 | wishlist `maxOf(query.min, 1)` → `maxOf(query.min, 0)` | 〃 | `WishlistInternalControllerTest` 「0·음수는 1 로 막는다」 (1 / 5) |
| R11 | 집계 JPQL `HAVING COUNT(w) >= :min` → `>` | 〃 | `WishlistSchemaIntegrationSpec`(Testcontainers MySQL) 「찜 집계는 하한 이상 대상만 …」 (1 / 10) |
| R12 | 재색인이 넘기는 `min` 을 `SAVED_MIN - 1` 로 | 〃 | `AttractionApiReindexTaskletTest` 「하한 3명을 넘겨 부르고 …」 (1 / 41) |
| R13 | 어댑터 범위 `gte(sort.min)` → `gte(sort.min - 1)` | 〃 | `AttractionSearchAdapterSignalSortTest` 「찜 2명은 빠지고 3명은 들어온다」·「클릭 4명은 빠지고 5명은 들어온다」 (2 / 6) |
| R14 | `resolveEmbedding` 조건에서 근거 정렬을 뺌 | 〃 | `SearchAttractionServiceTest` 「키워드가 있고 하이브리드가 켜져 있어도 벡터를 만들지 않는다」 (1 / 54) |
| R15 | 읽기 문서 `toDomain()` 에서 `savedCount = savedCount` 한 줄 삭제 | 〃 | `AttractionReindexCaptureTest` 「찜 수·근거 기준일이 쓰기 문서 값 그대로 …」 (1 / 17) |
| R16 | 읽기 문서에서 `savedCount` 필드와 매핑 줄 삭제 | 〃 | `verifySearchIndexContract` — 「반드시 읽어야 할 필드를 안 읽는다: savedCount」 |
| R17 | NetworkPolicy `22-allow-search-batch-to-account.yaml` 의 대상 `account` → `content` | — | `verifyPodTopology` — 「'wishlist' 은 account 파드에 있는데 정책이 그것을 가리키지 않는다(content, search-batch)」 |
| R18 | 화면 수치 `Math.floor` → `Math.round` | `npx tsc -b --force` exit 0 | `RegionPage.test.tsx` 「시도 — … 「약 N명」(소수 버림) …」, `visitSignals.test.ts` 「시도 순위 근거 줄 …」 (2 / 29) |
| R19 | 시군구 페이지에서도 순위를 부르고 그림(`isSido` 조건 제거) | 〃 | 「시군구 페이지는 순위를 부르지도 그리지도 않는다」 (1 / 15) |

R17 의 앞 시도: 같은 정책을 spec 대로 `04-allow-backend-to-backend.yaml` 에 넣고 같은 회귀를 넣었더니 **초록(exit 0)** 이었다.
`verifyPodTopology` 의 host-of 검사는 파일 단위다 — 파일의 첫 `kgd.io/host-of` 하나만 읽고, 파일 안 **모든** 정책의 이름과 대조한다.
04 에는 `allow-auth-to-account` 가 이미 `account` 를 갖고 있어 무엇을 가리켜도 통과하고, 새 정책이 atlas 정책보다 앞에 오면 기존 `codedictionary` 검사가 밀려난다.
그래서 정책을 `22-…yaml` 한 파일에 하나만 두었다(04 머리 목록에는 이 파일을 가리키는 줄).

OpenSearch 실제 동작(요청 JSON 만으로는 못 보는 것): `index:false` + doc_values 정수 필드에 `range`·정렬이 듣는지 로컬 컨테이너
(`opensearch-nori:3.8.0`, 운영과 같은 판)로 확인했다 — 문서 5개(찜 2·3·7·없음·3 / 클릭 0·5·4·9·5)에서 `savedCount ≥ 3` 정렬은 `[3, 2, 5]`,
`uniqueClickers14d ≥ 5` 는 `[4, 2, 5]`(값 내림차순, 같으면 idSort). 컨테이너는 같은 명령 안에서 내렸다.

명령(사본 루트에서):

```bash
./gradlew :place:feature:test --tests '*RegionVisitorRankingService*'
./gradlew :wishlist:feature:test --tests '*WishlistInternalController*'      # R10
./gradlew :wishlist:feature:test --tests '*WishlistSchemaIntegrationSpec*'   # R11
./gradlew :search:batch:test --tests '*AttractionApiReindexTasklet*'
./gradlew :search:app:test --tests '*AttractionSearchAdapterSignalSort*'      # R13 (R14·R15 는 각 테스트 클래스)
./gradlew verifySearchIndexContract                                           # R16
./gradlew verifyPodTopology                                                   # R17
(cd portal-fe && npx tsc -b --force && npx vitest run src/pages/place/__tests__/RegionPage.test.tsx src/pages/place/__tests__/visitSignals.test.ts)
```

못 잡는 것(알고 둔다): 시도 순위의 SQL(시도 접두 `LIKE`)은 `PlaceSchemaIntegrationSpec` 이 실제 MySQL 로 보지만 회귀 주입은 하지 않았다.
wishlist 내부 경로 기본값 `min=3` 은 search `SAVED_MIN` 의 사본이다 — 재색인이 늘 명시해 보내므로(R12 가 그 값을 본다) 기본값이 어긋나도 운영 경로는 영향이 없고, 테스트도 잡지 않는다.

# 회귀 주입 — 근거 절·근거 줄 화면 · 방문 추이 링크 (TG4 · 2.4)

같은 방식이다. 임시 사본(스크래치패드 `regress-tg4/`, `node_modules`·`build`·`.git`·`.gradle` 을 뺀 rsync 사본 + `node_modules` 심링크)에
하나씩 넣고 검사를 돌린 뒤 원본으로 되돌렸다(파일 내용 일치 확인, R26 은 사본 안에서 다시 쓰인 골든도 되돌림). 스크립트는 스크래치패드
`inject-visits-tg4.py`, 판정은 vitest JSON 리포트·JUnit XML 의 실패 테스트 이름이다. 모든 주입은 `npx tsc -b` exit 0 · Kotlin 컴파일 통과다.

판정 근거: 화면은 리터럴 경계(찜 2·3, 클릭 4·5, 응답 2·3건)와 리터럴 기대 문구(「… · 3명 이상만」「… · 2026-10-10 기준」), 서버는 렌더된 HTML 의
`visit-signals` 절, 패리티는 **화면 함수 출력으로 쓴 골든** ↔ 서버가 렌더한 HTML 이다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R20 | `visitSignals.ts` `SAVED_MIN = 3` → `2` | tsc exit 0 | `AttractionPage.test.tsx` 「찜 2 · 클릭 4 — 하한 미만은 줄을 내지 않는다」, `RegionPage.test.tsx` 「찜 3곳 — 절 「많이 찜한 곳」 …」·「영문 — 절 제목과 같은 세 칸 근거 줄」, `visitSignals.test.ts` 2건, `visitSignalsGate.test.ts` 1건 (6 / 133) |
| R21 | `SITE_SECTION_MIN_ITEMS = 3` → `2` | 〃 | 「응답이 2건이면 절을 그리지 않는다」 (1 / 133) |
| R22 | 시군구 찜 절 질의 `siteSignalQuery('saved')` → `'clicked'` | 〃 | 「시군구 — 두 절이 각자 sort=saved · sort=clicked …」 외 3건 (4 / 133) |
| R23 | 상세 방문 추이 링크 대상 `hubCode` → `hubCode.slice(0, 2)`(시도) | 〃 | 「「{시군구} 방문 추이 보기」 — 시군구 지역 페이지로 가는 링크 …」·「영문 링크 …」 (2 / 133) |
| R24 | search/domain `AttractionSaveSignal.SAVED_MIN = 3` → `2` | `:search:app:test` 컴파일 후 실행 | `AttractionPageRendererTest` 「찜 2 · 클릭 4 — 하한 미만은 줄도 절도 없다」, `VisitSignalsParityTest` 「근거 줄이 순서째 같다」 2건(`*-below-min` 국·영) |
| R25 | 렌더러 클릭 하한 `isFrequentlyClicked(it)` → `it >= 4` | 〃 | 같은 렌더러 테스트 1건 + 패리티 2건 |
| R26 | 화면 문구만 「찜했습니다」→「저장했습니다」, 사본에서 골든 재생성 뒤 서버 패리티 | tsc exit 0 · 컴파일 통과 | `VisitSignalsParityTest` 3건(국문 찜 줄이 있는 `at-min`·`saved-only-no-date`·`stay`) — 패리티가 화면 출력과 서버 HTML 을 실제로 맞댄다 |

명령(사본 루트에서):

```bash
(cd portal-fe && npx tsc -b && npx vitest run src/pages/place/__tests__/{AttractionPage.test.tsx,RegionPage.test.tsx,visitSignals.test.ts,visitSignalsGate.test.ts,visitSignalsGolden.test.ts})
./gradlew :search:app:test --tests '*AttractionPageRenderer*' --tests '*VisitSignalsParity*'
```

못 잡는 것(알고 둔다): 시군구 절은 서버가 하한 이상만 준다는 전제로 건수만 본다 — 서버 정렬 하한은 TG3 의 R13 이 지킨다.
패리티 골든은 CI 의 「Visit signals golden fixture is current」 단계가 최신인지 본다(골든을 갱신하지 않은 채 화면 문구만 바꾸면 거기서 막힌다).

# 회귀 주입 — 역·정류장 적재와 사전 계산 (TG5)

같은 방식이다. 임시 사본(스크래치패드 `regress-tg5/`, `node_modules`·`build`·`.git`·`.gradle` 을 뺀 rsync 사본)에 하나씩 넣고, 검사를 돌린 뒤
원본으로 되돌렸다(주입 스크립트 `inject-tg5.py` 가 되돌린 파일을 워킹트리 원본과 `filecmp` 로 대조). 주입은 전부 파이썬 import·Kotlin 컴파일을 통과하는 회귀다.

판정 근거: 수집기 테스트는 TG0 에서 받은 원천 실제 행(`tests/fixtures/transit-stops.json` — 철도 13행 · 버스 8행 · 버스 원천 도시별 행 수 160줄 · 운영 시군구 269행)과
리터럴 경계(반경 2,000/2,001m · 500/501m, 묶음 500/501m, 무효 1/20·2/20, 행 수 79·80·120·121 대 100, 위도 37° 에서 1.9km 동쪽 두 칸)로 만든 입력에서 나온 값을 본다.
place 쪽은 컨트롤러가 받은 JSON → 도메인 검사(400), Testcontainers MySQL 에 실제로 쌓고 지운 행이다. 상한 대조는 수집기 테스트가 Kotlin 파일에서 `const val` 을 뽑는다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R20 | 수집기 헤더 검사 `if missing or extra or len(...) != len(...)` → `if False` (헤더 검사 한 줄 삭제) | import 통과 | `test_renamed_column_is_rejected_before_any_put` · `test_added_column_is_rejected` (2 failed / 34) |
| R21 | 반경 포함 판정 `d <= radius` → `d < radius` | 〃 | `test_radius_boundary_rail_2000_and_bus_500_inclusive` (1 / 34) |
| R22 | `STATION_MERGE_M = 500` → `200`(스펙 초안 값) | 〃 | `test_transfer_station_rows_become_one_station_with_lines_joined` · `test_merge_distance_boundary_500m` (2 / 34) |
| R23 | `INVALID_RATIO_MAX = 0.05` → `0.10` | 〃 | `test_invalid_coordinate_ratio_above_5_percent_fails` (1 / 34) |
| R24 | `ROW_CHANGE_MAX = 0.20` → `0.25` | 〃 | `test_row_count_change_beyond_20_percent_of_previous_active_run_fails` (1 / 34) |
| R25 | 같은 이름 정류장 건너뛰기 `if kind == BUS and s.name in names` → `if False` | 〃 | `test_same_name_pair_keeps_only_the_nearer_and_caps_at_two` (1 / 34) |
| R26 | 경도 이웃 칸 수 `ceil(반경 / 칸 폭)` → `1`(3×3 고정) | 〃 | `test_station_1_9km_east_two_cells_away_at_latitude_37_is_found` (1 / 34) |
| R27 | 광역 도시 행을 펼 때 「따로 도시 행이 있는 시군구」 빼기를 없앰 | 〃 | `test_every_source_city_maps_to_our_sigungu_and_coverage_needs_100_stops` (1 / 34) |
| R28 | place 도메인 `AttractionAccess.BUS_MAX_DISTANCE_M = 500` → `501` | `:place:feature:test` 컴파일 후 실행 | `AttractionAccessInternalControllerTest` 「역 2001m · 정류장 501m · 순위 3 … 는 400」 (1 / 3), 수집기 `test_server_limits_match_ingest_constants` (1 / 34) |
| R29 | 활성화 행 수 대조 `if (rows != expectedRows)` → `if (rows < 0 && rows != expectedRows)` | 〃 | `TransitSourceServiceTest` 「묶음이 빠져 행 수가 모자라거나 0행이면 400 …」 (1 / 5), `PlaceSchemaIntegrationSpec` 「세 번째 묶음이 실패하면 활성 회차는 옛 회차 그대로 …」 (1 / 18) |
| R30 | 활성화 때 버스 옛 회차 행 삭제를 뺌(`deleteOtherRuns` → `0`) | 〃 | `PlaceSchemaIntegrationSpec` 「세 번째 묶음이 실패하면 …」 (1 / 18) |
| R31 | 회차 끝 정리 `computedAt < :computedAt` → `<=` | 〃 | `PlaceSchemaIntegrationSpec` 「보낸 관광지는 통째로 바뀌고, 회차 끝 정리가 …」 (1 / 18) |
| R32 | extras 의 `access` 를 줄이 있을 때만 싣게 함(미연계 시군구 무시) | 〃 | `AttractionExtrasServiceTest` 「… 줄이 없어도 버스 미연계 시군구면 항목이 생기며 …」 (1 / 10) |

명령(사본 루트에서):

```bash
(cd place/ingest && find . -name __pycache__ -prune -exec rm -rf {} + ; PYTHONDONTWRITEBYTECODE=1 python3 -B -m pytest tests/transit_stops_test.py -q -p no:cacheprovider)
./gradlew :place:feature:test --tests '*AttractionAccessInternalController*' --tests '*TransitSourceService*' --tests '*AttractionExtrasService*' --tests '*PlaceSchemaIntegrationSpec*'
```

함정(이번에 밟았다): 파이썬 주입을 바이트코드 캐시를 둔 채 연달아 돌리면 R23 과 R24 처럼 **길이가 같은 치환이 같은 초 안에** 일어날 때
`.pyc`(원본 mtime 초 단위 + 크기로 무효화)가 앞 주입의 코드를 그대로 써서, R24 가 R23 의 테스트를 빨갛게 만든 것처럼 보였다. 캐시를 지우고 `-B` 로 다시 돌린 위 표가 판정이다.

못 잡는 것(알고 둔다): 버스 묶음 전송 중 실패(네트워크)의 재시도는 `place_client._request` 의 연결 재시도뿐이고, 같은 묶음 재전송이 같은 자연 키를 덮는다는 것은
`PlaceSchemaIntegrationSpec` 이 「다시 보낸 묶음은 행이 늘지 않는다」로 본다. 실제 원천 23만 행 적재 소요는 운영 첫 회차(TG6.4)에서 잰다.

# 회귀 주입 — 가까운 역·정류장 색인·화면·서버 렌더 (TG6 배포 전)

같은 방식이다. 임시 사본(스크래치패드 `regress-tg6/`, `node_modules`·`build`·`.git`·`.gradle` 을 뺀 rsync 사본 + `portal-fe/node_modules` 심링크)에
하나씩 넣고 검사를 돌린 뒤 원본으로 되돌렸다. 스크립트 `inject-tg6.py` 가 되돌린 파일을 사본 원본·워킹트리와 대조하고, 화면 골든 생성기가 사본에서
다시 쓴 골든·캡처도 되돌린다. 판정은 vitest JSON 리포트·JUnit XML 의 실패 테스트 이름, 게이트는 `verifySearchIndexContract` 출력 줄이다.
주입은 전부 `npx tsc -b` exit 0 · Kotlin 컴파일 통과다(`compile_error=False`).

판정 근거: 화면·서버 모두 리터럴 기대 문구(「서울역 (1·4호선) · 직선거리 999m」「시청역 (1·2호선) · 직선거리 1.0km」, 1,049 → 「1.0km」 · 1,050 → 「1.1km」,
「이 지역은 버스정류장 위치 자료가 없습니다」), 서버는 렌더된 HTML 의 `access` 절, 패리티는 **화면 `accessView` 출력으로 쓴 골든** ↔ 서버 HTML,
색인 왕복은 태스클릿이 쓴 bulk 문서 캡처 → 읽기 문서 → 상세 결과다.

| # | 주입 (사본) | 컴파일 | 빨개진 테스트 |
|---|---|---|---|
| R33 | 화면 「직선거리」 문구 빼기(`accessLines.ts` `distance: '직선거리'` → `''`) | tsc exit 0 | `AttractionAccess.test.tsx` 「모든 거리 앞에 「직선거리」…」 외 2 · `AttractionPage.test.tsx` 「가까운 역·정류장은 행동 줄 바로 아래…」 · `accessLinesGolden.test.ts` 1 (5 / 97) |
| R34 | 서버 「직선거리」 문구 빼기(렌더러 `"직선거리"` → `""`) | 컴파일 통과 | `AttractionPageRendererTest` 「모든 거리 앞에 「직선거리」…」·「버스 원천 미연계면…」, `AttractionAccessParityTest` 3건 |
| R35 | 화면 km 경계 `meters < 1000` → `<= 1000` | tsc exit 0 | `AttractionAccess.test.tsx` 2 · `accessLinesGolden.test.ts` 1 (3 / 97) |
| R36 | 서버 km 경계 `meters < 1000` → `<= 1000` | 컴파일 통과 | 렌더러 1 · 패리티 2(`*-boundaries` 국·영) |
| R37 | 화면 역명에 무조건 「역」(`서울역역`) | tsc exit 0 | `AttractionAccess.test.tsx` 3 · `accessLinesGolden.test.ts` 1 (4 / 97) |
| R38 | 화면 미연계 안내를 줄이 있을 때만 냄 | tsc exit 0 | 「버스 원천 미연계 지역은 「자료 없음」을…」 · 「영문은…」 (2 / 97) |
| R39 | 읽기 문서 `toDomain()` 이 `access` 를 버림(`.takeIf { false }`) | 컴파일 통과 | `AttractionReindexCaptureTest` 「place 가 준 줄·순서·연계 판정을…」·「가까운 역·정류장이 상세 결과까지 남는다」, `AttractionAccessParityTest` 8건 |
| R40 | 읽기 문서 필드 이름 `access` → `accessInfo`(매핑과 어긋남) | 컴파일 통과 | `verifySearchIndexContract` — 「반드시 읽어야 할 필드를 안 읽는다: access」 외 2줄 |
| R41 | 배치 클라이언트가 extras 의 `access` 를 읽지 않음(`access = null`) | 컴파일 통과 | `PlaceApiClientTest` 「무장애 코드·원문과 웰니스 코드가 그대로 나오고…」(access 만 있는 51 · 미연계만 있는 52 단언) (1 / 24) |
| R42 | 태스클릿이 문서에 `access = null` | 컴파일 통과 | `AttractionApiReindexTaskletTest` 「가까운 역·정류장은 place 순서 그대로…」 (1 / 42) |
| R43 | 서버 렌더 본문에서 `accessSection` 호출 삭제 | 컴파일 통과 | 렌더러 4(자리 순서 포함) · 패리티 8 |
| R44 | 화면 안내 문구만 「더 깁니다」→「더 길 수 있습니다」, 사본에서 골든 재생성 뒤 서버 패리티 | tsc exit 0 · 컴파일 통과 | `AttractionAccessParityTest` 3건(국문 안내 줄이 있는 사례) — 패리티가 화면 출력과 서버 HTML 을 실제로 맞댄다 |

TG6.7 목록 대조: FE `SAVED_MIN` 2 → R1·R20, search/domain `SAVED_MIN` 2 → R3·R24, batch `min` 2 → R12, 「직선거리」 빼기 → R33(화면)·R34(서버),
congestion 정렬 한 줄 → R4, 헤더 검사 한 줄 삭제 → TG5 R20.

명령(사본 루트에서):

```bash
(cd portal-fe && npx tsc -b && npx vitest run src/pages/place/__tests__/{AttractionAccess.test.tsx,AttractionPage.test.tsx,accessLinesGolden.test.ts})
./gradlew :search:app:test --tests '*AttractionPageRenderer*' --tests '*AttractionAccessParity*' --tests '*AttractionReindexCapture*'
./gradlew :search:batch:test --tests '*AttractionApiReindexTasklet*' --tests '*PlaceApiClientTest*' --tests '*AttractionsIndexMapping*'
./gradlew verifySearchIndexContract
```

못 잡는 것(알고 둔다): 목록 응답(`summarize`)에서 `access` 를 빼는 것은 테스트하지 않았다 — 같은 서비스 테스트 파일을 다른 작업이 고치는 중이라
그 파일에 사례를 더하지 않았다. 구글 지도 대중교통 링크는 외부 링크라 서버 렌더에 없고 화면만 그린다(패리티 대상 밖).
