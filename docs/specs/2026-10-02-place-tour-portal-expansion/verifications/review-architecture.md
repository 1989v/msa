# Architecture Review — place 관광 포털 확장 (ADR-0104)

- 대상: `spec.md`, `docs/adr/ADR-0104-place-tour-portal-expansion.md`, `context/open-questions.yml`
- 기준: ADR-0083 레이어 표준, 폴드 구조, place↔search 경계, 요청 경로 외부 호출 금지, OCI 무료 단일 노드

## 통과한 항목

| 체크 | 판정 | 근거 |
|---|---|---|
| place↔search 경계 | 통과 | 새 필드가 place 목록 응답 DTO(spec.md SR-2:33)를 거쳐 재색인 API 경로(`AttractionApiReindexTasklet.kt:36`)로 간다. DB 공유나 교차 참조는 없다 |
| 요청 경로 외부 호출 | 통과 | 수집은 place-ingest CronJob 이 한다(SR-1:25, SR-8:88). 날씨·대기도 미리 받아 둔 값을 읽는다. sitemap·근처 목록은 자체 OpenSearch 조회만 한다(SR-6:71, SR-7:80) |
| egress | 통과 | 외부 :443 은 지금처럼 place-ingest 파드에만 열려 있다(SR-9:97, ADR-0104 결정 3). search-batch 에 egress 를 여는 대안은 기각됐다(ADR-0104:47) |
| 상태를 저장하지 않음 | 통과 | 날짜만 저장하고 시계를 주입받는 search:domain 순수 함수로 판정한다(SR-3:46). `ClosedToday.kt:11-22` 과 같은 방식이다 |
| 폴드·파드 | 통과 | 새 `:app`·새 파드가 없다. CronJob 하나와 nginx location 하나만 더한다(ADR-0104:54-57) |
| 단일 노드 스케줄 | 통과 | KST 03:40(UTC 18:40)은 google-places 03:20(`cronjob-google-places.yaml:24`)과 개요 04:00(`cronjob-overview.yaml:22`) 사이다. 새 행이 같은 날 개요와 04:30 재색인(`cronjob-attraction-reindex.yaml:19`)을 탄다. 하루 약 50콜이다 |
| 순환·상향 의존 | 통과 | ingest(py) → place bulk → search 재색인 순서로 한 방향만 흐른다. 배포도 JVM 이 먼저 나간다(SR-10:101) |
| syncFrom 보존 규칙 | 통과 | 행사 날짜를 `?:` 로 보존하는 방식은 `Attraction.kt:331-358` 의 보강 필드 관례와 같다 |
| Deletion Test | 통과 | 코스 구성 파서는 순수 함수다. 쓰는 곳은 재색인 하나지만 수 값 정렬이라는 규칙을 갖고 있어 통과 쪽이다. 행사 판정 함수는 네 곳이 부른다 |

## 수정 필요 (REVISE)

### R1. 「판정 함수는 하나」가 검색 필터에는 그대로 맞지 않는다 — 상태 → 날짜 범위 함수를 같은 객체에 둔다
- 근거: spec.md SR-3:46 은 「검색 필터·서버 렌더·만료 규칙·행사 sitemap 이 모두 그것을 부른다」고 쓴다. 그런데 SR-4:52 는 필터를 「날짜 범위 질의로 바꾼다」고 한다. 문서 하나에서 상태를 내는 함수(`status(start, end, today)`)는 질의를 만들 수 없고, 반대 방향인 `window(status, today) → (start/end 범위)` 가 필요하다. 두 함수가 따로 있으면 경계일(당일·일요일·말일)에서 서로 어긋날 수 있다.
- 수정안: search:domain 의 `EventSchedule` 같은 객체 하나에 `status(...)` 와 `window(status, today)` 를 함께 둔다. 「window 로 고른 문서에 status 를 다시 매기면 그 상태가 나온다」를 골든 픽스처로 묶는 도메인 테스트를 SR-3 에 적는다. 스펙 문구는 「판정 규칙은 한 객체에」로 고친다.

### R2. 종료일이 없는 행사가 범위 질의에서 빠진다 — 재색인이 유효 종료일을 싣게 한다
- 근거: SR-3:43 은 「종료일이 없으면 시작일을 종료일로 본다」고 하지만, SR-4:49 는 재색인이 시작일·종료일을 그대로 `date` 필드로 싣는다고만 한다. 종료일 필드가 비어 있으면 `endDate ≥ today` 범위 질의가 그 문서를 놓친다. 그래서 오늘 하루 열리는 행사가 「진행 중」 필터와 행사 sitemap(SR-7:80)에서 빠진다. 이 결과는 서버 렌더의 판정과 갈린다.
- 수정안: 원천 종료일은 place 컬럼에 그대로 두고(§0 ②), 색인에는 R1 의 도메인 함수로 정규화한 `eventEndEffective` 를 싣는다. 아니면 어댑터 질의가 `missing(end) AND start 범위` 를 함께 거는 방식을 SR-4 에 명시한다. 앞의 방식이 더 단순하다.

### R3. 새 경로 둘의 레이어 배치가 스펙에 없다 (ADR-0083)
- 근거:
  - 행사 sitemap(SR-7:79-81)은 컨트롤러·UseCase·포트 중 무엇을 더하는지 쓰지 않았다. 기존 렌더는 `AttractionPageController.kt:18-20` → `RenderAttractionPageUseCase` → `AttractionPagePorts.kt:15` 순서다.
  - 렌더 시점의 오늘: `AttractionPageRenderPort.attractionPage(shell, doc)`(`AttractionPagePorts.kt:16`)는 날짜를 받지 않는다. 그래서 상태 문구와 noindex(SR-5:64, SR-7:76)를 infrastructure 렌더러가 직접 시계를 읽어 계산하게 될 위험이 있다. 기존 방식은 application 서비스가 `Clock` 을 갖고 오늘을 계산해 넘기는 것이다(`SearchAttractionService.kt:37`, `:126`).
- 수정안: SR-7 에 `RenderEventSitemapUseCase`(인터페이스) + `AttractionSearchPort` 의 행사 조회 메서드(R1 의 window 를 받는다) + 같은 render 컨트롤러 패키지의 엔드포인트를 적는다. 실패하면 503 을 내는 매핑은 presentation 에 둔다. SR-5 에는 `AttractionPageService` 가 `Clock` 을 주입받아 `EventStatus`·noindex 여부를 계산하고 렌더 포트에 넘긴다고 적는다. 렌더러는 시계를 갖지 않는다. 검색 필터도 같은 방식으로 서비스가 window 를 계산해 `SearchQuery` 에 넣는다. 어댑터는 시계를 읽지 않는다.

### R4. 코스 구성 id 매칭이 재색인 기한 안에 드는지 확인할 항목이 없다
- 근거: SR-4:49 는 「같은 언어 관광지 id」를 싣는다. 재색인은 이미 두 번 훑는 구조이고 기한 30분 압박이 적혀 있다(`AttractionApiReindexTasklet.kt:36-44`). 여기에 새 행 약 4,600건(ADR-0104:55)이 더해진다.
- 수정안: 첫 번째 훑기에서 `(contentId, lang) → id` 지도를 모으고 두 번째 훑기에서 매칭한다고 SR-4 에 적는다. 추가 조회는 없다. SR-10 ② 운영 확인에 재색인 소요 시간의 전후 비교를 한 줄 더한다.

## 판정 메모
BLOCK 사유는 없다. 결정(ADR-0104)과 기존 코드·표준이 정면으로 충돌하는 곳은 없다. R1·R2 는 같은 규칙이 필터와 렌더에서 갈리는 정합성 문제이고, R3·R4 는 구현 전에 스펙에 적어 둘 배치와 비용이다.

VERDICT: REVISE

## 반영

근거는 모두 wt3 코드에서 직접 확인했다(`AttractionPagePorts.kt:16` 날짜 인자 없음 · `SearchAttractionService.kt:37,126` Clock · `AttractionApiReindexTasklet.kt:317-328` 투영에 contentId 없음).

| 지적 | 반영 위치 | 내용 |
|---|---|---|
| R1 | spec.md:63, :68-69, :71-73 · ADR-0104 결정 2 | `EventSchedule` 한 객체에 정규화·상태·필터→범위. 날짜 격자 픽스처로 「범위 ⇔ 상태」 동치(test-quality T2b) |
| R2 | spec.md:64-65, :76 | 재색인이 유효 시작일·유효 종료일을 싣는다. 원천 날짜는 place 컬럼에 그대로 |
| R3 | spec.md:96(렌더 포트에 오늘 인자) · :85(검색 서비스가 범위 계산, 어댑터는 시계 없음) · :126-127(행사 sitemap UseCase·포트·어댑터·503 매핑 배치) | 제안 그대로 |
| R4 | spec.md:80(1차 투영에 contentId, 추가 조회 없음) · :165(재색인 소요 전후) | 제안 그대로 |
