# Task Breakdown: place 관광 포털 확장 — 행사·숙박·여행코스 + 공공데이터 2단계

## Overview
Total Task Groups: 13

표준: 레이어 `docs/conventions/package-structure.md`(ADR-0083 — UseCase 인터페이스 · Outbound Port · Adapter, application 은 infrastructure 를 import 하지 않는다) ·
테스트 `docs/standards/test-rules.md`(Kotest BehaviorSpec + MockK) · 영속성 `docs/conventions/jpa-persistence.md`(Flyway + validate, 커밋한 V 는 고치지 않는다) ·
외부 데이터 `docs/architecture/data-sources.md` §0(원천 전부 적재 · 파생 컬럼 · 전체 동기화 필드 목록 함께 갱신) · 배포 `k8s/CLAUDE.md`(단일 노드 — 이미지는 단계별로, 동시 롤아웃 금지) ·
FE `DESIGN.md` 토큰, `docs/standards/fe-visual-verification.md`.
★ 검사는 대상 코드를 되돌려 빨간불을 본 뒤에만 체크한다. 테스트 번호(T#)는 `planning/test-quality.md`. 「없음」 단언은 같은 실행에 양성 대조군을 둔다.
검증 명령은 전부 범위를 지정한다(전체 스위트 금지). 배포 단계 ①②③④ 는 spec SR-10 순서다.

**머지 조건(SR-10 · Q1 · Q3):** 첫 운영 호출 표본이 `implementation/` 에 들어오기 전에는 수집 코드(TG3)를 머지하지 않는다.
합성 픽스처로 짠 수집 검사는 표본으로 바꾼 뒤에만 ★ 를 단다.

### Task Group 1: 사전 확인 — 운영 표본 · 기준선 · 용어
**Dependencies:** None
**Phase:** ① 착수 전
**Required Skills:** TourAPI 호출, 읽기 전용 SQL, 문서
- [x] 1.0 Complete 사전 확인
  - [x] 1.1 Write checks: 표본 정제 게이트 — `implementation/*.json` 에 `serviceKey`·키 값·개인 정보 문자열이 없다(grep, 회귀 주입: 키 한 줄을 넣어 실패 확인) · T18 기준선 쿼리가 키셋(OFFSET 없음)인지 로컬 DB 에서 실행 확인
  - [x] 1.2 Q1: `searchFestival2` 를 기준일 오늘·오늘 − 365 두 번 호출(국·영) → 건수 · 겹침 · 쪽수 · 좌표 없는 행 수를 `implementation/q1-festival-window.md` 에, 응답 표본을 `implementation/sample-searchFestival2-{ko,en}.json` 에
  - [x] 1.3 Q1 결과로 창 결정 — 국·영 합 60쪽 초과면 −180일, 결정을 ADR-0104 에 덧붙이고 SR-1b 호출 수 갱신
  - [x] 1.4 Q3: `searchStay2`(32·80)·`areaBasedList2`(25) 표본 → `implementation/sample-searchStay2-{ko,en}.json` · `sample-course-ko.json`, `areaBasedList2` 와 다른 필드 목록 기록
  - [x] 1.5 Q2: 옛 영문 2건이 `searchStay2`(80) 목록에 있는지 확인 → 없으면 채움 경로(SR-1 Q2 default)를 `implementation/q2-legacy-en.md` 에
  - [x] 1.6 Q4: 표본에서 S 만 · E 만 · S>E · 변환 실패 건수 → `implementation/q4-event-dates.md`
  - [x] 1.7 Q5: 숙박 표본 20곳 후기의 협찬 표기 비율 → 결정을 `context/open-questions.yml` Q5 에
  - [x] 1.8 롤백 확인: 옛 content 이미지의 bulk DTO 가 모르는 필드를 무시하는지 거부하는지 → `implementation/rollback-bulk-unknown-field.md`
  - [x] 1.9 `/hns:glossary` — `search/glossary.md` §3-1 에 행사 상태 넷 · 유효 시작일·유효 종료일 · `eventStatus` 다섯 · 이번 주말 · 이번 달 · 만료 noindex · 코스 구성 · 근처 행사 · 근처 숙소 · `festival`·`course`, 반경 절 표기 「주변 명소」
  - [x] 1.10 Verify: `ls docs/specs/2026-10-02-place-tour-portal-expansion/implementation/sample-*.json && ! grep -rniE 'servicekey|[0-9a-f]{64}|[A-Za-z0-9+/%]{60,}' docs/specs/2026-10-02-place-tour-portal-expansion/implementation/*.json`
**Acceptance Criteria:** Q1~Q4 표본·기록 존재 · 창 결정이 ADR-0104 에 · 정제 게이트 회귀 주입 빨간불 · 용어 등재

### Task Group 2: place 저장 — V23 · 왕복 경로 · 딥링크 (place:domain · place:feature)
**Dependencies:** Task Group 1
**Phase:** ①
**Required Skills:** Kotlin, JPA, Flyway
- [x] 2.0 Complete place 저장
  - [x] 2.1 Write tests: `AttractionTest.syncFrom`(T4 ① — 날짜 없는 개요·이용정보·사진·반려동물 왕복이 행사 날짜·목록 원문을 지우지 않음, 유형 12 목록 동기화가 개요·introRaw·petRaw·setting·infoRaw 유지) · `AttractionJpaEntityTest`(T4 ② `fromDomain(toDomain(e))` 새 세 컬럼 보존) · `AttractionRepositoryAdapter` 저장소 대역(T4 ③ `saveAll` 뒤 유지) · `AttractionDtoRoundTripTest`(T4b) · `AttractionDeepLinkTest`(T11b — 32·80 은 `MYREALTRIP`·`KLOOK` 없음, 같은 실행의 12 는 둘 다 있음)
  - [x] 2.2 `placedb/migration/V23__add_attraction_event_dates_and_list_raw.sql` — 행사 시작일·종료일 `DATE` · 목록 행 원문 `TEXT`, 모두 nullable
  - [x] 2.3 도메인 `Attraction`(`create`·`restore`·`syncFrom` — 들어온 값이 있을 때만 갱신) · `SIGHT_CATEGORIES` 는 그대로
  - [x] 2.4 새 컬럼이 지나가는 자리 전부: JPA 엔티티(`fromDomain`·`toDomain`) · bulk 요청 DTO → 도메인 · `UpsertAttractionUseCase` 커맨드 · `GetAttractionUseCase.AttractionView` · `AttractionService` 두 매핑 · 목록 응답 DTO
  - [x] 2.5 `AttractionDeepLinks.of` 가 유형을 받아 숙박(32·80)의 `TOUR_PRODUCT` 를 제외 — 호출부(`AttractionLinkService`) 갱신
  - [x] 2.6 Verify: `./gradlew :place:domain:test --tests '*AttractionTest' --tests '*AttractionSyncFromTest' --tests '*AttractionDeepLinkTest' && ./gradlew :place:feature:test --tests '*AttractionDtoRoundTripTest' --tests '*AttractionJpaEntityTest' --tests '*AttractionRepositoryAdapter*'`
  - [x] 2.7 보조(Docker 있는 환경만): `./gradlew :place:feature:test --tests '*PlaceSchemaIntegrationSpec'` — 실제로 돈 출력 줄을 증거로, 건너뛴 실행은 ★ 근거로 쓰지 않는다
**Acceptance Criteria:** T4 ①②③ · T4b · T11b 초록 + 회귀 주입(엔티티 매핑에서 컬럼 하나 삭제 · `syncFrom` 무조건 덮어쓰기) 빨간불

### Task Group 3: 수집기 — 정규화 · 세 오퍼레이션 · 보강 우선순위 (place-ingest)
**Dependencies:** Task Group 1 (표본), Task Group 2 (bulk 필드)
**Phase:** ①
**Required Skills:** Python, pytest, TourAPI
- [x] 3.0 Complete 수집기
  - [x] 3.1 Write tests: `tests/categorize_test.py`(T6 — 15/85 → `festival` · 32/80 → `stay` · 25 → `course` · 기존 표본 전량 결과 동일 · 레포츠 `AC05` → `stay` 유지 · `EV` → `culture` 아님) · `tests/sync_tour_portal_test.py`(T7 — 응답 픽스처는 TG1 표본) · `tests/backfill_pick_test.py`(T7b) · `tests/upsert_fields_test.py`(T5)
  - [x] 3.2 `CONTENT_TYPES` 를 언어 키가 없을 수 있는 형태로(행사 ko 15/en 85 · 숙박 ko 32/en 80 · 코스 ko 25) · 기존 5유형 값 불변
  - [x] 3.3 `normalize_row(item, lang)` 분리 — `fetch_area_based` 도 이것을 쓴다. 기존 `--job=sync` 정규화 결과 전량 비교(T7)
  - [x] 3.4 `searchFestival2`(시작일 = KST 오늘 − 365, TG1 결정 반영) · `searchStay2` · `areaBasedList2`(25) 무지정 전국 페이징
  - [x] 3.5 행사 날짜 `yyyyMMdd` → ISO, 8자리 숫자 아님·달력에 없는 날짜는 그 값만 None(행은 남김) + 유형·언어별 「날짜 변환 실패 n건」 로그
  - [x] 3.6 행 원문 전체를 목록 행 원문 필드에 · 좌표 없는 행 제외 + 유형·언어별 제외 건수 로그(§0 ① 명시 예외)
  - [x] 3.7 `main.py` 새 잡 `--job=tour-portal-sync`(`_job_sync` 를 거치지 않음) — 유형·언어 하나가 실패해도 나머지 계속(`sync_pet_tour` 방식), 유형·언어별 호출 수 · 적재 · 좌표 제외 · 날짜 변환 실패 로그
  - [x] 3.8 `UPSERT_FIELDS`(`backfill_overview`) · `fetch_attractions` 응답에 새 필드 — 전체 동기화 필드 목록 함께 갱신(§0 ③)
  - [x] 3.9 `backfill_media.pick` 이 코스(25)를 관광 분류와 같은 순위로 · `backfill_overview.pick`·이용정보 pick 이 종료 아닌 행사를 맨 앞에 시작일 오름차순(원천 날짜 + KST 오늘만으로 거름)
  - [x] 3.10 Q2 결과가 「목록에 없음」이면 채움 경로(수동 76 동기화 또는 일회성 보정 스크립트)를 여기 포함
  - [x] 3.11 Verify: `cd place/ingest && python -m pytest -q tests/categorize_test.py tests/sync_tour_portal_test.py tests/backfill_pick_test.py tests/upsert_fields_test.py`
**Acceptance Criteria:** T5·T6·T7·T7b 초록 · 픽스처가 TG1 운영 표본으로 바뀐 뒤에만 ★ · 회귀 주입(날짜 변환 실패 시 행 버리기 · 실패 격리 제거) 빨간불

### Task Group 4: CronJob · 대장 · 배포 ① · 운영 확인
**Dependencies:** Task Group 2, 3
**Phase:** ①
**Required Skills:** Kubernetes CronJob, 운영 SQL
- [ ] 4.0 Complete 배포 ①
  - [x] 4.1 Write checks: `kubectl kustomize k8s/overlays/oci-arm` 렌더에 `place-ingest-tour-sync` 가 있고 `schedule: "10 18 * * *"` · `activeDeadlineSeconds: 540` · `timeZone` 없이 UTC 기준(grep 판정, 회귀 주입: 540 → 900 이면 실패) · 네트워크 정책 수 불변(새 egress 정책 없음)
  - [x] 4.2 `k8s/base/place-ingest/cronjob-tour-sync.yaml`(견본 `cronjob-pet-tour.yaml`) + `kustomization.yaml` · 주석에 하루 호출 수(행사 쪽수 + 숙박 33 + 코스 11)
  - [x] 4.3 `11-allow-egress-https-public.yaml` 주석의 place-ingest 설명만 갱신
  - [x] 4.4 `docs/architecture/data-sources.md` §1·§2 — 세 오퍼레이션 · 새 CronJob · 좌표 제외 예외 · 행 단위 공공누리 유형(`cpyrhtDivCd`). 대장에 없으면 배포하지 않는다
  - [x] 4.5 Verify: `kubectl kustomize k8s/overlays/oci-arm | grep -A30 'name: place-ingest-tour-sync' | grep -E 'schedule|activeDeadlineSeconds' && ./gradlew verifyArchitecture`
  - [x] 4.6 배포 직전: T18 기준선 — 보강 필드 비공백 건수(키셋) → `verifications/ops-before.txt`
  - [ ] 4.7 배포 순서: content(JVM) → place-ingest 이미지 + CronJob → 첫 수집(수동 Job). 한 번에 한 이미지(`k8s/CLAUDE.md`)
  - [ ] 4.8 **배포 ① 뒤 운영 확인(SR-10b):**
    - [ ] 4.8.1 응답·로그가 새 이미지에서 나왔는지 먼저 확인(잡 로그에 새 로그 문구 「날짜 변환 실패」가 있는지) — 없으면 측정 폐기
    - [ ] 4.8.2 유형·언어별 적재 건수 = 호출 totalCount − 좌표 제외(로그 값)
    - [ ] 4.8.3 SR-1 4건(2775576 · 1891566 · 2948191 · 3112217)이 `contentTypeId`·`ldongRegnCd`·`ldongSignguCd` 를 가짐 · 영문 2건은 Q2 경로대로
    - [ ] 4.8.4 `ops-before.txt` 와 같은 쿼리 결과 diff — 어떤 건수도 줄지 않음
    - [ ] 4.8.5 첫 실행 소요를 `implementation/` 에 — 7분 초과면 시각을 다시 고른다(03:20 구글 보강과 겹치지 않게)
    - [ ] 4.8.6 Q4 건수(S>E · 날짜 없음)를 `implementation/q4-event-dates.md` 에 갱신 — UNKNOWN 이 행사의 1% 초과면 규칙 재검토
**Acceptance Criteria:** T18 diff 무감소 · 4건 채워짐 · 소요 7분 이하 · 대장 갱신

### Task Group 5: 행사 일정 규칙 · 코스 구성 파서 (search:domain)
**Dependencies:** Task Group 4 (운영 확인 완료)
**Phase:** ②
**Required Skills:** Kotlin, 순수 도메인
- [x] 5.0 Complete 일정 규칙
  - [x] 5.1 Write tests: `EventScheduleTest`(T1 경계 · KST 자정 UTC 14:59/15:00 · T2 주말·이번 달·`NOT_ENDED`·정렬 · T2b 날짜 격자 범위 ⇔ 상태 동치, 회귀 주입 `>`→`>=`) · `CourseStopsParserTest`(T8 — `subnum` 수 정렬 1,2,10 · dict 단건 · 매칭 실패 이름만 · 빈 `infoRaw` · 언어 불일치)
  - [x] 5.2 `EventSchedule`: 유효 기간 정규화(S/E 다섯 조합) · 상태(`UPCOMING`·`ONGOING`·`ENDED`·`UNKNOWN`) · 필터 → 범위 다섯 · `eventStart` 정렬 — 오늘(`LocalDate`)은 인자, 시계를 읽지 않는다
  - [x] 5.3 `CourseStopsParser` — `infoRaw` → (순서 · 원천 contentId · 이름), 실패는 빈 결과 + 경고 사유
  - [x] 5.4 T12b 골든 생성기: `EventSchedule` 날짜 격자(경계일 · KST 자정 · 주말 요일 · 월말 · 만료 +30/+31) → `portal-fe/src/seo/__tests__/fixtures/event-schedule-golden.json`, CI 재생성 + `git diff --exit-code`
  - [x] 5.5 Verify: `./gradlew :search:domain:test --tests '*EventScheduleTest' --tests '*CourseStopsParserTest' --tests '*EventScheduleGolden*'`
  - [x] 5.6 배포 메모: `search/domain` 만 바뀐 커밋은 `search` 만 다시 굽는다 — `images.yml` 을 `services=search-batch` 로 수동 실행(SR-10)
**Acceptance Criteria:** T1·T2·T2b·T8 초록 · 격자 동치 회귀 주입 빨간불 · 골든 파일 생성

### Task Group 6: 재색인 — 유효 날짜 · 코스 구성 · 종료 행사 제외 (search:batch)
**Dependencies:** Task Group 5
**Phase:** ②
**Required Skills:** Spring Batch, OpenSearch 매핑
- [ ] 6.0 Complete 재색인
  - [ ] 6.1 Write tests: `PlaceApiClientTest`(T9b — 응답 JSON 의 시작·종료일·목록 원문이 DTO 에, 없으면 null) · `AttractionApiReindexTaskletTest`(T9 — bulk 캡처 → `AttractionSearchDocument` 역직렬화 → `toDomain()` 이 유효 날짜·코스 순서와 같음 · `(lang, contentId) → id` 매칭 · 매칭 실패 로그 · 재색인일 기준 종료 행사가 가까운 곳·비슷한 곳·지역 건수에서 빠짐 · 항목 유효 종료일이 쓰기→읽기→UseCase 결과까지)
  - [ ] 6.2 `PlaceApiClient.AttractionDto` · `fetchPageAfter` 손 매핑에 새 세 필드(빠지면 null 이 조용히 이긴다)
  - [ ] 6.3 1차 투영 `RegionProjection` 에 contentId · 유효 시작·종료일 → 1차 훑기가 `(lang, contentId) → id` 지도 · 2차 훑기가 매칭(추가 조회 없음)
  - [ ] 6.4 문서에 `eventStartEffective`·`eventEndEffective`(`date`) · `courseStops`(색인 안 하는 객체) — 해석 실패는 그 필드만 비움
  - [ ] 6.5 `ENDED`·`UNKNOWN` 행사를 가까운 곳·비슷한 곳 후보와 지역 문구 건수에서 제외 · 항목 하위 필드(유효 종료일)를 다섯 자리에: `RegionAggregator` · `SimilarPlace` · `AttractionIndexDocument` · `AttractionSearchDocument` · `SearchAttractionUseCase` 결과
  - [ ] 6.6 매핑 `attractions-index.json` · 쓰기·읽기 문서 · `searchIndexContracts` — 새 세 필드를 `searchReadOmitted` 에 넣으면 실패하는 금지 목록을 게이트에
  - [ ] 6.7 완료 로그: 새 필드 적재 · 코스 매칭 실패 · S>E · 날짜 없음 건수
  - [ ] 6.8 Verify: `./gradlew :search:batch:test --tests '*AttractionApiReindexTaskletTest' --tests '*PlaceApiClientTest' && ./gradlew verifySearchIndexContract`
**Acceptance Criteria:** T9·T9b 초록 · 회귀 주입(읽기 클래스 필드 삭제 + `searchReadOmitted` 사유 기재 → 게이트 실패 + T9 빨간불 · 하위 필드 삭제 → T9 빨간불)

### Task Group 7: 검색 API — `eventStatus` · `sort=eventStart` (search:app)
**Dependencies:** Task Group 6
**Phase:** ②
**Required Skills:** OpenSearch 질의, Spring MVC
- [ ] 7.0 Complete 검색 API
  - [ ] 7.1 **먼저** 어댑터를 고치기 전 커밋에서 패싯·랭킹·하이브리드 경로별 요청 JSON 기준 스냅샷 저장(T10 기준)
  - [ ] 7.2 Write tests: `AttractionSearchAdapterEventTest`(T10 — 다섯 값의 범위 질의 · 「행사가 아니거나 범위 안」 모양 · `sort=eventStart` · 모르는 값 무시 · 질의 양 끝 날짜를 `EventSchedule` 판정에 넣어 교차 단언 · 파라미터 없으면 바이트 동일 · 자동완성에 「행사가 아니거나 NOT_ENDED」) · `SearchAttractionServiceTest`(고정 `Clock` → 넘긴 범위)
  - [ ] 7.3 `SearchAttractionUseCase` 파라미터 · `SearchAttractionService` 가 `Clock` 으로 KST 오늘 → `EventSchedule` 범위를 `SearchQuery` 에 · 어댑터는 받은 범위만(ADR-0083 방향)
  - [ ] 7.4 자동완성 질의에 행사 조건 상시 적용
  - [ ] 7.5 Verify: `./gradlew :search:app:test --tests '*AttractionSearchAdapterEventTest' --tests '*SearchAttractionServiceTest' --tests '*AttractionSearchAdapterFacetTest' --tests '*AttractionSearchAdapterRankingTest' --tests '*AttractionSearchAdapterHybridTest' && ./gradlew verifyArchitecture`
**Acceptance Criteria:** T10 초록 · 기존 경로 스냅샷 바이트 동일 · 회귀 주입(범위 경계 한 칸) 빨간불

### Task Group 8: 서버 렌더 유형별 본문 · JSON-LD (search:app render · copy.mjs)
**Dependencies:** Task Group 6
**Phase:** ②
**Required Skills:** HTML 렌더, JSON-LD, vitest
- [ ] 8.0 Complete 유형별 본문
  - [ ] 8.1 Write tests: `AttractionPageRendererTest`(T11 골든 HTML — 행사 진행 중·종료·`UNKNOWN` · 숙박 · 코스, 국·영 · 상태 문구 · 출처 문구 · 코스 순서 · 오늘 이전에 끝난 가까운 곳·비슷한 곳 제외 · 숙박 픽스처에 예약 URL 키가 있다는 전제 단언 후 출력에 없음) · `AttractionPageServiceTest`(T3 일부 — 고정 `Clock` → 렌더 포트에 넘어간 날짜) · `AttractionJsonLdParityTest` + vitest `attractionJsonLdGolden.test.ts`(T12 — `@type` ⊇ {Event, LodgingBusiness, TouristTrip}, Kotlin 입력은 픽스처 역직렬화)
  - [ ] 8.2 `AttractionPageService` 가 `Clock` 으로 KST 오늘 → `AttractionPageRenderPort.attractionPage` 인자 · 렌더러는 시계 없음
  - [ ] 8.3 행사 절(기간 · 장소 · 상태 문구 국 「진행 중」「D-n 시작」「종료된 행사」/ 영 「Ongoing」「Starts in n days」「Starts tomorrow」「Ended」 · `introRaw` 행사 원문 키) + JSON-LD `Event`
  - [ ] 8.4 숙박 절(허용 목록: 입실 · 퇴실 · 객실 수 · 객실 유형 · 주차 · 부대시설, 예약 키 미표시) + `LodgingBusiness` · 코스 절(순서 목록, 매칭 지점만 링크 · 총 거리 · 소요 시간) + `TouristTrip`/`itinerary`
  - [ ] 8.5 서버 렌더 본문 끝 출처 문구(국·영) · 새 유형에 `attraction-end` 지면 없음 · 응답 `no-cache` 유지
  - [ ] 8.6 `copy.mjs` 에 같은 JSON-LD 함수(고정 시각) → 골든 재생성, CI `git diff --exit-code`
  - [ ] 8.7 Verify: `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*AttractionPageServiceTest' --tests '*AttractionJsonLdParityTest' && (cd portal-fe && npx vitest run src/seo/__tests__/attractionJsonLdGolden.test.ts)`
**Acceptance Criteria:** T11·T12 초록 · 회귀 주입(숙박 허용 목록 해제 · 코스 문자열 정렬) 빨간불 · 관광지당 OpenSearch 조회 한 번 유지

### Task Group 9: 목록 화면 · 상세 본문 · 정적 sitemap · 배포 ② (portal-fe)
**Dependencies:** Task Group 7, 8
**Phase:** ②
**Required Skills:** React, vitest, CDP
- [ ] 9.0 Complete 화면 ②
  - [ ] 9.1 Write tests: `eventSchedule.test.ts`(T12b — TS 상태 판정·상태 문구를 Kotlin 골든과 비교, 회귀 주입 `<`→`<=`) · `PlacePage` (T16 일부 — 행사 칩 · 국문만 코스 칩 · 상태 칩 기본 `NOT_ENDED` · 키워드 「전체」의 `festival`+`NOT_ENDED` vs 키워드 없음 관광 분류만 · 숙박 오버레이 · 카드·바텀시트 기간·상태 · 새 유형 상세 `attraction-end` 없음 + 관광지 대조 · 숙박 키 허용 목록) · `prerenderPlace.test.ts`(T13 — 입력에 행사 **있음** 단언 → 출력 행사 URL 0 · 관광·코스 ≥ 1 · 숙박 개요+사진 · 레포츠 캠핑장 대조 · 시도 조각 10,000 초과 빌드 실패)
  - [ ] 9.2 TS `eventSchedule.ts`(상태 · 문구) — Kotlin 과 같은 규칙, `placeAttributes.ts` 의 기존 `CONTENT_TYPE_KO/EN` 재사용
  - [ ] 9.3 `PlacePage`: 분류 칩 「행사」(+ 상태 칩 진행 중·이번 주말·예정, 정렬 `eventStart`) · 국문만 「여행코스」 · 숙박 오버레이 토글 · 키워드 「전체」 행사 합류 · `PlaceCard`·`AttractionDetailBody` 기간·상태
  - [ ] 9.4 `placeApi.ts` `eventStatus`·`sort` 파라미터
  - [ ] 9.5 `prerender-seo.mjs`: `indexDoc` 행사 제외 · 숙박(32·80) 개요+사진 조건 · `fetchSidoSlice` 10,000 초과 실패 + 유형별 재분할
  - [ ] 9.6 Verify: `cd portal-fe && npx vitest run src/seo/__tests__/eventSchedule.test.ts src/seo/__tests__/prerenderPlace.test.ts src/pages/place && npx tsc --noEmit -p .`
  - [ ] 9.7 T17 일부: 모바일 세로·가로 CDP — 상태 칩 줄 · 행사 카드·바텀시트 기간 줄 · 코스 순서 목록(start·측정·stop 한 명령)
  - [ ] 9.8 배포 순서: search-batch → 재색인 1회 → search → portal-fe(한 번에 한 이미지)
  - [ ] 9.9 **배포 ② 뒤 운영 확인(SR-10b · T19 일부):**
    - [ ] 9.9.1 응답에 이번에 넣은 유형별 절 마커가 있는지 먼저 확인 — 없으면 측정 폐기
    - [ ] 9.9.2 재색인 소요를 직전 회차와 비교(1800초 안) · 완료 로그의 새 필드 적재 · 코스 매칭 실패 · S>E · 날짜 없음 건수 기록
    - [ ] 9.9.3 Googlebot UA 로 행사·숙박·코스 표본 상세 → `X-Render: ssr` + 유형별 절 · 숙박에 예약 링크·OTA 딥링크 없음
    - [ ] 9.9.4 필터 다섯 값의 API 건수 = 같은 범위 OpenSearch `_count`
    - [ ] 9.9.5 새 정적 sitemap 에 행사 URL 0
**Acceptance Criteria:** T12b·T13·T16(②분) 초록 · 운영 확인 전 항목 증거 · CDP 측정값 기록

### Task Group 10: 근처 행사·숙소 · 지역 허브 「이번 달 행사」 (portal-fe)
**Dependencies:** Task Group 9 (운영 확인 완료)
**Phase:** ③
**Required Skills:** React, vitest, CDP
- [ ] 10.0 Complete 근처 절
  - [ ] 10.1 Write tests: `AttractionPage`(T16 일부 — 근처 행사 반경 20km·`NOT_ENDED`·`eventStart`·6건 · 0건이면 절 없음 · 자기 제외 · 근처 숙소 5km·거리순·6건 · 편의시설 캐로셀에 `stay` 없음 · 같은 숙소 카드 중복 없음) · `RegionPage`(이번 달 행사 `THIS_MONTH`·8건 · 프리렌더 본문에 없음) · `placeApi`(섹션 식별자 `NEARBY_EVENTS`·`NEARBY_STAYS`·`REGION_EVENTS_THIS_MONTH` 로 노출 기록 호출)
  - [ ] 10.2 `AMENITY_CATEGORIES` 에서 `stay` 제거 · 「근처 숙소」가 그 자리
  - [ ] 10.3 상세 「근처 행사」·「근처 숙소」 — 검색 API 로 화면이 그림(서버 렌더 본문 아님)
  - [ ] 10.4 `RegionPage` 「이번 달 행사」 — 조회 시점에 그림
  - [ ] 10.5 Verify: `cd portal-fe && npx vitest run src/pages/place/__tests__/AttractionPage.test.tsx src/pages/place/__tests__/RegionPage.test.tsx src/api/__tests__/placeApi.test.ts && npx tsc --noEmit -p .`
  - [ ] 10.6 T17 일부: 근처 절 카드 모바일 세로·가로 CDP(start·측정·stop 한 명령)
**Acceptance Criteria:** T16(③분) 초록 · 0건 대조(영문 숙박 상세) 와 양성 대조(국문 숙박 많은 지역) 둘 다 기록

### Task Group 11: 행사 만료 — robots · 행사 sitemap · nginx · 배포 ③ (search:app · portal-fe)
**Dependencies:** Task Group 9 (운영 확인 완료)
**Phase:** ③
**Required Skills:** Spring MVC, nginx, vitest
- [ ] 11.0 Complete 만료
  - [ ] 11.1 Write tests: `AttractionPageRendererTest`(T3 — 개요 없음+진행 중 → noindex · 종료 +30 → index · +31 → `noindex, follow` · `UNKNOWN`+개요 → index) · `useSeo` robots(T12b — Kotlin 골든 만료 +30/+31 사례 대조) · `EventSitemapRendererTest`·`EventSitemapServiceTest` + MockMvc(T14 — +30 포함 · +31 제외 · 개요 없음·`UNKNOWN` 제외 · 실패 503 · XML 이스케이프 · `lastmod` W3C · `Clock` 범위) · `prerenderPlace.test.ts`(T13 — 인덱스가 `sitemap-places-events.xml` 을 가리킴 · 상세 0건 분기는 안 가리킴) · nginx 검사(T15)
  - [ ] 11.2 렌더러 robots `noindex = 개요 없음 OR (행사 ∧ 유효 종료일 + 31 ≤ 오늘)` · 클라이언트 `useSeo` 같은 판정
  - [ ] 11.3 레이어(ADR-0083): presentation `/internal/render/sitemap/events.xml`(실패 → 503 매핑) → `RenderEventSitemapUseCase` → 서비스(`Clock`, 범위) → `AttractionSearchPort` 행사 조회 메서드 → infrastructure 어댑터 · XML 은 렌더 포트 뒤 infrastructure 렌더러 · 캐시 없음 · URL 수·생성 시간 로그
  - [ ] 11.4 `prerender-seo.mjs` `writePlaceSitemaps` 인덱스에 행사 sitemap 추가(상세 0건 분기 제외)
  - [ ] 11.5 `portal-fe/nginx.conf` 정확 일치 `= /sitemap-places-events.xml` — place 호스트 외 404 · 고정 upstream 경로(쿼리 미전달) · Cookie·Authorization 제거 · 폴백·`error_page`·`proxy_intercept_errors` 없음 · `Cache-Control: public, max-age=300, must-revalidate` · `X-Robots-Tag $host_robots_tag`. 상세 렌더 location 을 베끼지 않는다(`@attraction_shell` 폴백)
  - [ ] 11.6 T15 검사 스크립트: 스텁 search(503·헤더 기록) + 실제 nginx 컨테이너(ADR-0103 방식) — 회귀 주입 `=` 제거 / 정규식 뒤로 이동 → 빨간불
  - [ ] 11.7 Verify: `./gradlew :search:app:test --tests '*AttractionPageRendererTest' --tests '*EventSitemap*' && ./gradlew verifyArchitecture && (cd portal-fe && npx vitest run src/seo/__tests__/prerenderPlace.test.ts src/seo/__tests__/eventSchedule.test.ts) && bash portal-fe/scripts/check-nginx-events-sitemap.sh`
  - [ ] 11.8 네트워크 정책 19·20 재사용 확인(새 정책 없음): `kubectl kustomize k8s/overlays/oci-arm >/dev/null`
  - [ ] 11.9 배포 순서: search → portal-fe(TG10 과 같은 portal-fe 이미지로 묶어도 된다)
  - [ ] 11.10 **배포 ③ 뒤 운영 확인(SR-10b · T19):**
    - [ ] 11.10.1 새 이미지 확인 — 응답에 행사 sitemap 경로가 있고 사이트맵 인덱스에 새 파일명이 있는지 먼저(없으면 측정 폐기)
    - [ ] 11.10.2 종료 31일 지난 표본 행사 → `noindex, follow`
    - [ ] 11.10.3 `place.1989v.com/sitemap-places-events.xml` 에 그 URL 없음 **그리고** 진행 중 표본 URL 있음 · URL 수 > 0 이고 개요 있는 비종료 행사 `_count` 와 대조
    - [ ] 11.10.4 apex·blog 호스트 같은 경로 404 · 응답 `Cache-Control` 헤더
    - [ ] 11.10.5 근처 행사·숙소·지역 허브 절이 표본 상세·허브에 뜸(TG10)
**Acceptance Criteria:** T3·T12b(robots)·T13(인덱스분)·T14·T15 초록 · 운영 확인 전 항목 증거

### Task Group 12: 2단계 공공데이터 — 승인된 API 부터 하나씩
**Dependencies:** Task Group 4 (수집 틀), API 별 활용신청 승인
**Phase:** ④ (구현 순서 맨 끝)
**Required Skills:** Python, TourAPI 외 공공데이터, Flyway, 화면은 표본 뒤
- [ ] 12.0 Complete 2단계(승인된 것만)
  - [ ] 12.1 Write tests(API 마다, T20): 표본 파일 존재 · 표본 키 집합 ⊆ 적재 필드 집합(스크립트 판정) · place·search 파드에 외부 egress 없음(정책 파일 대조) · 수집 잡 실패 격리
  - [ ] 12.2 **API 별 템플릿 — 이 순서를 지키고 미승인 API 는 건너뛴다(다른 API 의 승인을 기다리지 않는다):**
    1. 승인 확인 — 응답이 `SERVICE_KEY_IS_NOT_REGISTERED` 가 아님(아니면 이 API 는 건너뜀)
    2. 필드 표본 — `implementation/phase2-<API>-sample.json`(키·개인 정보 없이, TG1 정제 게이트 통과) · open-questions 해당 항목 갱신
    3. 적재 — §0 3규칙대로 표본 필드 전부(새 V 마이그레이션 또는 원문 컬럼) · place-ingest CronJob · 하루 호출 수를 CronJob 주석과 대장에, 계정 한도 안(`quota.py`) · 대장(`data-sources.md`) 행 추가 — 없으면 배포 안 함
    4. 노출 — 표본을 본 뒤 open-questions 에서 확정한 화면만 · 출처 표시 없는 원천은 노출하지 않음
  - [ ] 12.3 무장애 여행 `KorWithService2`(15101897) — Q-P2-KORWITH · 속성 패싯에 접근성 속성(긍정 값만, 라벨 정밀도 95% 미만이면 필터 미개방)
  - [ ] 12.4 관광지 집중률 `TatsCnctrRateService`(15128555) — Q-P2-CONGESTION · 상세 「혼잡 예측」
  - [ ] 12.5 연관 관광지 `TarRlteTarService1`(15128560) — Q-P2-RELATED · 상세 「여기 온 사람들이 함께 간 곳」(비슷한 곳과 별개)
  - [ ] 12.6 두루누비 걷기길(15101974) — Q-P2-DURUNUBI · **착수 전 Q-P2-KEY 결정을 ADR-0104 에**
  - [ ] 12.7 고캠핑(15101933) — Q-P2-CAMPING · Q-P2-KEY 선행 · 기존 레포츠 캠핑장과 중복 측정
  - [ ] 12.8 관광사진(15101914) — Q-P2-PHOTO · 공공누리 유형 확인 전 화면 미노출
  - [ ] 12.9 웰니스관광(15144030) — Q-P2-WELLNESS · Q-P2-KEY 선행
  - [ ] 12.10 빅데이터 지역별 방문자수(15101972) — Q-P2-VISITORS · 지역 단위 대응 확인
  - [ ] 12.11 기상청 단기예보(15084084) — Q-P2-WEATHER · 시군구 좌표 → 격자 선수집, 상세는 저장값만
  - [ ] 12.12 기상청 중기예보(15059468) — Q-P2-WEATHER · 예보구역 단위
  - [ ] 12.13 에어코리아 대기오염(15073861) — Q-P2-AIR · 시도별 선수집, 상세는 최근접 측정소
  - [ ] 12.14 반려동물 동반여행(15135102) — Q-P2-PET · 기존 `petRaw` 를 덮지 않는 별개 원천
  - [ ] 12.15 Verify(API 마다): `cd place/ingest && python -m pytest -q tests/phase2_<api>_test.py && python3 scripts/check_sample_fields.py docs/specs/2026-10-02-place-tour-portal-expansion/implementation/phase2-<API>-sample.json`
  - [ ] 12.16 **배포 ④ 뒤 운영 확인(API 마다):** 새 이미지 확인 → 첫 수집 적재 건수 = 응답 건수 − 명시 예외 · 하루 호출 수 = 주석 값 · 화면 절이 있는 API 는 Googlebot UA 표본에 절 마커
**Acceptance Criteria:** 승인된 API 마다 T20 초록 · 표본·대장·ADR(Q-P2-KEY) 기록 · 미승인 API 는 「건너뜀(사유: 미승인)」으로 남김

### Task Group 13: 문서 정리
**Dependencies:** Task Group 11
**Phase:** ③ 마감
**Required Skills:** 문서
- [ ] 13.0 Complete 문서
  - [ ] 13.1 Write checks: 대장 표에 세 오퍼레이션·`place-ingest-tour-sync` 가 있음(grep) · ADR-0104 상태 줄 갱신 · 문서 게이트(`doc_scan.py`) 통과
  - [ ] 13.2 ADR-0104 상태 → 채택 · ADR-0071 §5(행사 칩 · 국문 전용 코스 칩 · 숙박 오버레이 · 키워드 「전체」 행사 합류) · ADR-0103(유형별 본문 · 출처 문구 · 행사 sitemap) · ADR-0076(새 유형 지면 제외)
  - [ ] 13.3 `place/CLAUDE.md`(새 유형 · CronJob · `syncFrom` 보존 규칙) · `search/CLAUDE.md`(`EventSchedule` · `eventStatus` · 행사 sitemap)
  - [ ] 13.4 Verify: `grep -n 'searchFestival2\|place-ingest-tour-sync' docs/architecture/data-sources.md && ./gradlew verifyArchitecture && python3 scripts/doc_scan.py 2>/dev/null | tail -3`
**Acceptance Criteria:** 문서 게이트 통과 · 대장·ADR·서비스 CLAUDE.md 가 코드와 일치

## Execution Order
1. TG1 사전 확인 → TG2 place 저장 → TG3 수집기(표본 반영 뒤 머지) → TG4 CronJob·배포 ①·운영 확인
2. TG5 일정 규칙 → TG6 재색인 → TG7 검색 API ∥ TG8 서버 렌더 본문 → TG9 화면·배포 ②·운영 확인
3. TG10 근처 절 ∥ TG11 만료·행사 sitemap → 배포 ③·운영 확인(TG11.10) → TG13 문서
4. TG12 2단계 — 승인된 API 순서대로 하나씩, 미승인은 건너뜀(맨 끝, 다른 단계를 막지 않는다)
