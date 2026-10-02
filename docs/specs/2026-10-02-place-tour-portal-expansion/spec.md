# Specification: place 관광 포털 확장 — 행사·숙박·여행코스 + 공공데이터 2단계

## Goal
place 에 축제·공연·행사, 숙박, 여행코스 세 유형을 더해 「어디를 갈까」에 「언제 무엇이 열리나」「어디서 자나」「어떤 순서로 도나」를 붙인다.
행사는 날짜가 지나면 스스로 낡지 않게 만료 규칙을 조회·렌더 시점에 판정한다. 승인이 필요한 공공데이터(접근성·혼잡·연관·날씨 등)는 같은 틀 위에 2단계로 하나씩 붙인다.

## User Stories
- 여행자로서, 지역 허브와 관광지 상세에서 이번 달·이번 주말에 열리는 행사와 근처 숙소를 거리·기간과 함께 보고 싶다.
- 여행자로서, 검색창에 행사 이름을 치면 그 행사가 나오고, 목록 카드와 모바일 시트에서도 기간과 진행 상태를 보고 싶다.
- 여행자로서, 여행코스 상세에서 코스를 이루는 관광지를 순서대로 보고 각 관광지로 넘어가고 싶다.
- 영문 사용자로서, 영문 허브에서 0건뿐인 칩을 보지 않고 행사 상태를 영어 문구로 보고 싶다.
- 검색 엔진으로서, 끝난 지 오래된 행사 페이지가 색인 후보에서 빠지고 진행 중·예정 행사는 본문과 함께 받고 싶다.
- 운영자로서, 수집 스케줄이 하루 밀려도 「진행 중」 표시가 틀리지 않기를 바란다.

## 유지
관광지 상세 서버 렌더 계약(ADR-0103: 셸 치환·`X-Render` 표지·관광지당 조회 한 번·JSON-LD 서버/클라이언트 동일) · 속성 패싯 ·
지역 집계 · 비슷한 곳 · 키워드 없는 목록 「전체」가 관광 분류(`SIGHT_CATEGORIES`)만 보이는 규칙(ADR-0071 §5) · 지역 드릴다운 건수 정의 ·
기존 수집 잡 6종과 재색인 CronJob(KST 04:30) · deal 혜택 허브(ADR-0069)와의 분리 · `attraction-end` 광고 지면이 꺼져 있는 상태(ADR-0076).

## Specific Requirements

### SR-1 1단계 수집 — 오퍼레이션과 행 정규화 (place-ingest)
- `sync_tour.CONTENT_TYPES` 에 세 유형을 더한다: 행사 ko 15 / en 85 · 숙박 ko 32 / en 80 · 여행코스 ko 25. 표는 언어 키가 없을 수 있는 형태로 바꾼다 — 코스는 영문 서비스에 유형이 없다.
- 행사는 `searchFestival2`, 숙박은 `searchStay2`, 여행코스는 `areaBasedList2`(유형 25)로 받는다. 세 경로 모두 무지정 전국 페이징이다.
- 행 정규화를 목록 호출에서 떼어 `normalize_row(item, lang)` 하나로 만들고 세 오퍼레이션과 기존 `fetch_area_based` 가 함께 쓴다.
  지금 `fetch_area_based` 는 오퍼레이션 이름(`areaBasedList2`)과 `CONTENT_TYPES[type][svc]` 를 박아 두어 그대로는 재사용할 수 없다. 기존 `--job=sync` 의 정규화 결과는 바뀌지 않는다(T7 기존 표본 비교).
- 행사 날짜 `eventstartdate`·`eventenddate`(원천 `yyyyMMdd`)는 수집기가 ISO `yyyy-MM-dd` 로 바꿔 싣는다. 8자리 숫자가 아니거나 달력에 없는 날짜면 그 값만 None 으로 두고 행은 적재한다.
  유형·언어별 「날짜 변환 실패 n건」을 로그에 남긴다. bulk 는 2,000건이 요청 하나라 한 행의 형식 오류가 묶음 전체를 400 으로 떨어뜨리기 때문이다. 원문은 목록 행 원문 컬럼에 남는다.
- `searchFestival2`·`searchStay2`·`areaBasedList2`(코스)의 행 원문 전체를 목록 행 원문 컬럼에 함께 싣는다(§0 ①).
- 좌표 없는 행은 지금처럼 버린다. 이것은 §0 ①「대상 전부」의 명시 예외다 — 도메인 모델이 좌표를 non-null 로 요구하고 지도·근방 검색에 못 쓴다. 버린 건수를 유형·언어별로 로그에 남긴다.
- 행사 조회 시작일 파라미터는 KST 오늘 − 365일이다(진행 중인 장기 행사를 놓치지 않게). 파라미터 의미와 이 창의 규모는 Q1 로 첫 호출에서 확인한다.
- 수용 기준: 유형 없는 옛 행 중 TourAPI 에 실제로 있는 4건(content_id 2775576 · 1891566 · 2948191 · 3112217)이 첫 동기화 뒤 `contentTypeId`·`ldongRegnCd`·`ldongSignguCd` 를 갖는다. 영문 2건이 숙박 목록에 없으면 Q2 결정대로 채운다.

### SR-1b 수집 잡 — 스케줄·실패 격리·보강 우선순위
- 새 CronJob `place-ingest-tour-sync` 가 매일 KST 03:10(UTC 18:10)에 세 유형을 국·영 순서로 받는다. 기존 `_job_sync` 를 거치지 않는 새 잡이다. 재색인 CronJob 에 합치지 않는다 — 재색인은 외부 API 를 부르지 않는 구조다.
- 03:10 은 구글 place_id 보강(KST 03:20, `upsertAll` 과 `saveAll` 사이에 낙관적 잠금이 없다)과 겹치지 않게 고른 자리다. `activeDeadlineSeconds` 540 으로 03:19 전에 끝나는 것을 구조로 보장한다.
  첫 운영 실행의 소요를 `implementation/` 에 남기고, 7분을 넘으면 자리를 다시 고른다. 개요 보강 04:00 · 재색인 04:30 보다 앞이라는 조건도 그대로다.
- 한 유형·한 언어가 실패해도 나머지는 계속 받는다(`sync_pet_tour` 의 실패 격리와 같다).
- 하루 호출 수는 행사 국·영 쪽수(⌈건수/100⌉, −365 창 규모는 Q1) · 숙박 30+3쪽 · 코스 11쪽의 합이다. 잡은 유형·언어별 호출 수 · 적재 건수 · 좌표 제외 · 날짜 변환 실패 건수를 로그에 남긴다.
  행사 창이 국·영 합 60쪽을 넘으면 창을 −180일로 줄이고 그 결정을 ADR-0104 에 덧붙인다.
- 새 행은 기존 보강 잡(개요·이용정보·부가 사진·반복정보)의 대상이 된다. 반복정보 잡(`backfill_media.pick`)은 여행코스(25)를 관광 분류와 같은 우선순위로 고른다 — 코스 구성 순서의 원천이 `detailInfo2` 다.
- 개요·이용정보 보강(`backfill_overview.pick`·이용정보 pick)은 종료되지 않은 행사를 가장 앞에 두고 그 안에서는 시작일 오름차순이다(진행 중·임박 행사가 먼저 온다).
  짧은 행사가 개요 없이(= 색인·sitemap 대상 아님) 끝나는 것을 막기 위해서다. 이 순서는 표시가 아니라 우선순위라 원천 날짜(종료일, 없으면 시작일)와 KST 오늘로만 거른다.

### SR-2 place 저장
- 새 Flyway `V23` 이 `attractions` 에 세 컬럼을 더한다: 행사 시작일·종료일(DATE, 원천 값 그대로)과 목록 행 원문(TEXT). 모두 nullable 이다. 커밋한 V23 은 고치지 않고 다음 변경은 새 V 로 한다.
- 새 컬럼이 지나가는 자리 전부에 함께 넣는다(§0 ③): 도메인 `Attraction`(`create`·`restore`·`syncFrom`) · JPA 엔티티(`fromDomain`·`toDomain`) · bulk 요청 DTO → 도메인 변환 ·
  `UpsertAttractionUseCase` 커맨드 · `GetAttractionUseCase.AttractionView` · `AttractionService` 의 두 매핑(커맨드→도메인, 도메인→View) · 목록 응답 DTO · 파이썬 `UPSERT_FIELDS` · search-batch `PlaceApiClient`(SR-4).
- 수용 기준: `AttractionDtoRoundTripTest` 가 새 세 필드를 포함해 통과한다(적재할 수 있는 필드는 전부 조회로 되읽힌다).
- `syncFrom` 은 들어온 값이 있을 때만 갱신한다 — 행사 날짜를 안 실어 보내는 경로(개요·이용정보·부가 사진·반려동물 왕복)가 값을 지우지 않게.
  그 대가로 원천이 날짜를 지워도 DB 값은 남는다. 의도한 예외다 — 원문 컬럼에는 최신 행이 남아 정정 경로가 있다.
- 구글 보강의 `saveAll` 은 `syncFrom` 을 타지 않고 엔티티 `fromDomain` 으로 행 전체를 쓴다. 엔티티 매핑에서 새 컬럼이 빠지면 보강 한 번에 행사 날짜가 지워지므로 엔티티 왕복과 이 경로를 따로 검사한다(T4).
- 행 삭제·비활성화 경로는 만들지 않는다. 끝난 행사도 행으로 남고 만료는 SR-3·SR-7 이 날짜로 판정한다.

### SR-2b 파생 분류
- 파생 분류 `category` 는 유형 코드가 먼저 정한다: 행사(15·85) → `festival`, 숙박(32·80) → `stay`, 여행코스(25) → `course`. 그 밖의 유형은 지금 규칙 그대로다.
  행사의 신분류 `EV` 가 `culture` 로 접혀 문화시설 목록·지역 건수에 섞이는 것을 막기 위해서다.
- `stay` 는 지금도 다른 유형에서 나온다 — 구 코드가 빈 행은 신분류 `AC` 가 `stay` 로 가서 레포츠(28)의 캠핑장(`AC05`)이 `stay` 가 된다. 이 규칙은 바꾸지 않는다.
  「숙소」의 범위는 `category = stay`(캠핑장 포함)다. 신분류 `AC` 가 원천이 숙박이라고 분류한 것이라 화면에서 같은 묶음으로 보는 것이 맞다. 숙박 원문 키 절(SR-5)과 딥링크 제외(SR-5)만 유형 32·80 기준이다.
- `SIGHT_CATEGORIES` 는 바꾸지 않는다. 지역 드릴다운 건수(ADR-0071)는 그대로 관광 분류만 센다.

### SR-3 행사 일정 규칙 — `EventSchedule` (search:domain)
- 상태는 저장하지 않는다. search:domain 의 객체 하나(`EventSchedule`)가 유효 기간 정규화 · 상태 판정 · 필터 → 날짜 범위 변환을 모두 갖는다. 오늘(KST `LocalDate`)은 호출자가 `Clock` 으로 계산해 넘기고, 이 객체는 시계를 읽지 않는다.
- 유효 기간 정규화(원천 시작일 S · 종료일 E → 유효 시작일 · 유효 종료일): S·E 가 있고 S ≤ E → (S, E) · S 만 → (S, S) · E 만 → (E, E) · S > E → 날짜 없음 · 둘 다 없음 → 날짜 없음.
  파싱 실패는 수집기가 이미 None 으로 바꿔 둔다(SR-1). S > E 와 날짜 없음은 재색인 완료 로그에 건수로 남긴다(Q4).
- 상태: 날짜 없음 → `UNKNOWN` · 유효 시작일 > 오늘 → `UPCOMING` · 유효 시작일 ≤ 오늘 ≤ 유효 종료일 → `ONGOING` · 유효 종료일 < 오늘 → `ENDED`. 날짜 비교라 시작일·종료일 당일은 진행 중이다.
- `UNKNOWN` 행사는 모든 행사 필터·근처 행사·행사 sitemap 에서 빠진다. 상세는 200 으로 기간·상태 문구 없이 그리고 noindex 는 개요 규칙만 따른다.
- 필터 → 범위(문서는 유효 기간 [s, e]): `ONGOING` e ≥ 오늘 ∧ s ≤ 오늘 · `UPCOMING` s > 오늘 · `NOT_ENDED` e ≥ 오늘 ·
  `WEEKEND` 기간이 [max(오늘, 이번 주 토), 이번 주 일]과 겹침(주는 월~일, 오늘 포함, 일요일이면 그날 하루, 월~금이면 토·일 둘) · `THIS_MONTH` 기간이 [오늘, KST 이번 달 말일]과 겹침.
- 정렬 `eventStart`: 유효 시작일 오름차순, 같으면 id 오름차순. `NOT_ENDED`·`THIS_MONTH` 결과에서 진행 중 행사는 시작일이 오늘 이하라 예정 행사보다 자연히 먼저 온다 — 「진행 중 먼저」를 따로 구현하지 않는다.
- 수용 기준: 날짜 격자 픽스처(월말을 걸친 2주 × 요일 7종 × KST 자정 전후 × S/E 조합 — 같은 날·S 만·E 만·S>E·없음)에서 모든 필터 f 에 대해
  「범위(f)에 드는 문서 ⇔ 상태 조건(f)」이 성립한다(`ONGOING`⇔ONGOING · `UPCOMING`⇔UPCOMING · `NOT_ENDED`⇔ONGOING∪UPCOMING · `WEEKEND`·`THIS_MONTH` 결과에 ENDED·UNKNOWN 없음).
- 화면은 같은 규칙의 TS 함수를 쓴다. Kotlin 이 만든 날짜 격자 골든을 TS 판정·`useSeo` robots 가 같은 입력으로 비교한다(T12b).

### SR-4 색인 — 재색인
- 재색인이 `EventSchedule` 로 정규화한 유효 시작일·유효 종료일을 `date` 필드 둘(`eventStartEffective`·`eventEndEffective`)로 싣는다. 원천 날짜는 place 컬럼에 그대로 있다(§0 ②). 범위 질의는 이 두 필드만 본다.
- search-batch `PlaceApiClient.AttractionDto` 와 `fetchPageAfter` 의 손 매핑에 행사 시작일·종료일·목록 행 원문을 더한다 — 매핑을 빼먹으면 기본값 null 이 조용히 이긴다(2026-09-04 썸네일 사고). `PlaceApiClientTest` 에 「응답 JSON 의 날짜가 DTO 에 실린다」를 더한다.
- 여행코스는 `infoRaw` 를 순수 함수로 풀어 코스 구성(순서 · 원천 contentId · 이름 · 같은 언어 관광지 id)을 색인하지 않는 객체 `courseStops` 로 싣는다. 해석 실패는 그 필드만 비우고 경고 건수를 남긴다.
- 코스 순서는 `subnum` 의 수 값 오름차순이다(문자열 정렬 금지 — 10 이 2 앞에 오지 않는다). id 가 매칭되지 않는 구성 지점은 이름만 싣고 링크하지 않는다.
- id 매칭: 1차 투영(`RegionProjection`)에 contentId 와 유효 시작일·유효 종료일을 더하고(종료 행사를 후보에서 거르는 근거) 1차 훑기가 `(lang, contentId) → id` 지도를 만든다. 2차 훑기가 이 지도로 매칭하며 추가 조회는 없다(6만 건 × 문자열 하나, 수 MB 로 배치 힙 약 256MB 안). 완료 로그에 「코스 매칭 실패 n건」을 남긴다.
- 새 필드는 매핑 · 쓰기 문서 · 읽기 문서에 모두 반영해 `verifySearchIndexContract` 를 통과한다. `eventStartEffective`·`eventEndEffective`·`courseStops` 는 읽기 제외(`searchReadOmitted`)에 넣을 수 없다 — 게이트에 금지 목록을 두어 사유를 적어도 실패하게 한다.
- 수용 기준: 태스클릿이 만든 bulk 문서(캡처본)를 `AttractionSearchDocument` 로 역직렬화하고 `toDomain()` 까지 통과시킨 값이 날짜·코스 순서와 같다(T9). 손으로 만든 문서는 쓰지 않는다.

### SR-4b 검색 API·목록 화면
- 검색 API 에 `eventStatus` 필터를 더한다: `ONGOING` · `WEEKEND` · `UPCOMING` · `THIS_MONTH` · `NOT_ENDED`. 그 밖의 값은 무시한다. `SearchAttractionService` 가 `Clock` 으로 KST 오늘을 계산하고 `EventSchedule` 의 범위를 `SearchQuery` 에 넣는다. 어댑터는 시계를 읽지 않는다.
- `eventStatus` 조건은 「행사가 아니거나 범위 안」으로 건다 — 행사가 아닌 문서는 이 필터의 영향을 받지 않는다. `sort=eventStart` 를 더한다(SR-3 정의).
- `eventStatus`·`sort=eventStart` 가 없는 요청의 결과·순서는 지금과 같다 — 자동완성은 예외(아래 줄)다(요청 JSON 이 바이트 동일, 기존 패싯·랭킹·하이브리드 경로마다 기준 스냅샷).
- 목록 분류 칩에 「행사」를 더하고 국문(`/`)에만 「여행코스」를 더한다 — `/en` 은 코스가 0건이라 칩을 그리지 않는다. 「행사」를 고르면 상태 칩(진행 중 · 이번 주말 · 예정)이 나오고 기본은 `NOT_ENDED`, 정렬은 `eventStart` 다.
- 숙박은 목록 칩이 아니라 지도 오버레이 토글(음식·쇼핑과 같은 자리)에 더한다. 키워드 없는 「전체」는 지금처럼 관광 분류만이다.
- 키워드가 있는 「전체」는 관광 분류에 `festival` 을 더하고 `eventStatus=NOT_ENDED` 를 보낸다 — 「보령 머드축제」를 친 사용자가 0건을 받지 않게. 자동완성은 항상 「행사가 아니거나 `NOT_ENDED`」 조건을 건다.
- 허브 목록 카드(`PlaceCard`)와 상세 본문(`AttractionDetailBody`, 데스크톱 열·모바일 바텀시트 공용)에 행사 기간과 상태 문구(SR-5 와 같은 TS 판정·문구)를 그린다.
- 정적 sitemap 수집(`fetchSidoSlice`)은 시도 조각이 10,000건 창을 넘으면 경고가 아니라 빌드 실패로 알린다. 새 유형으로 넘는 조각은 유형별로 한 번 더 쪼갠다.

### SR-5 상세 — 유형별 본문 (서버 렌더 + 화면)
- ADR-0103 서버 렌더 경로를 그대로 쓰고 유형별 본문 절을 더한다. 관광지당 OpenSearch 조회는 한 번 그대로다.
  `AttractionPageService` 가 `Clock` 으로 KST 오늘을 계산해 렌더 포트(`AttractionPageRenderPort.attractionPage`)에 인자로 넘긴다. 렌더러는 시계를 갖지 않는다.
- 행사: 기간 · 장소 · 상태 문구와 `introRaw` 의 행사 원문 키(행사 장소 · 공연 시간 · 이용 요금 · 주최). JSON-LD `Event`(startDate · endDate · location).
  상태 문구는 국문 「진행 중」「D-n 시작」「종료된 행사」, 영문 「Ongoing」「Starts in n days」(n=1 이면 「Starts tomorrow」)「Ended」다. `UNKNOWN` 은 문구가 없다. 서버·화면이 같은 문자열을 쓴다(T11·T12 골든).
- 숙박(32·80): `introRaw` 의 숙박 원문 키(입실 · 퇴실 · 객실 수 · 객실 유형 · 주차 · 부대시설)를 허용 목록으로만 그린다. 예약 URL · 예약 안내 키는 그리지 않는다. JSON-LD `LodgingBusiness`.
  숙박은 `TOUR_PRODUCT` 딥링크(마이리얼트립·Klook 검색)를 내지 않는다 — `AttractionDeepLinks.of` 가 유형을 받아 제외한다. 제휴 승인 때 스펙 변경 없이 숙박 제휴 링크가 되는 경로를 막는다.
- 여행코스: 코스 구성을 순서 목록으로 그리고 매칭된 지점은 관광지 상세로 링크한다. `introRaw` 의 총 거리 · 소요 시간. JSON-LD `TouristTrip` + `itinerary`(ItemList, 순서 보존).
- 서버가 심는 JSON-LD 는 클라이언트(`copy.mjs`)가 그리는 것과 같은 내용이다. 유형별 골든 픽스처를 vitest 가 실제 함수로 만들고 Kotlin 이 같은 입력으로 비교한다. 행사 JSON-LD 는 양쪽이 같은 고정 시각을 쓴다.
- 서버 렌더 본문 끝에 출처 문구를 새로 넣는다: 「출처: 한국관광공사 TourAPI」 / 「Source: Korea Tourism Organization TourAPI」. 지금은 화면에만 있고 서버 렌더 본문·바닥글에는 없다.
- 새 유형(행사·숙박·코스)의 상세에는 `attraction-end` 광고 지면을 그리지 않는다. 지면을 다시 켜는 재심사 뒤에도 유지한다 — 원천 개요를 그대로 쓰는 페이지가 반려 사유였다(ADR-0076).
- 상태 문구는 렌더 시점의 KST 오늘로 계산한다. 서버 렌더 응답은 지금처럼 `no-cache` 다. 유형 이름 표(`CONTENT_TYPE_KO`·`CONTENT_TYPE_EN`)는 이미 15/25/32 · 85/80 을 가져 새 표를 만들지 않는다.

### SR-6 근처 행사·숙소 · 지역 허브 · 기존 절의 종료 행사
- 지역 허브(`/regions/{code}`)에 「이번 달 행사」를 더한다: 그 지역 `eventStatus=THIS_MONTH` · `sort=eventStart` · 최대 8건 · 기간 표시. 화면이 조회 시점에 그리고 지역 프리렌더 본문에는 넣지 않는다(빌드 사이에 낡는다).
- 관광지 상세에 「근처 행사」(반경 20km · `NOT_ENDED` · `sort=eventStart` · 최대 6건, 거리·기간)를 더한다.
- 「근처 숙소」는 기존 「주변 편의시설」 캐로셀의 숙박 몫을 옮긴 것이다 — `AMENITY_CATEGORIES` 에서 `stay` 를 빼고 「근처 숙소」(반경 5km · 거리순 · 최대 6건)가 그 자리를 갖는다. 한 화면에 같은 숙소 카드가 두 번 뜨지 않는다.
- 두 절은 「주변 명소」 절처럼 화면이 검색 API 로 그린다. 서버 렌더 본문에는 넣지 않는다(관광지당 조회 한 번 규칙). 자기 자신은 빼고, 결과가 0 이면 절을 그리지 않는다(영문 숙박 211건이라 대부분 0건이 정상).
- 새 절의 노출 기록 섹션 식별자는 `NEARBY_EVENTS` · `NEARBY_STAYS`, 지역 허브는 `REGION_EVENTS_THIS_MONTH` 다.
- 행사 문서의 「같은 분류 가까운 곳」·지역 문구 건수·「비슷한 곳」에서 종료 행사를 뺀다. 재색인이 재색인일(KST) 기준 `ENDED`·`UNKNOWN` 행사를 후보와 건수에서 빼고,
  가까운 곳·비슷한 곳 항목에 유효 종료일을 실어 렌더·화면이 그 뒤 끝난 항목을 오늘 기준으로 한 번 더 거른다.
  항목 하위 필드는 다섯 자리에 함께 넣는다: `RegionAggregator`(가까운 곳 항목) · `SimilarPlace` · `AttractionIndexDocument`(쓰기) · `AttractionSearchDocument`(읽기) · `SearchAttractionUseCase` 결과. 계약 게이트는 최상위 키만 보므로 하위 필드는 T9 왕복이 지킨다. 지역 문구 건수는 재색인일 기준이라 최대 하루 차이를 허용한다(상태 표시가 아니라 집계다).

### SR-7 행사 만료 — noindex · 정적 sitemap
- 종료된 행사 페이지는 200 이고 「종료된 행사」를 표시한다. 종료일 + 30일까지는 색인 대상이다.
- robots 규칙: `noindex = 개요 없음 OR (행사 ∧ 유효 종료일 + 31일 ≤ 오늘(KST))`. 서버 렌더가 `noindex, follow` 를 붙인다.
- 정본은 서버 렌더다. 클라이언트 `useSeo` 도 같은 판정으로 같은 robots 를 낸다(하이드레이션이 서버 값을 뒤집지 않게, T12b).
- 정적 sitemap(portal-fe 빌드 시점 생성)에서 행사 문서를 뺀다. 빌드 사이에 낡기 때문이다.
- 숙박(유형 32·80 기준, `category=stay` 가 아님 — 레포츠 캠핑장 등 기존 행의 등재 조건은 그대로)은 개요와 대표 사진이 둘 다 있을 때만 정적 sitemap 에 싣는다 — 본문이 개요와 입·퇴실 원문 키뿐인 얇은 페이지를 색인 후보로 밀지 않는다. 여행코스는 다른 유형처럼 개요가 있으면 싣는다.

### SR-7b 행사 sitemap — 동적 경로 계약
- 행사 URL 은 동적 sitemap `sitemap-places-events.xml` 이 갖는다. place sitemap 인덱스가 이 파일을 함께 가리킨다.
  상세 0건 빌드(인덱스 대신 urlset 하나를 내는 분기)는 행사 파일을 가리키지 않는다 — 상세 URL 이 전부 빠진 실패 빌드라 행사만 살릴 이유가 없다.
- 레이어(ADR-0083): render 컨트롤러 패키지의 엔드포인트 `/internal/render/sitemap/events.xml` → `RenderEventSitemapUseCase`(인터페이스) → 서비스가 `Clock` 으로 오늘을 계산하고 범위를 정한다 →
  `AttractionSearchPort` 의 행사 조회 메서드(범위를 받는다) → infrastructure 어댑터. XML 생성은 렌더 포트 뒤 infrastructure 렌더러가 하고, 실패 → 503 매핑은 presentation 에 둔다.
- 싣는 조건: 행사 ∧ 개요 있음 ∧ 상태 ≠ `UNKNOWN` ∧ 유효 종료일 + 30일 ≥ 오늘. id 는 숫자만, `lastmod` 는 색인의 원천 수정일을 W3C 날짜(`YYYY-MM-DD`)로 바꾼 값이고 없으면 생략한다.
- 조회가 실패하면 search 가 503 을 낸다(빈 200 을 내면 크롤러가 URL 이 모두 사라졌다고 읽는다). URL 수·생성 시간을 로그에 남긴다. 메모리 캐시는 두지 않는다 — 요청당 OpenSearch 조회 한 번이고 아래 캐시 헤더가 반복을 줄인다.
- nginx 계약(정확 일치 location `= /sitemap-places-events.xml`, 정규식 sitemap location 보다 먼저 잡힌다): ① place 호스트가 아니면 404 ② upstream 경로는 고정 문자열 `/internal/render/sitemap/events.xml`(`$request_uri`·쿼리 미전달)
  ③ `Cookie`·`Authorization` 헤더 제거 ④ `proxy_intercept_errors` 없음 · `error_page` 없음 · SPA 폴백 없음 — 503 은 그대로 나간다 ⑤ `Cache-Control: public, max-age=300, must-revalidate` 명시 + `X-Robots-Tag $host_robots_tag`.
- 기존 상세 렌더 location 을 베끼지 않는다. 그쪽은 5xx 를 SPA 셸 200 으로 바꾸는 폴백(`@attraction_shell`)을 갖고 있어 sitemap 자리에 HTML 200 이 나간다.
- 프록시는 기존 렌더 프록시와 같은 search 서비스·네트워크 정책 19·20 을 쓴다. `/internal/**` 은 지금처럼 공개 라우트에 없다.

### SR-8 2단계 — 활용신청 승인 뒤 붙이는 공공데이터
- 대상: 무장애 여행 `KorWithService2`(15101897) · 관광지 집중률 `TatsCnctrRateService`(15128555) · 연관 관광지 `TarRlteTarService1`(15128560) · 두루누비 걷기길(15101974) · 고캠핑(15101933) · 관광사진(15101914) · 웰니스관광(15144030) · 빅데이터 지역별 방문자수(15101972) · 기상청 단기예보(15084084)·중기예보(15059468) · 에어코리아 대기오염(15073861) · 반려동물 동반여행(15135102).
- 지금 상태는 `SERVICE_KEY_IS_NOT_REGISTERED` 다. API 마다 승인 순서대로 독립 배포하고, 다른 API 의 승인을 기다리지 않는다.
- 승인 뒤 첫 호출로 응답 필드 표본을 `implementation/phase2-<API>-sample.json` 에 남긴다(키·개인 정보 없이). 그 표본의 필드를 §0 3규칙대로 전부 적재하고, 화면 구성은 표본을 본 뒤 open-questions 에서 확정한다.
- 수집은 place-ingest CronJob 이 하고 요청 경로에서는 외부 API 를 부르지 않는다. 날씨는 시군구 좌표를 기상청 격자로 변환해 시군구 단위로 선수집하고 상세는 저장된 값만 읽는다.
- 쓰임 방향(필드 확인 전 기본안): 무장애 → 기존 속성 패싯에 접근성 속성 합류 · 집중률 → 상세 「혼잡 예측」 · 연관 관광지 → 상세 「여기 온 사람들이 함께 간 곳」(비슷한 곳과 별개 절) · 걷기길·캠핑 → 새 콘텐츠 유형 · 관광사진 → 사진 보강 · 날씨·대기 → 상세 날씨 · 반려동물 동반여행 → 기존 pet-tour(`KorService2/detailPetTour2`)와 별개 원천.
- 잡마다 하루 호출 수를 CronJob 주석과 대장에 적고, 그 값이 해당 오퍼레이션의 계정 한도 안이어야 한다(운영 계정 키 · `quota.py` 관측).
- 관광사진은 공공누리 유형을 확인하기 전에는 화면에 내지 않는다(Q-P2-PHOTO). 출처 표시가 없는 원천은 노출하지 않는다.
- 새 원천의 자연키가 TourAPI contentId 와 겹칠 수 있는 것(걷기길 · 캠핑 · 웰니스)은 착수 전에 원천 구분을 정한다(Q-P2-KEY).

### SR-9 출처·대장·네트워크·문서
- `docs/architecture/data-sources.md` §1 표·§2 에 세 오퍼레이션(`searchFestival2` · `searchStay2` · `areaBasedList2` 유형 25)과 새 CronJob, 좌표 제외 예외(SR-1)를 더한다. 2단계는 승인된 API 마다 출처 · 라이선스 · 키 · 받는 방법 · 하루 호출 수를 더한다. 대장에 없으면 배포하지 않는다.
- 대장의 TourAPI 라이선스 칸에 행 단위 공공누리 유형(`cpyrhtDivCd`)을 적는다 — 행사 원문에는 주최측 이미지·문구가 섞인다. 유형이 다른 원천은 그 유형의 문구를 화면·서버 렌더 본문에 따로 단다.
- 외부 :443 은 지금처럼 place-ingest 파드만 연다(`11-allow-egress-https-public.yaml` 라벨 허용 — 새 정책 없음, 주석의 place-ingest 설명만 갱신). 새 원천이 다른 파드의 egress 를 요구하면 그 API 는 이 스펙에서 붙이지 않는다.
- 용어 등재(구현 전, `/hns:glossary`): 행사 상태(`ONGOING`·`UPCOMING`·`ENDED`·`UNKNOWN`) · 유효 시작일·유효 종료일 · 행사 필터(`eventStatus` 값 다섯) · 이번 주말 · 이번 달 · 만료 noindex · 코스 구성 · 근처 행사 · 근처 숙소 · 분류 `festival`·`course`.
  자리는 관광지 용어가 이미 있는 `search/glossary.md` §3-1 이다. 반경 검색 절의 표기는 사전·코드와 같은 「주변 명소」로 쓴다.
- 문서: ADR-0104 · ADR-0071 §5 에 새 분류 자리(행사 칩, 국문 전용 코스 칩, 숙박 오버레이, 키워드 「전체」의 행사 합류) · ADR-0103 에 유형별 본문·출처 문구·행사 sitemap · ADR-0076 에 새 유형 지면 제외 · `place/CLAUDE.md` · `search/CLAUDE.md`.

### SR-10 배포 순서·롤백
- ① content(JVM, place 폴드 호스트) V23 + 분류 규칙 → place-ingest 이미지 + `place-ingest-tour-sync` → 첫 수집. JVM 이 먼저 나간다.
- ② search-batch(매핑·재색인) → search(검색 필터 · 서버 렌더 유형별 본문) → portal-fe(칩·상세·지역 허브). 이 단계부터 정적 sitemap 은 행사를 싣지 않는다.
  `search/domain` 만 바뀐 커밋은 이미지 토폴로지상 `search` 만 다시 굽는다(`scripts/ci/topology.sh` — `search/*` → search, search-batch 는 `search/batch/*` 일 때만). 그런 커밋은 `images.yml` 을 `services=search-batch` 로 수동 실행해 재색인이 옛 바이트코드로 돌지 않게 한다.
- ③ 근처 행사·숙소 → 행사 sitemap 프록시 + noindex 만료 규칙. ④ 2단계 API — 승인된 순서대로 하나씩 같은 방식(표본 → 적재 → 색인 → 화면)으로.
- 머지 조건: 첫 운영 호출 표본(Q1·Q3)을 `implementation/` 에 받기 전에는 수집 코드를 머지하지 않는다. 그 전의 합성 픽스처로 짠 검사는 표본으로 바꾼 뒤에만 「회귀 주입 확인」을 단다.
- 롤백: 수집 잡 `place-ingest-tour-sync` 를 먼저 suspend 한다(옛 bulk DTO 가 모르는 필드를 받지 않게). 그다음 이미지를 되돌린다.
  V23 은 nullable 컬럼 추가뿐이라 옛 content 이미지로 되돌려도 Flyway `validate` 가 통과한다. 옛 bulk 가 모르는 필드를 무시하는지 거부하는지는 ① 직전에 확인해 `implementation/` 에 적는다.

### SR-10b 운영 확인
- ① 직전에 기존 보강 필드 비공백 건수 쿼리(키셋)의 결과를 `verifications/ops-before.txt` 로 남긴다. 배포 뒤 같은 쿼리 결과와 diff 한다 — 배포 뒤에는 「전」을 다시 잴 수 없다.
- ① 확인: 유형별 적재 건수 = 호출 totalCount − 좌표 제외(유형·언어별 로그 값), SR-1 의 4건, 위 diff 가 줄지 않음.
- ② 확인: 재색인 소요 시간을 직전 회차와 비교해 기한 30분 안인지, 완료 로그의 새 필드 적재 건수 · 코스 매칭 실패 · S>E · 날짜 없음 건수.
- 운영 응답을 재기 전에 그 응답이 새 이미지에서 나왔는지 먼저 본다 — 이번에 새로 넣은 유형별 절 마커 문자열이 응답에 없으면 그 측정은 버린다.
- 단계마다: Googlebot UA 로 행사·숙박·코스 표본 상세를 받아 `X-Render: ssr` 과 유형별 절을 본다. 필터 건수 = OpenSearch `_count`.
- ③ 확인: 종료 31일이 지난 표본 행사에서 `noindex`. 행사 sitemap 에 그 URL 이 없고, 같은 응답에 진행 중 표본 행사 URL 은 있다(URL 수 > 0, 개요 있는 비종료 행사 `_count` 와 대조).
- ③ 확인: apex·blog 호스트의 `/sitemap-places-events.xml` 이 404 다.

## Existing Code to Leverage
- 수집: `place/ingest/src/sync_tour.py`(`CONTENT_TYPES` · `fetch_area_based` · `_ldong` · `categorize` · `tour_get` · `parse_modified`) · `main.py`(`_job_sync`) · `sync_pet_tour.py`(언어별 실패 격리 · 전체 동기화 왕복) · `backfill_intro.py`(`DERIVED`) · `backfill_media.py`(`pick` 우선순위 · `infoRaw`) · `backfill_overview.py`(`UPSERT_FIELDS` · `pick`) · `place_client.py`(`bulk_upsert`) · `quota.py`
- CronJob: `k8s/base/place-ingest/cronjob-pet-tour.yaml`(목록형 잡 견본) · `cronjob-google-places.yaml`(KST 03:20) · `kustomization.yaml` · `k8s/base/search-batch/cronjob-attraction-reindex.yaml`(KST 04:30) · `k8s/base/network-policy/11-allow-egress-https-public.yaml` · `19-allow-portal-fe-to-search-render.yaml` · `20-allow-search-shell-fetch.yaml`
- place: `place/domain/.../attraction/model/Attraction.kt`(`create`·`restore`·`syncFrom` · `SIGHT_CATEGORIES`) · `AttractionDeepLink.kt`(`AttractionDeepLinks.of`) · `AttractionJpaEntity.kt` · `AttractionDtos.kt` · `UpsertAttractionUseCase.kt` · `GetAttractionUseCase.kt` · `AttractionService.kt` · `AttractionLinkService.kt` · `AttractionRepositoryAdapter`(`upsertAll` · `saveAll`) · `AttractionDtoRoundTripTest` · `placedb/migration/V22__create_attraction_similar.sql`(최신 V)
- 색인: `search/batch/.../AttractionApiReindexTasklet.kt`(키셋 두 번 훑기 · `RegionProjection` · `readIntro`) · `search/batch/.../client/PlaceApiClient.kt` · `AttractionIndexDocument.kt` · `attractions-index.json` · `search/domain/.../RegionAggregator.kt` · 루트 `build.gradle.kts` `searchIndexContracts`·`searchReadOmitted`
- 검색·렌더: `SearchAttractionUseCase.kt`(속성 필터 파라미터 견본) · `SearchAttractionService.kt`(`Clock` · `ClosedToday.todayKst`) · `AttractionPageService.kt` · `AttractionPagePorts.kt` · `AttractionPageController.kt` · `AttractionSearchAdapter.kt` · `AttractionPageRenderer.kt`(`attractionPage` · `metaTags` noindex · `contentTypeLabel`) · `search/domain/.../AttractionDocument.kt`
- 화면·SEO: `portal-fe/src/pages/place/PlacePage.tsx`(분류 칩 · 오버레이 · `PlaceCard` · `AttractionDetailBody`) · `AttractionPage.tsx` · `RegionPage.tsx` · `placeAttributes.ts`(`CONTENT_TYPE_KO/EN`) · `src/api/placeApi.ts`(`AMENITY_CATEGORIES` · `suggestPlaces`) · `scripts/prerender-seo.mjs`(`indexDoc` · `fetchSidoSlice` · `writePlaceSitemaps`) · `src/seo/copy.mjs` · `portal-fe/nginx.conf`(sitemap · 렌더 프록시 location)
- 배포: `scripts/ci/topology.sh` · `.github/workflows/images.yml`(`workflow_dispatch` `services`)
- 규칙: `docs/architecture/data-sources.md` §0·§1·§2 · ADR-0062 §8·§13 · ADR-0065 · ADR-0071 §5·§9 · ADR-0076 · ADR-0103 · `search/glossary.md` §3-1

## Out of Scope
- 유형 없는 옛 행 53건(TourAPI 에 없는 옛 시드)의 삭제 — 사용자 확인 대기(Q-LEGACY)
- 숙박 예약·제휴 링크와 가격 · 기존 5개 유형 목록 동기화의 정기 실행 · 통합 검색 색인(ADR-0090)의 행사 상태 반영 · Cloudflare 캐시 규칙
- 원천에서 사라진 행사의 비활성화(만료는 날짜로만 판정)

## Open Questions
`context/open-questions.yml` — pre-impl: Q1 행사 조회 시작일 의미와 −365 창 규모 · Q2 영문 옛 숙박 2건의 채움 경로 · Q3 `searchStay2` 목록 필드 · Q4 날짜 없음·S>E·E 만 있는 행사 건수 ·
Q5 숙박 상세의 수집형 「방문 후기」 · 2단계 API 12종의 필드 표본·화면(Q-P2-*) · Q-P2-KEY 새 원천 자연키. 범위 밖: Q-LEGACY 옛 행 53건.
