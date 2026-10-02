# 리뷰 — test-strategy

대상: `spec.md` · `planning/test-quality.md` · `context/open-questions.yml` · ADR-0104
근거 코드: `build.gradle.kts` · `search/app/src/test/.../render/*` · `place/feature/src/test/.../PlaceSchemaIntegrationSpec.kt` · `place/feature/src/main/.../AttractionRepositoryAdapter.kt` · `AttractionGooglePlaceService.kt`

## 체크리스트 판정

| # | 항목 | 판정 |
|---|---|---|
| 1 | 수용 기준마다 테스트가 있나 | 부분 — SR-1 반복정보 우선순위·SR-3 TS 판정 동일성·SR-7 `useSeo` robots 가 비어 있다(R3·R6) |
| 2 | 층 배치 | 대체로 적절. 다만 T4 integration 은 Docker 가 없으면 건너뛴다(R4) |
| 3 | Mock 경계 | 적절. 도메인 판정은 시계만 주입하고 mock 이 없다(test-rules.md:11) |
| 4 | 테스트 데이터 | 부분 — 골든 픽스처에 유형별 사례가 있다는 단언이 없다(R2). T7 픽스처를 얻는 순서가 정해지지 않았다(R7) |
| 5 | 경계·음성 사례 | 행사 상태·만료·KST 자정은 촘촘하다(T1·T2·T3·T14). 반면 「없음」을 확인하는 검사 세 곳에 양성 대조군이 없다(R5) |
| 6 | 이름 규칙 | 통과. `*Test` 접미사, 기존 `AttractionSearchAdapter*Test` 패턴, 파이썬은 `*_test.py`(test-rules.md:17, `place/ingest/tests/quota_test.py`) |

## 이슈

**R1 (차단 아님, 가장 중요) 계약 게이트가 사유를 적은 제외로 필요한 읽기 필드를 통과시킬 수 있다.**
- 스펙 `spec.md:51` 은 새 필드를 「읽기 문서(**또는 읽기 제외 사유**)」에 반영하면 된다고 쓴다.
- 게이트 `build.gradle.kts:576-581` 는 `searchReadOmitted` 에 이유만 적혀 있으면 빠진 읽기 필드를 통과시킨다. 이 게이트가 재는 것은 클래스 본문의 이름 목록이지 읽기 경로가 값을 받는지가 아니다(`build.gradle.kts:563-564`).
- 행사 시작일·종료일과 코스 구성은 렌더·sitemap·필터가 **읽어야 하는** 필드다(SR-3 `spec.md:46`, SR-5, SR-7). 제외 목록에 들어가면 게이트는 초록불이고 값만 조용히 빈다. 지난 작업의 사고와 같은 모양이다.
- 수정안:
  - ① `spec.md:51` 에 「`eventStartDate`·`eventEndDate`·`courseStops` 는 `searchReadOmitted` 에 넣지 않는다」를 명시한다.
  - ② T9 에 왕복 단언을 더한다. **태스클릿이 만든 bulk 문서**(캡처본)를 `AttractionSearchDocument` 로 역직렬화하고 `toDomain()` 까지 통과시킨 뒤 날짜·코스 순서 값을 비교한다. 손으로 만든 문서는 쓰지 않는다.
  - ③ 회귀 주입은 「읽기 클래스에서 필드를 지우고 `searchReadOmitted` 에 사유를 적는다」로 한다. 이때 T9 가 빨간불이어야 한다.

**R2 JSON-LD 동일성 골든이 새 유형을 빠뜨려도 통과한다.**
- 기존 단언은 사례 수뿐이다(`AttractionJsonLdParityTest.kt:68-70`, `cases shouldHaveAtLeastSize 5`). 픽스처에 Event·LodgingBusiness·TouristTrip 사례가 없어도 T12 가 초록불이다.
- 같은 테스트의 `documentOf`(`AttractionJsonLdParityTest.kt:33-50`)는 읽기 경로를 손으로 옮긴 사본이다. 새 필드를 여기 더하지 않으면 그 유형의 서버 입력이 비어 버린다.
- 수정안:
  - T12 에 「골든의 `@type` 집합 ⊇ {Event, LodgingBusiness, TouristTrip}」 단언과 「행사 진행 중·종료 사례가 각각 있다」를 더한다.
  - `documentOf` 는 픽스처 입력 JSON 을 `AttractionSearchDocument` 로 **역직렬화**하는 방식으로 바꾼다. 그러면 R1 의 읽기 경로를 그대로 탄다.
  - 행사 JSON-LD 가 날짜에 따라 달라지면 vitest·Kotlin 양쪽에 같은 고정 시각을 쓴다고 적는다.

**R3 서버 판정과 화면(TS) 판정이 같은지 보는 검사가 없다.**
- SR-3(`spec.md:46`)은 「화면은 같은 규칙의 TS 판정을 쓰고 골든 픽스처로 맞춘다」고 한다.
- SR-7(`spec.md:77`)은 `useSeo` 가 서버와 같은 robots 를 내야 한다고 한다.
- 그런데 test-quality 에는 이 동일성을 보는 행이 없다. T16(`test-quality.md:23`)의 「화면 robots 가 서버와 같음」은 판정 근거가 「렌더 결과」뿐이라, 서버 값을 무엇과 비교하는지 정해져 있지 않다.
- 수정안: 새 행 T12b 를 둔다.
  - Kotlin `EventStatus` 를 실제로 호출해 날짜 격자 골든을 만든다(경계일·KST 자정·주말 요일·월말, 만료 +30/+31 포함). TS 판정과 `useSeo` robots 는 같은 입력으로 그 골든과 비교한다.
  - CI 는 골든을 다시 만든 뒤 `git diff --exit-code` 로 확인한다.
  - ★ 회귀 주입: TS 쪽 경계를 `<`→`<=` 로 바꿔 빨간불을 본다.

**R4 전체 동기화 보존(T4)의 integration 층이 조용히 건너뛰어지고, 쓰기 경로 하나가 빠져 있다.**
- 기존 place 통합 테스트는 Docker 가 없으면 비활성이다(`PlaceSchemaIntegrationSpec.kt:56-57,72`). 이것을 ★ 근거로 삼으면 Docker 없는 실행에서 「통과」로 보인다.
- `upsertAll` 은 `syncFrom` 을 탄다(`AttractionRepositoryAdapter.kt:40`). 반면 `saveAll` 은 `fromDomain` 으로 행 전체를 쓰고(`AttractionRepositoryAdapter.kt:82-83`), 구글 플레이스 보강이 그 경로를 부른다(`AttractionGooglePlaceService.kt:40`).
- 이 때문에 엔티티 `toDomain`/`fromDomain` 매핑에서 새 컬럼이 빠지면, 보강 잡 한 번에 행사 날짜가 지워진다. `spec.md:33` 의 「여섯 곳」 목록도 이 매핑을 명시하지 않는다.
- 수정안:
  - T4 의 ★ 근거는 unit(`AttractionTest.syncFrom`)과 엔티티 왕복 unit(`fromDomain(toDomain(e))` 가 새 세 컬럼을 보존)에 둔다.
  - integration 은 보조로 두고, Docker 가 있는 환경에서 실제로 돌았다는 출력 줄을 증거로 남긴다고 적는다.
  - T4 시나리오에 「`saveAll`(구글 보강) 경로가 새 컬럼을 유지」를 더한다.

**R5 「없음」을 확인하는 검사 셋에 양성 대조군이 없다.** 셋 모두, 출력이 통째로 비거나 대상이 처음부터 입력에 없어도 통과한다.
- T13(`test-quality.md:20`) 「정적 sitemap 에 행사 URL 0」
  - 수정안: 입력 픽스처에 행사 문서가 실제로 들어 있다는 단언을 더한다. 같은 실행에서 숙박·코스·관광 URL 이 1 이상인지도 함께 본다.
- T19(`test-quality.md:26`) 「행사 sitemap 에 그 URL 없음」
  - 수정안: 같은 응답에 진행 중 표본 행사 URL 이 **있다**는 것을 본다. URL 수가 0 보다 크고, 지금 진행 중인 행사의 개요 보유 건수(OpenSearch `_count`)와 맞는지 대조한다.
- T11 「숙박에 예약 URL 이 없음」
  - 수정안: 숙박 픽스처의 `introRaw` 에 예약 URL 키가 **들어 있다**는 전제를 단언한다. 키가 없는 픽스처로는 이 검사가 아무것도 재지 않는다.

**R6 수용 기준 중 테스트가 없는 것.**
- SR-1(`spec.md:28`): 반복정보 잡이 여행코스(25)를 관광 분류와 같은 우선순위로 고른다. T7·T8 어디에도 없다. 코스 구성의 원천이라 빠지면 T8 파서는 빈 입력만 받는다.
  - 수정안: T7 에 「`pick` 이 25 를 관광 분류와 같은 순위로 고른다(함수 반환값)」를 ★ 로 더한다.
- SR-6(`spec.md:73`): 노출 기록 섹션 식별자 셋(`NEARBY_EVENTS` 등). T16 에 「렌더된 절이 그 식별자로 기록 호출」을 더한다.
- SR-4(`spec.md:52`): 필터 범위가 판정 함수와 같은 규칙인지. T10 이 질의 JSON 만 보면 경계 하루 어긋남을 못 잡는다.
  - 수정안: 같은 고정 시계에서 T10 이 만든 범위의 양 끝 날짜를 `EventStatus` 판정에 넣어, 포함·제외가 맞는지 교차 단언한다.

**R7 운영 확인과 픽스처의 순서가 값으로 고정돼 있지 않다.**
- T18(`test-quality.md:25`) 「보강 필드 비공백 건수 전후 동일」은 「전」 값을 **배포 전에** 파일로 남긴다는 절차가 없다. 배포 뒤에는 「전」을 다시 잴 수 없다.
  - 수정안: ① 직전에 쿼리 결과를 `verifications/` 에 저장하고, 배포 뒤 같은 쿼리와 diff 한다고 적는다.
- T7(`test-quality.md:14`)은 「응답 픽스처는 첫 운영 호출 표본에서」라고 한다. 그런데 Q1·Q3(`open-questions.yml:2-16`)도 첫 호출에서 정해진다.
  - 수정안: 표본을 받기 전에는 구현을 머지하지 않는다고 적는다. 그 전에 쓴 합성 픽스처는 표본으로 바꾼 뒤에만 ★ 를 단다.
- T19 의 「Googlebot UA … 캐시 우회」는 잰 응답이 새 이미지에서 나왔는지 확인하는 절차가 없다.
  - 수정안: 응답에 이번에 새로 넣은 표지(유형별 절의 마커 문자열)가 있는지 먼저 본다. 없으면 그 측정은 버린다.

**R8 (경미)** T15(nginx 정확 일치 우선·503)에 ★ 가 없다(`test-quality.md:22`).
- 정규식 sitemap location 이 먼저 잡으면 행사 sitemap 이 정적 파일 404/폴백으로 나간다. 그러면 크롤러가 URL 이 모두 사라졌다고 읽는다(`spec.md:81` 이 막으려는 바로 그 상황이다).
- 수정안: location 순서를 바꾸는 회귀를 주입해 빨간불을 확인하고 ★ 를 단다.

## 잘된 점
- 날짜 검사 전부에 시계 주입을 원칙으로 둔다(`test-quality.md:4`). KST 자정을 UTC 14:59/15:00 두 시각으로 고정한다(T1).
- T10 의 바이트 동일 기준 스냅샷을 「어댑터를 고치기 전 커밋에서」 뜨게 한 것은 자기 출력을 기준으로 삼는 검사를 피한다. 단, 스냅샷 요청은 기존 패싯·랭킹·하이브리드 경로마다 하나씩 두는 것을 권한다.
- T20 이 「표본 키 집합 ⊆ 적재 필드 집합」을 스크립트로 판정한다. LLM 이 읽어서 판정하지 않는다.

## 요약
경계·시계·만료 설계는 촘촘하다. 반면 세 곳이 대상이 아니라 자기 근거를 재는 모양으로 남아 있다.
- 계약 게이트의 사유 기재 제외(R1)
- 사례 수만 세는 골든(R2)
- 양성 대조군 없는 「없음」 검사(R5)

여기에 서버·TS 판정 동일성 검사가 빠져 있다(R3). 모두 test-quality.md 의 행을 고치거나 더하면 되므로 차단할 사안은 아니다.

VERDICT: REVISE

## 반영

근거 확인: `build.gradle.kts:576-581`(사유만 있으면 통과) · `AttractionJsonLdParityTest.kt:33-50`(손 사본 `documentOf`), `:68-70`(사례 수만) · `PlaceSchemaIntegrationSpec.kt:55-58`(Docker 없으면 비활성) · `AttractionRepositoryAdapter.kt:82-83` · `AttractionGooglePlaceService.kt:40`.

| 지적 | 반영 위치 | 내용 |
|---|---|---|
| R1 | spec.md:81(읽기 제외 금지 목록을 게이트에) · :82(캡처 bulk 역직렬화 수용 기준) · test-quality T9(회귀 주입 방식) | |
| R2 | spec.md:102(고정 시각) · test-quality T12(`@type` 집합 단언 · 진행 중·종료 사례 · 역직렬화 입력) | |
| R3 | spec.md:73 · :119 · test-quality T12b | Kotlin 골든 → TS 판정·`useSeo` 비교, 회귀 주입 |
| R4 | spec.md:52 · test-quality T4(unit ★ · 엔티티 왕복 · `saveAll` 경로 · integration 은 보조, 실제 실행 출력 줄을 증거로) | |
| R5 | test-quality 머리말 원칙 · T13(행사 입력 존재 단언 + 다른 유형 ≥ 1) · T19 / spec.md:168(진행 중 URL 있음) · T11(예약 URL 키 존재 전제) | |
| R6 | spec.md:41-43 · test-quality T7b(`pick` 순서) · T16(섹션 식별자 기록) · T10(범위 양 끝 교차 단언) | |
| R7 | spec.md:163(배포 직전 `ops-before.txt`) · :158(표본 전 머지 금지, 합성 픽스처는 표본 교체 뒤 ★) · :166(새 이미지 마커 먼저 확인) · test-quality T18·T19 | |
| R8 | test-quality T15(★ · `=` 제거·순서 이동 회귀 주입) | |
| 잘된 점 메모(스냅샷 경로마다) | spec.md:87 · test-quality T10 | 패싯·랭킹·하이브리드 경로마다 기준 스냅샷 |
