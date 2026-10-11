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
