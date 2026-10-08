# Security Review — place 허브 최소 행동 계측

## 3라운드 (2026-10-08)

- 대상: `spec.md` 2라운드 개정본 · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` · `context/review-verdict-round2.md` (워크트리 `wt-impl`, origin/main `8a61f0b`)
- 차원: security · 체크리스트 `hns/0.16.1/skills/spec-review/reviewers/security/checklist.md`. 심판 §2 상충 결정 5건은 확정이라 재론하지 않는다.
- 코드 근거(이번 라운드에 다시 읽은 것): `EventCollectDtos.kt` · `EventCollectController.kt` · `ClickHouseAttractionPopularityAdapter.kt` · `AggregateAttractionPopularityUseCase.kt` · `EventRepositoryAdapter.kt` · `CommonJacksonAutoConfiguration.kt` · `OrderSheetControllerTest.kt` · `tracker.ts` · `identity.ts` · `PlacePage.tsx:278-321, 855-884`
- KB: 볼트 `wiki/` 직접 grep — 모르는 키·SQL 보간에 해당하는 페이지 없음. 2라운드에서 읽은 [[anonymous-identity-headers]] (1989v, updated 2026-09-20) 만 이어서 인용한다.

### 2라운드 이슈 추적

| 2라운드 | 개정 문서 | 판정 |
|---|---|---|
| A-1 `requirements.md:25` 가 `keyword` 를 지시 | `:25` "허브 SEARCH payload 의 검색어 필드명은 `term` 이고 `keyword` 를 넣지 않는다. 허브 행은 통합 검색과 같은 `unknown` 키로 간다. 토폴로지 정리는 Q7" | **해소** — 스펙 SR-2.2(`spec.md:31`)와 같은 문장 |
| A-2 `requirements.md:42` 좌표 3자리 반올림 잔재 | `:42` "좌표는 적재하지 않는다(`radiusKm` 만)" | **해소** |
| A-3 `requirements.md:15` CLICK `screenRef: keyword \|\| 지역코드` | `:15` "`screenRef: SR-2.1 의 지역 코드`" | **해소** — 검색어가 `screen_ref` 열로 복사되는 경로 없음 |
| A-4 `test-quality.md:5` SEARCH 단언 필드 `keyword` | `:5` "payload.trigger·changed·term·total, `keyword`·좌표 없음"; `:32` 에 금지 키 부정 단언(`keyword`·`lat`·`lng`·`geo` 없음) | **해소** — 테스트가 이제 `keyword` 부재를 요구한다 |
| B Q12 에 방침 §2 검색어 행 누락 | `open-questions.yml:61` "방침 §2 에 검색어 행 추가(통합 검색·허브 SEARCH 의 entity_id·payload.term·correctedKeyword)" | **해소** — `spec.md:125` Out of Scope 와 일치 |

### 부모가 지목한 세 가지 확인

**1. SR-7.1 「모르는 키는 Jackson 기본값대로 무시」 — 주입면 아님.**
- 무시는 "바인딩하지 않고 버린다" 이지 "아무 키나 받아 넣는다" 가 아니다. 위험한 쪽은 반대(mass assignment)인데 `CollectEventsRequest`·`CollectEventItem` 에는 `@JsonAnySetter` 도 최상위 `Map` 도 없다(`EventCollectDtos.kt:20-23, 31-49`). 본문 `visitorId` 는 DTO 에 필드가 없으므로 어디에도 닿지 않는다 — 1라운드 이슈 3 의 「도달 불가」가 그대로 유지된다.
- 런타임 기본값: analytics·common 에 `FAIL_ON_UNKNOWN_PROPERTIES`·`spring.jackson.*` 재정의가 없다(grep 0건). `CommonJacksonAutoConfiguration.kt:31-33` 의 `ObjectMapper()` 빈은 `@ConditionalOnMissingBean` 브리지일 뿐 MVC 컨버터가 쓰는 Boot 의 `JsonMapper` 를 바꾸지 않는다. 레포가 같은 동작을 의도적으로 쓰는 선례가 있다 — `OrderSheetControllerTest.kt:60-64` "요청 JSON 에 가격·금액 필드를 넣어도" 가 모르는 키를 버리는 쪽을 **방어**로 삼는다.
- 남는 클라이언트 자유도는 선언된 `payload: Map<String, Any?>` 뿐(`EventCollectDtos.kt:49`)이고 기존 상태다. 화면이 좌표를 싣지 않기로 한 것(SR-2.2)과 별개로 악의적 클라이언트가 자기 payload 에 무엇을 넣든 자기 행에만 남는다.
- 메모(판정 무관, 테스트 전략 차원에 넘김): SR-9.2 "beacon 모양 그대로 → 202" 케이스는 standalone MockMvc 가 Boot 와 같은 mapper 를 쓰지 않으면 400 이 날 수 있다. 선례 `OrderSheetControllerTest.kt:48-50` 처럼 `JacksonJsonHttpMessageConverter(mapper)` 를 명시하면 된다 — 테스트 본문에서 `visitorId` 를 지워 통과시키면 이 결정이 검증되지 않은 채 남는다.

**2. SR-8.2 상수 보간(`joinToString`) — 주입면 아님.**
- 값은 `AggregateAttractionPopularityUseCase.companion` 의 `setOf("MAP_LINK", "FAVORITE")` 리터럴이고 설정값·환경변수로 올리지 않는다(`spec.md:64`). `Set<String>` 은 불변이라 런타임 입력이 섞일 자리가 없다. `joinToString { "'$it'" }` 결과는 `'MAP_LINK', 'FAVORITE'` 로 고정된다.
- 현재 어댑터도 같은 방식으로 `ANONYMOUS_VISITOR` 를 보간하고(`ClickHouseAttractionPopularityAdapter.kt:3, 57`) 유일한 런타임 값 `day` 는 `ps.setString` 으로 간다(`:26, 30-31`). 어댑터가 application 상수를 import 하는 선례도 같은 파일 `:3` 이라 의존 방향이 새로 열리지 않는다. companion 에 `MAX_REAGGREGATE_DAYS` 가 이미 있어(`AggregateAttractionPopularityUseCase.kt:22-25`) 상수를 둘 자리도 맞다.
- `INSERT_DAY` 를 `private val` 로 내리면 문자열은 클래스 초기화 때 한 번 조립되고 호출마다 이어 붙이지 않는다.

**3. SR-10 질의 — 읽기 전용.**
- `spec.md:87-103` 두 질의는 `analytics.events` 를 읽는 `SELECT` 뿐이고 DDL·DML 이 없다. 조건은 리터럴(`screen_type`, `visitor_id != 'anonymous'`, `section_id IN (...)`)이다.
- SR-9.4(`spec.md:70`)가 배포 뒤 실행하는 것도 "SR-10 질의와 인기 재집계 `SELECT`" 로 읽기뿐이다. 어댑터의 DELETE+INSERT(`ClickHouseAttractionPopularityAdapter.kt:25-33`)는 기존 스케줄 잡이 돌리는 것이고 이 스펙이 손으로 실행하라고 적지 않는다.

### 새 발견 검토 (실질적 보안 결함만 더한다 — 해당 없음)

- `screenRef`·`payload.sido/sigungu` 가 기기 위치에서 파생되는지 확인했다. `nearMe` 는 `geo` 만 바꾸고(`PlacePage.tsx:872-877`) 시도·시군구는 사용자가 고른 필터 값으로 따로 간다(`:283-285`). 따라서 좌표를 뺀 뒤에도 기기 위치가 시군구 단위로 우회 적재되는 경로는 없다. 지역 페이지가 이미 같은 전체 지역 코드를 `screenRef` 로 보낸다(스펙 Existing Code 의 `RegionPage.tsx:271-296`).
- 본문 `sessionId` 는 헤더 `X-Session-Id` 와 같은 신뢰 수준이다 — 둘 다 화면이 만든 난수(`identity.ts:44-48`)이고 게이트웨이가 만들지 않는다. 저장은 `ps.setString`(`EventRepositoryAdapter.kt:22-31, 48`)이라 ClickHouse 주입면 없음, `@Size(max = 128)` 이 길이를 막는다. KB [[anonymous-identity-headers]] "어느 쪽도 어뷰징 방어가 아니다" 와 같은 판단.
- SESSION_START 의 `sessionStorage` 플래그, `payload.newTab`, `FavoriteButton` 의 `tracking` prop — 새 데이터 범주가 아니다.
- 2라운드 STRIDE 표는 그대로 유효하다. 개정으로 Spoofing(`user_id` null 고정)·Disclosure(좌표 제거) 결정이 planning 문서까지 일관된다.

### 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 | SHIP | 2라운드 표 유지. SR-7.2 Spoofing · SR-2.2 Disclosure 결정이 스펙·planning 에 같은 문장으로 있다 |
| 2 | 인증/인가 경계 | SHIP | `userId` null 고정(`spec.md:59`), Kotest 로 고정(`:68`), 회원 귀속은 Q9 |
| 3 | 민감 데이터 흐름 | SHIP | 이슈 A 네 줄·이슈 B 해소. 좌표 없음, 검색어 필드 `term`, 방침 §2 검색어 행은 Q12 |
| 4 | 입력 검증 바운더리 | SHIP | `sessionId @Size(128)`, 모르는 키 무시는 바인딩 면을 넓히지 않음, SQL 은 리터럴 상수 + prepared statement |
| 5 | 서비스 간 통신 | SHIP | 변동 없음 |
| 6 | 시크릿 | SHIP | 없음 |
| 7 | 암호화/해싱 | SHIP | 변동 없음 |
| 8 | 감사 로깅 | SHIP | 해당 없음 |
| C1 | PCI | SHIP | 해당 없음 |
| C2 | 주문/재고 권한 | SHIP | 해당 없음 |
| C3 | Rate Limiting / Abuse | SHIP(조건) | 크롤러 거부 유지(SR-7.3), 레이트리밋은 Q12 |

### 판정

2라운드 이슈 A(planning 네 줄)·B(Q12) 모두 해소. 부모가 지목한 세 지점(모르는 키 무시·상수 보간·SR-10)은 주입면이나 쓰기 경로를 만들지 않는다. 새 보안 결함 없음.

VERDICT(3라운드): SHIP

---

## 2라운드 (2026-10-08)

- 대상: `spec.md` 개정본 · `planning/requirements.md` · `planning/test-quality.md` · `context/open-questions.yml` (워크트리 `wt-impl`, origin/main `8a61f0b`)
- 차원: security · 체크리스트 `hns/0.16.1/skills/spec-review/reviewers/security/checklist.md`
- 코드 근거: `EventCollectController.kt` · `EventCollectDtos.kt` · `VisitorIdFilter.kt` · `gateway/application.yml` · `tracker.ts` · `identity.ts` · `useFavorites.ts` · `PlacePage.tsx` · `ClickHouseAttractionPopularityAdapter.kt` · `AnalyticsStreamTopology.kt` · `V005__events_two_axis.sql` · `PrivacyPage.tsx` · ADR-0077/0078/0095
- KB: Bash 미제공으로 `kb-search.sh` 대신 볼트 `wiki/` 를 직접 grep. 읽은 페이지 — [[anonymous-identity-headers]] (1989v, updated 2026-09-20), [[guest-to-account-migration]] (1989v, updated 2026-08-29)

### 1라운드 발견 추적

| 1라운드 | 개정 스펙 | 판정 |
|---|---|---|
| 1. `X-User-Id` 가 검증 없이 `user_id` 로 들어간다 | SR-7.2 "`X-User-Id` 헤더를 읽지 않는다 — `userId` 는 null 고정" + SR-9.2 Kotest "`X-User-Id: 1` 이어도 `userId == null`" + Q9(회원 귀속이 필요해지면 라우트 이전 + 인증 필터 required=false) | **해소**. 라우트는 그대로 필터 없음(`gateway/src/main/resources/application.yml:37-41`)이라 "벗기기" 대신 "읽지 않기"를 택했다. KB [[anonymous-identity-headers]] 「익명 허용 라우트에서는 신원 헤더를 반드시 벗겨라」와 결과가 같고(원장에 위조 값이 닿지 않음), 게이트웨이 불변 제약 안에서 가능한 유일한 수단이다. `ExperimentAssignmentFilter` 의 같은 신뢰는 Q12 로 남겼다 |
| 2. `geo.lat/lng` 기기 좌표를 방침에 없는 채 90일 적재 | SR-2.2 payload 목록에서 좌표 제거, "`radiusKm` … 기기 좌표(위도·경도)는 담지 않는다"; requirements R1(`:14`) 도 같은 문장 | **스펙은 해소**. 단 requirements §제약(`:42`)에 「좌표는 3자리 반올림(약 100m)」이 남아 있다 → 아래 이슈 A |
| 3. 본문 `visitorId`·`sessionId` 길이 상한 없음, `visitorId` 는 도달 불가 | SR-7.1 "`sessionId`(`@Size(max = 128)`)만 더한다 … 본문 `visitorId` 는 받지 않는다"; requirements R2(`:22`) 동일 | **해소**. 화면이 만드는 id 는 UUID 36자 또는 `r-…` 20자 안팎(`identity.ts:11-16`)이라 128 안에 든다. beacon 본문의 `visitorId` 는 FE 가 계속 싣지만(`tracker.ts:65-69`) 서버 DTO 에 없는 키라 무시된다 — analytics·common 에 `fail-on-unknown-properties` 설정 없음(grep 0건) |
| (d) 증거 문서에 테스트한 사람의 좌표가 남을 위험 | SR-9.4 CDP 실행 목록은 검색·필터·카드 선택·지도 링크뿐이고 payload 에 좌표가 없다 | **해소** (이슈 2 해소의 부수 효과) |
| (a)(b)(c) 범위 밖 보고 | Q12 에 `occurredAt` 클램프 · 레이트리밋 · `ExperimentAssignmentFilter` 세 건 등재 | **기록됨**. 방침 §2 검색어 행 부재는 스펙 Out of Scope(`spec.md:102`)에는 있으나 Q12 문구에는 빠졌다 → 이슈 B |

### 위협 모델 (STRIDE, 개정 뒤)

| 축 | 자산 | 판정 |
|---|---|---|
| Spoofing | `user_id` | 해소 — 원장에 null 고정. `visitor_id`/`session_id` 는 원래 클라이언트가 정할 수 있는 익명 키(KB 「어느 쪽도 어뷰징 방어가 아니다」)이고 SR-10 이 `visitor_id != 'anonymous'` 로 헤더 없는 요청만 거른다. 기준선 수치의 조작 가능성은 레이트리밋 부재(Q12)와 같은 문제 |
| Tampering | 인기 집계 | SR-8 제외 조건은 이름 있는 상수를 SQL 에 보간한다. 컴파일 상수로 두는 한 주입면 없음(아래 통과 근거) |
| Information Disclosure | 검색어 · 위치 · 찜 행동 | 좌표 제거로 새 범주 없음. 검색어는 통합 검색이 이미 보내는 범위. 찜 행은 `visitor_id` + 관광지 id 이고 `user_id` 가 null 이라 회원과 잇는 열이 원장에 없다 |
| DoS | 100건 × 본문 | 변동 없음 |
| Repudiation · Elevation | — | 해당 없음 |

### 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 | SHIP | 위 표. 스펙 자체에 표는 없지만 SR-7.2 가 Spoofing 결정을, SR-2.2 가 Disclosure 결정을 적는다 |
| 2 | 인증/인가 경계 | SHIP | `userId` 출처가 SR-7.2 에 명시됨. 라우트 무인증 유지(`application.yml:41`), 응답에 데이터 없음 |
| 3 | 민감 데이터 흐름 | REVISE | 이슈 A — 스펙은 맞으나 requirements `:25`·`:42`·`:15`, test-quality `:5` 가 개정 전 흐름(`keyword` 필드·좌표·CLICK `screenRef` 에 검색어)을 지시한다 |
| 4 | 입력 검증 바운더리 | SHIP | `sessionId @Size(128)`. `entityId`·`payload.term` 은 상한 없음이나 기존 상태(통합 검색 동일)이고 ingress 본문 상한이 막는다. eventId 에 `sectionId` 가 추가되지만 `sectionId.orEmpty()` 로 빈 값 처리(`EventCollectDtos.kt:69`) |
| 5 | 서비스 간 통신 | SHIP | 변동 없음. `SESSION_START` 를 다루는 소비자는 게임 세션 토픽(`GameSessionConsumer.kt:29`)과 추천(`RecommendationEventConsumer.kt:71`, null 매핑)뿐 — 허브 SESSION_START 가 다른 경로로 새지 않는다 |
| 6 | 시크릿 | SHIP | 없음 |
| 7 | 암호화/해싱 | SHIP | 변동 없음 |
| 8 | 감사 로깅 | SHIP | 해당 없음 |
| C1 | PCI | SHIP | 해당 없음 |
| C2 | 주문/재고 권한 | SHIP | 해당 없음 |
| C3 | Rate Limiting / Abuse | SHIP(조건) | 크롤러 거부 유지(SR-7.3). 레이트리밋은 Q12 |

### 이슈 (REVISE)

#### A. planning 문서가 개정 전 데이터 흐름을 지시한다 — 구현자가 requirements 를 따르면 1라운드 이슈 2 와 `term` 결정이 되돌아간다 (체크 3)

**스펙 결정**: SR-2.2 "기기 좌표(위도·경도)는 담지 않는다. 필드 이름은 `keyword` 가 아니라 `term` 이다 — Streams 키워드 지표가 `payload.keyword` 로 상품 키워드 점수를 만들므로"; SR-3.1 CLICK `screenRef` 는 "SR-2.1 의 지역 코드".

**어긋난 문서** (같은 폴더):
- `planning/requirements.md:25` — "허브 SEARCH payload 에 `keyword` 를 넣어 `"unknown"` 키로 떨어지지 않게 한다(키워드 없는 필터 검색은 `'*'`)". 이대로 구현하면 허브 검색어가 `AnalyticsStreamTopology.kt:126-131` 의 `payload["keyword"]` 키로 상품 키워드 지표에 들어간다 — 스펙이 막으려는 바로 그 흐름이고, 같은 문서 `:14` 와도 모순이다.
- `planning/requirements.md:42` — "좌표는 3자리 반올림(약 100m)". 좌표를 보내지 않기로 한 뒤에도 남은 문장. 1라운드 이슈 2 의 잔재.
- `planning/requirements.md:15` — CLICK `screenRef: keyword || 지역코드`. 스펙은 지역 코드만. 검색어가 `screen_ref` 열에 한 번 더 복사되는 경로다.
- `planning/test-quality.md:5` — SEARCH 단언 필드가 `payload.trigger·changed·keyword·total`. 테스트가 `keyword` 를 요구하면 구현이 `keyword` 를 넣는다.

**수정안**: 네 줄을 스펙 문장으로 맞춘다 — `:25` 는 "payload 필드명은 `term`. Streams 키워드 지표에는 `"unknown"` 키로 떨어지며 그 정리는 Q7" / `:42` 는 "좌표는 적재하지 않는다(`radiusKm` 만)" / `:15` 는 "`screenRef`: SR-2.1 지역 코드" / test-quality `:5` 는 `term`. 코드 변경 없음.

#### B. Q12 문구에 방침 §2 검색어 행 부재가 빠졌다 (체크 3, 경미)

`spec.md:102` Out of Scope 는 "`/privacy` §2 에 검색어 행이 없는 것(보고만)" 을 적지만 `context/open-questions.yml:61` Q12 는 `occurredAt`·레이트리밋·`ExperimentAssignmentFilter` 셋만 적는다. 후속 슬라이스 목록이 Q12 로 모이므로 한 항목을 더한다: "방침 §2 에 검색어 행 추가(통합 검색·허브 SEARCH 의 `entity_id`·`payload.term`·`correctedKeyword`)". ADR-0077 §4 "방침에는 실제로 도는 것만 적는다"(`ADR-0077-ledger-retention.md:83-86`) 와 같은 줄기다.

### 통과 근거 (새로 확인한 것만)

- SR-5 찜 행: 로그인 전용 기능이라 FAVORITE 행은 「이 방문자가 그때 회원이었다」를 드러내지만, `user_id` 가 null 고정이고 wishlist 는 회원 id 로만 저장한다 — 원장에서 `visitor_id` 를 회원과 잇는 열이 없다. 방침 §2 "찜 · 평점 · 좋아요 — 대상 식별자와 시각"(`PrivacyPage.tsx:101-105`)과 §6 "조회 · 클릭 기록 90일"(`:263-264`)이 이 행을 덮는다. KB [[guest-to-account-migration]] 의 승계 규칙은 세이브 코드 이야기라 analytics 원장과 무관하다.
- SR-8.2 상수 보간: 현재도 `ANONYMOUS_VISITOR` 하나를 `$` 로 보간한다(`ClickHouseAttractionPopularityAdapter.kt:57`). `NON_LIST_SECTIONS` 도 companion 안 컴파일 상수로 두면 같은 수준이다. 설정값·환경변수로 올리지 않는다는 조건.
- SR-7.1 beacon: FE 는 이미 본문에 `visitorId`·`sessionId` 를 싣고 있어(`tracker.ts:64-69`) 서버만 `sessionId` 를 받으면 된다. 모르는 키 `visitorId` 는 Jackson 기본값으로 버려진다.
- SR-10 질의는 읽기 전용이고 상수 조건뿐이다. 주입면 없음.

### 판정

스펙 본문의 보안 결정은 1라운드 세 건 모두 반영됐다. 남은 것은 planning 두 파일의 네 줄과 Q12 한 항목이며 전부 문서 수정이다.

VERDICT(2라운드): REVISE

---

## 1라운드 (2026-10-08, 원문 보존)

- 스펙: `docs/specs/2026-10-08-place-hub-instrumentation/spec.md` (워크트리 origin/main `8a61f0b`)
- 차원: security · 체크리스트 `hns/0.16.1/skills/spec-review/reviewers/security/checklist.md`
- 읽은 것: spec.md · planning/{requirements,test-quality,initialization}.md · context/open-questions.yml ·
  ADR-0077/0078/0095/0101 · `portal-fe/src/pages/PrivacyPage.tsx` §2·§6 · analytics 수집 경로 ·
  gateway 라우트·필터 · KB [[anonymous-identity-headers]] (1989v, updated 2026-09-20)
- `docs/standards/`·`docs/conventions/`·`.claude/rules/` 에 보안 전용 문서는 없다 — ADR 네 건과 KB 페이지를 표준으로 삼았다.

### 위협 모델 (STRIDE, 이 스펙이 건드리는 면만)

| 축 | 자산 | 판정 |
|---|---|---|
| Spoofing | `user_id`·`visitor_id`·`session_id` 컬럼 | **이슈 1·3** — `X-User-Id` 가 이 라우트에서 검증 없이 통과한다 |
| Tampering | 인기 집계·원장 보존기간 | SR-8 제외 조건은 상수 SQL 이라 안전. `occurredAt` 은 범위 밖 발견 (a) |
| Repudiation | — | 해당 없음 (원장 자체가 기록) |
| Information Disclosure | 검색어 · 현재 위치 좌표 | **이슈 2** — 좌표가 방침에 없는 새 범주 |
| DoS | 100건 묶음 × 본문 크기 | 기존 상한 유지, ingress 기본 1 MB. 레이트리밋 부재는 범위 밖 발견 (b) |
| Elevation | — | 해당 없음 (무인증 쓰기 전용, 응답에 데이터 없음) |

### 체크리스트 판정

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | 위협 모델링 | REVISE | 스펙에 없음. 위 표로 대신했고 이슈 1·2 가 그 결과 |
| 2 | 인증/인가 경계 | REVISE | 이슈 1 — SR-7.1 이 visitor·session 출처는 적고 `userId` 출처는 안 적음 |
| 3 | 민감 데이터 흐름 | REVISE | 이슈 2 — `geo.lat/lng` 가 방침 §2 표·ADR-0095 「하지 않는 것」과 어긋남 |
| 4 | 입력 검증 바운더리 | REVISE | 이슈 3 — 본문 식별자 길이 상한 없음, `visitorId` 는 도달 불가 경로 |
| 5 | 서비스 간 통신 | SHIP | analytics 는 게이트웨이 뒤(`application.yml:37-41`), Kafka 소비자 변경 없음 |
| 6 | 시크릿 | SHIP | 없음 |
| 7 | 암호화/해싱 | SHIP | 전송은 CF TLS. 저장 식별자는 무작위 키(ADR-0095 158행) |
| 8 | 감사 로깅 | SHIP | 해당 없음 |
| C1 | PCI | SHIP | 해당 없음 |
| C2 | 주문/재고 권한 | SHIP | 해당 없음 |
| C3 | Rate Limiting / Abuse | SHIP(조건) | 크롤러 거부 유지(SR-7.3, `CrawlerUserAgents.kt:44-48`). 레이트리밋 부재는 기존 상태 — 범위 밖 (b) |

### 이슈 (REVISE)

#### 1. `X-User-Id` 가 검증 없이 원장 `user_id` 로 들어간다 — SR-7.1 에 userId 출처를 적어야 한다 (체크 1·2)

**스펙**: SR-7.1 "세션 결정 순서는 `X-Session-Id` 헤더 → 본문 `sessionId` → visitorId. visitor 는 헤더 우선(게이트웨이가 항상 채움)". `userId` 는 언급이 없다.

**코드**:
- `/api/v1/events` 는 YAML 무인증 라우트다 — `gateway/src/main/resources/application.yml:37-41`. 필터가 없고 `default-filters` 도 없다(gateway/src/main 전체 grep 0건).
- 글로벌 필터 셋(`VisitorIdFilter`, `ExperimentAssignmentFilter`, `RequestLoggingFilter`) 중 신원 헤더를 벗기는 것은 없다. 벗기는 코드는 라우트별 인증 필터 안(`AuthenticationGatewayFilter.kt:127-131`)과 토스 웹훅 라우트(`GatewayRouteConfig.kt:247-249`)뿐이다.
- 컨트롤러는 그 헤더를 그대로 믿는다 — `EventCollectController.kt:50` `servletRequest.getHeader(USER_HEADER)?.toLongOrNull()` → `EventRepositoryAdapter.kt:49-50` 이 `user_id` 로 저장.
- 정상 경로에서는 이 라우트에 인증 필터가 없어 게이트웨이가 `X-User-Id` 를 **주입하지도 않는다**. 즉 `user_id` 가 채워지는 유일한 경로가 클라이언트 위조다.

**표준 위반**:
- 레포 자체 패턴 — 공개 쓰기 라우트는 "신원 헤더를 벗겨 위조 X-User-Id 가 백엔드에 닿지 않게" 한다(`GatewayRouteConfig.kt:241`). `AuthenticationGatewayFilter.kt:34` 의 "클라이언트가 보낸 신원 헤더는 제거되므로 위조가 불가능하다" 는 그 필터가 걸린 라우트에서만 참이다.
- KB [[anonymous-identity-headers]] (1989v, 2026-09-20): "「인증 불필요 = 필터 불필요」가 입구 — 게스트 허용 경로에도 **헤더 제거 목적으로** 필터를 건다. 이 레포에서 두 번 났고 … `X-User-Id` 한 줄로 아무 회원의 친구 명부가 열렸다" (`wiki/index.md:182-185`).
- ADR-0078 취지(식별 최소화): 임의 회원 id 에 검색어·위치·찜 행동을 꾸며 넣을 수 있는 컬럼이 생긴다.

**영향 범위**: 추천 소비자는 `PRODUCT` 축만 읽으므로(`RecommendationEventConsumer.kt:48`) 이 스펙의 ATTRACTION 행으로 추천이 오염되지는 않는다. 깨지는 것은 원장 무결성과 「회원 X 가 Y 를 검색했다」는 거짓 행의 생성 가능성이다.

**수정안 (스펙 제약 "gateway 는 건드리지 않는다" 안에서)**:
- SR-7.1 에 한 줄: "`userId` 는 이 라우트에서 게이트웨이가 채우지 않으므로 **`X-User-Id` 를 읽지 않는다**(null 고정)." → `EventCollectController.kt:50` 삭제, `toEvent(visitorId, sessionId, null)`.
- SR-9.2 Kotest 에 "헤더 `X-User-Id: 1` 을 줘도 `userId == null`" 1건.
- 회원 귀속이 나중에 필요해지면 그때 라우트를 `GatewayRouteConfig` 로 옮겨 `AuthenticationGatewayFilter(required=false)` 를 거친다 — 그 결정은 방침 §2 표(회원 id ↔ 검색어 결합)와 같이 가야 하므로 별도 슬라이스로 Open Questions 에 적는다.

#### 2. SR-2.2 `geo.lat/lng` — 현재 위치 좌표를 방침에 없는 채로 90일 원장에 적재한다 (체크 3)

**스펙**: SR-2.2 "`geo` 의 위도·경도는 소수점 3자리로 반올림하고 반경은 그대로". requirements §제약 "좌표는 3자리 반올림(약 100m)".

**데이터 성격**: `nearMe` 는 `navigator.geolocation.getCurrentPosition` 의 기기 위치다(`PlacePage.tsx:872-876`). 1년 쿠키 방문자 번호(`VisitorIdFilter.kt:44-48`)와 묶여 ClickHouse 에 90일 남는다(`V005__events_two_axis.sql:34-35,50`). `searchThisArea` 의 지도 중심(`PlacePage.tsx:861-870`)은 개인 위치가 아니지만 스펙은 둘을 같은 `geo` 로 다룬다.

**문서 위반**:
- 방침 §2 표는 관광지 조회를 "무엇을 어느 날 봤는지 + 방문자 번호" 로만 적는다(`PrivacyPage.tsx:86-90`). 위치 행이 없다. §6 보관 항목도 "조회 · 클릭 기록 90일" 뿐이다(`PrivacyPage.tsx:263-264`).
- ADR-0077 §4 "방침에는 실제로 도는 것만 적는다 … 한쪽만 고치면 방침이 거짓이 된다" (`ADR-0077-ledger-retention.md:83-86`).
- ADR-0095 「하지 않는 것」 "개인 식별. `visitor_id`/`session_id` 는 익명 키다" (`ADR-0095-impression-click-pipeline.md:158`) — 100m 단위 반복 위치는 익명 키의 식별력을 올리는 값이다(집·직장 근처에서 반복되면 그 자체로 특정된다).
- ADR-0078 "받아서 저장만 하고 아무도 읽지 않는 상태는 최악 — 위험은 지고 효용은 0" (`ADR-0078-identity-minimization.md:22-23`). 스펙 Goal 은 "2단계 UX 개선 전후 비교" 이고 좌표를 읽는 질의는 어디에도 없다.

**수정안**:
- `geo` 를 `{ radiusKm }` 로 줄인다(lat/lng 제거). nearMe·area 사용량은 `trigger`, 지역은 `screenRef`(시군구 코드) 가 이미 담는다. SR-2.2 payload 목록과 requirements R1 을 같이 고친다.
- 좌표가 꼭 필요하다면(현재 Goal 에 없다) 같은 PR 에 ① 방침 §2 표에 "내 주변 검색 — 대략적 위치(약 1km) + 방문자 번호" 행 ② ADR-0095 「하지 않는 것」 개정 ③ 반올림 2자리 — 셋을 함께 넣고 Open Questions 에 결정으로 남긴다.
- 보고(기존 공백): 검색어(`entityId`, `payload.keyword`·`correctedKeyword`, SR-3.1 CLICK 의 `screenRef`)는 통합 검색이 이미 보내는 범위라 새 위험은 아니지만, 방침 §2 표에 "검색어" 행이 없는 것도 같은 종류의 어긋남이다. 이 스펙이 고칠 의무는 없고 위 ①을 넣을 때 같이 적으면 된다.

#### 3. SR-7.1 본문 `visitorId`·`sessionId` — 길이 상한이 없고 `visitorId` 는 도달 불가 경로다 (체크 4)

**스펙**: SR-7.1 "수집 요청 본문에 선택 필드 `visitorId`·`sessionId` 를 허용한다 … 헤더가 없을 때만 본문 `visitorId`".

**코드**:
- 게이트웨이는 쿠키가 없어도 UUID 를 만들어 `X-Visitor-Id` 를 **항상** 덮어쓴다(`VisitorIdFilter.kt:29,31-33`). `sendBeacon` 도 같은 호스트 쿠키를 싣는다. 따라서 게이트웨이 뒤에서 본문 `visitorId` 가 읽히는 경우는 없다 — 스펙 스스로 "게이트웨이가 항상 채움" 이라고 적었다. 남는 것은 「게이트웨이를 안 거친 요청이 visitor 를 스스로 정하는」 문서화된 경로뿐이다. Out of Scope 의 "게이트웨이 visitor 덮어쓰기" 와도 맞물린다 — 덮어쓰기를 유지하는 한 이 필드는 쓸 일이 없다.
- 본문 `sessionId` 는 필요가 맞다 — beacon 은 헤더를 못 싣고(`tracker.ts:64-69`) 게이트웨이는 `X-Session-Id` 를 만들지 않는다.
- 선례: 같은 모양의 ads 수집 DTO 는 두 필드에 `@Size(max = 128)` 을 건다(`ads/feature/.../EventDtos.kt:16-19`). 현재 `CollectEventItem` 은 `entityId` 가 `@NotBlank` 뿐이다(`EventCollectDtos.kt:33`) — 기존 상태.

**수정안**:
- 본문은 `sessionId` 만 받는다. SR-7.1 의 visitor 문장을 "visitor 는 헤더만(게이트웨이가 항상 채움). 없으면 `anonymous`" 로 줄인다.
- `sessionId` 에 `@Size(max = 128)`. 유지한다면 `visitorId` 도 같은 상한 + "헤더가 있으면 본문 무시" 를 SR-9.2 Kotest 로 고정한다.

### 범위 밖 발견 (보고만 — 고치지 않는다)

- (a) `occurredAt` 이 클라이언트 값 그대로 `timestamp` 가 된다(`EventCollectDtos.kt:78`). ClickHouse TTL 이 `timestamp + 90 DAY` 라(`V005__events_two_axis.sql:50`) 미래 시각을 넣은 행은 방침 §6 의 90일을 넘겨 남는다. ADR-0077 §4 무결성 문제. 클램프(`now-24h .. now+5m`) 한 줄이면 되지만 이 스펙의 요구가 아니다.
- (b) `/api/v1/events` 에 레이트리밋이 없다. 공개 쓰기에 `requestRateLimiter` 를 거는 레포 패턴(`GatewayRouteConfig.kt:250-254`)과 다르다. 게이트웨이 변경이라 후속.
- (c) `ExperimentAssignmentFilter.kt:30` 도 클라이언트 `X-User-Id` 를 읽어 실험 버킷을 정한다 — 이 라우트에서 버킷을 고를 수 있다. 이 스펙과 무관.
- (d) SR-9.3 증거에 `/api/v1/events` 본문을 기록할 때 nearMe 를 실제 기기 위치로 돌리면 테스트한 사람의 좌표가 증거 문서에 남는다. CDP `Emulation.setGeolocationOverride` 로 합성 좌표를 쓴다(이슈 2 수정안을 따르면 자연히 사라진다).

### 통과 근거 (짧게)

- SR-7.3 크롤러 거부 유지: `CrawlerUserAgents.kt:44-48`. 헤드리스 마커(`:28`) 때문에 SR-9.3 이 일반 UA 를 명시한 것이 맞다.
- SR-8 SQL: `INSERT_DAY` 는 상수 문자열 + prepared statement(`ClickHouseAttractionPopularityAdapter.kt:51-62`), 유일한 보간은 컴파일 상수 `ANONYMOUS_VISITOR`. `section_id NOT IN ('MAP_LINK','FAVORITE')` 도 같은 방식이면 주입면 없음.
- ADR-0101: `X-Session-Id` 는 인증 세션이 아니라 `sessionStorage` 난수(`identity.ts:44-48`). 토큰이 본문·헤더로 새는 경로 없음. 라우트가 무인증이라 CSRF 쟁점도 없다.
- ADR-0077 보존기간: 새 행도 같은 테이블의 TTL 90일을 따른다 — 방침 §6 "조회 · 클릭 기록 90일" 과 일치(이슈 2 의 범주 문제와 (a) 의 타임스탬프 문제는 별개).

1라운드 판정 — REVISE

---

VERDICT: SHIP
