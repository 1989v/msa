측정 시각: 2026-10-08 04:34:44 KST | 도구: git 2.50.1 (Apple Git-155), Python 3.14.6 | 표본: origin/main 코드·스키마 60개 고유 파일(핵심 인용 38개 + Flyway 32개, 중복 제외), 운영 레코드 0건 | 명령: `git ls-tree -r origin/main --name-only | rg ...`; `git show origin/main:<path> | nl -ba`; `git grep -n <pattern> origin/main -- place search portal-fe`

# S1-11 — 관광지 신뢰 표시 데이터 매핑

## 조사 기준과 결론

- 분석 기준: `origin/main`의 **a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24**. 로컬 main·작업 파일을 코드 근거로 사용하지 않았다. 아래 인용은 이 커밋에 고정된 파일 경로와 줄 번호다.
- **확정 정책:** 출처는 `attractions.source`, 원천 갱신일은 `attractions.source_modified_at` → 검색 `modifiedAt`을 사용한다. 없는 날짜를 `created_at`, `updated_at`, 다른 정보의 수집 시각으로 대신하지 않는다.
- 전체 관광지의 마지막 수집일과 사람 검수일은 **없음 — 신설 필요**. 현재 수집 시각은 정보 종류별로만 있다.
- **권고:** JSON-LD `WebPage.dateModified`는 페이지 콘텐츠 수정일로 정의한다. 현재 그 시각을 기록하는 필드가 없으므로 생략한다. 원천 수정일은 화면의 「원천 갱신일」로 별도 표시한다.
- 사실은 코드로 확인한 계약·쓰기 경로다. 아래 화면 문구·null 처리·JSON-LD 선택은 제안 정책이며, 실제 배포·데이터 분포를 확인한 결과가 아니다.
- 외부 HTTP 요청 0건, 브라우저 실행 0회. 운영 DB·kubectl·ssh·사내 도구 접근, Git 변경 작업을 수행하지 않았다. 공개 서비스의 실제 값·null 비율은 **미확인**.

## 1. attractions 본표: 날짜·출처 관련 필드 전수

`Attraction`과 JPA 엔티티에는 `updatedAt`이 없지만 DDL에는 `updated_at`이 있다. `modified_time`, 일반 `synced_at`, `collected_at`, `reviewed_at`은 본표에 없다. 날짜 타입 외에 `rest_date`는 쉬는날 안내 문자열이므로 감사 시각이 아니다. [A][A][J][J][V3][V3][V11][V11]

| 실제 컬럼 / 도메인 필드 | nullable | 의미 | 누가 언제 쓰는가 / 동기화 영향 | 근거 |
|---|---|---|---|---|
| `attractions.source` / `source` | NOT NULL, 기본 TOURAPI | 기본 관광지 레코드 원천 식별자, 자연키 일부 | TourAPI 요청은 source 생략 → JVM이 TOURAPI 적용. 고캠핑 수집기는 GOCAMPING 지정. 기존 레코드의 source는 불변이며 자연키로 매칭 | [A][A][V32][V32][SVC][SVC][REPO][REPO][GC][GC] |
| `source_created_at` / `sourceCreatedAt` | NULL | 원천 레코드 생성 시각 | Python 목록 `createdtime` 변환 → DTO → JVM create → JPA. `syncFrom`은 null을 포함해 원천 값으로 덮음 | [V8][V8][TOUR][TOUR][SVC][SVC][AS][AS] |
| `source_modified_at` / `sourceModifiedAt` | NULL | 기본 원천 레코드 수정 시각 | Python 목록 `modifiedtime` 변환, 고캠핑은 날짜 형식만 수용. JVM bulk upsert → `syncFrom`에서 null 포함 덮음. 보강 왕복은 기존 날짜를 전달 | [V3][V3][TOUR][TOUR][GC][GC][OV][OV][AS][AS] |
| `created_at` / `createdAt` | NOT NULL | 우리 관광지 레코드 최초 생성 시각 | 도메인 생성 기본값 `LocalDateTime.now()`, JPA가 이를 저장. DDL도 DEFAULT CURRENT_TIMESTAMP. 기존 행 upsert는 restore된 시각 보존, 엔티티 `updatable=false`. 원천 생성일·최근 수집일 아님 | [A][A][J][J][V3][V3][REPO][REPO] |
| `updated_at` / 도메인 없음 | NOT NULL | DB 행 마지막 변경 시각 | DB의 DEFAULT / ON UPDATE CURRENT_TIMESTAMP. 실제 행 변경에 반응; 같은 값을 다시 수집한 사실을 반드시 기록하지 않음. 부분 보강·파생 컬럼 수정도 영향을 줄 수 있으므로 원천 갱신일·수집일로 금지 | [V3][V3][J][J][GOOGLE][GOOGLE] |
| `intro_synced_at` / `introSyncedAt` | NULL | 이용정보 detailIntro2 수신 시각 | Python이 호출 결과 처리 후 `datetime.now()` 기록. 빈 정상 응답에도 수신 사실 기록. bulk 경유, `syncFrom`은 새 값 없으면 보존 | [V11][V11][INTRO][INTRO][AS][AS] |
| `pet_synced_at` / `petSyncedAt` | NULL | 해당 관광지의 반려동물 정보 수집 시각 | Python이 detailPetTour2 목록에서 레코드에 매칭된 경우 기록. 목록 미매칭·언어 실패에는 기록 안 함. bulk 경유, null이면 기존 값 보존 | [V14][V14][PET][PET][AS][AS] |
| `extra_synced_at` / `extraSyncedAt` | NULL | 부가 사진·반복정보 수집 묶음 시각 | Python이 detailImage2 및 조건부 detailInfo2 처리 후 기록. contentTypeId 없으면 반복정보 호출은 생략되며, 이 경우에도 묶음 시각 기록. null이면 기존 값 보존 | [V17][V17][MEDIA][MEDIA][AS][AS] |
| `event_start_date`, `event_end_date` / `eventStartDate`, `eventEndDate` | NULL | 행사 개최 기간 | 목록 원천 날짜 적재. bulk 보강 왕복에 안 실리면 기존 값 유지. 행사 기간이므로 갱신일·수집일로 사용 금지 | [A][A][V23][V23][AS][AS] |
| `copyright_div_cd` / `copyrightDivCd` | NULL | 이미지 저작권 구분 코드 | TourAPI cpyrhtDivCd를 목록 수집기가 적재; 일반 source와 다른 개념. 이미지 제공자 명칭·검수일을 뜻하지 않음 | [V8][V8][TOUR][TOUR][AS][AS] |
| `list_raw`, `intro_raw`, `pet_raw`, `images_raw`, `info_raw` | NULL | 원천 응답 보관 | 각 수집기가 남기는 원문. 원문 안 시간 키가 있더라도 본표 정규 날짜 계약으로 임의 승격하거나 다른 정보의 날짜 대용으로 쓰지 않음 | [A][A][TOUR][TOUR][INTRO][INTRO][MEDIA][MEDIA][PET][PET] |

### 쓰기 경로 구분

전체 동기화는 Python → bulk DTO → `AttractionService.toDomain()` → `AttractionRepositoryAdapter.upsertAll()` → 기존 객체 `syncFrom(incoming)` → JPA saveAll이다. `sourceCreatedAt`, `sourceModifiedAt`은 null을 포함해 덮어쓰지만, 개요·이용정보·반려동물·부가 사진과 그 수집 시각은 보강 데이터로 보존한다. 본표에 「이번 목록 수집 성공 시각」을 매번 기록하는 경로는 없다. 보강 작업은 부분 데이터처럼 보이더라도 다수 경로가 bulk 전체 동기화를 사용하며, `UPSERT_FIELDS`에 기존 원천 날짜를 되실어 날짜 소실을 막는다. [SVC][SVC][REPO][REPO][AS][AS][OV][OV][INTRO][INTRO][MEDIA][MEDIA][PET][PET]

실제 부분 수정 예는 Google place ID 보강이다. 기존 객체의 `enrichGooglePlaceId()` 후 saveAll하며, source 수정 시각이나 별도 검수 시각을 생성하지 않는다. DB `updated_at`이 변경될 수 있는 이유지만 관광지 원천 갱신 증거는 아니다. [AS][AS][GOOGLE][GOOGLE]

## 2. TourAPI 시간 적재와 JVM 역할

| 원천 필드 | Python 변환 / 요청 키 | 저장 컬럼 | 결과 |
|---|---|---|---|
| TourAPI `createdtime` | `normalize_row` → `parse_modified` → `sourceCreatedAt` | `attractions.source_created_at` | 적재됨; search 날짜 필드로는 전달 안 됨 |
| TourAPI `modifiedtime` | 같은 함수 → `sourceModifiedAt` | `attractions.source_modified_at` | 적재됨; search `modifiedAt`으로 전달 |
| 무장애 목록 `modifiedtime` | barrier_free `listModifiedAt` | `attraction_barrier_free.list_modified_at` | 해당 부가 정보의 목록 수정일이며 기본 관광지 수정일과 별개 |
| 고캠핑 `modifiedtime` | `yyyy-MM-dd`에만 `T00:00:00` 추가 → `sourceModifiedAt` | 새 GOCAMPING 관광지의 `attractions.source_modified_at` | 원천 날짜만 있는 값에 시각을 붙인 변환. 화면에는 날짜만 표시해야 함 |

근거: [TOUR][TOUR][SVC][SVC][DTO][DTO][BF][BF][V25][V25][GC][GC]. TourAPI의 `parse_modified`는 빈 값·8자리 미만은 None, 그 외 14자리까지 0으로 채워 문자열을 만든다. 달력 유효성·정확한 시간 정밀도 검증은 하지 않으며 JVM LocalDateTime 역직렬화에서 형식 오류가 발생할 수 있다. 따라서 저장 성공한 값의 의미는 원천 필드이고, 짧은 입력에서 만들어진 00:00:00은 정확한 원천 시각으로 주장하지 않는다. [TOUR][TOUR]

**JVM 확인 범위:** origin/main의 place Kotlin에서 `createdtime`, `modifiedtime`, TourAPI 서비스명·HTTP 수집기를 검색한 결과, 기본 관광지 시간을 직접 TourAPI에서 읽는 JVM 수집 구현은 찾지 못했다. 확인된 JVM 역할은 Python이 보낸 정규 필드를 받아 도메인·DB로 저장하는 것이다. Google/외부 링크 JVM 서비스도 수집 결과 반영·큐 조회 역할이라고 명시한다. [SVC][SVC][GOOGLE][GOOGLE][LINK][LINK] 기본 관광지 JVM 직접 수집 경로는 **미확인(현재 검색 범위에서 발견 없음)**이며, 구현이 있다고 가정하지 않는다.

### 별도 테이블의 날짜를 혼용하면 안 되는 이유

| 테이블.필드 | 쓰기 주체·시점 | 신뢰 표시에서의 취급 |
|---|---|---|
| `attraction_overview_probes.checked_at` | JVM probe 생성 기본 now; 원천이 빈 개요를 주었다는 자동 확인 기록 | 사람 검수일 아님. 긍정적인 개요 수집 완료일도 아님 [V4][V4][PROBE][PROBE] |
| `attraction_links.source`, `published_at`, `collected_at` | 링크 결과의 source·원천 게시일 및 JVM 결과 반영 now | YOUTUBE/NAVER_BLOG 콘텐츠 단위 출처·날짜. 관광지 기본 날짜로 승격 금지 [V5][V5][LINK][LINK] |
| `attraction_link_requests.source`, `requested_at`, `last_attempt_at`, `next_attempt_at` | 링크 큐 요청·결과 상태 갱신 | 요청·시도·다음 실행 예약 시각. 검수·데이터 갱신일 아님 [V5][V5][LINK][LINK] |
| `attraction_barrier_free.list_modified_at`, `detail_synced_at` | Python 원천 modifiedtime / 상세 수신 now → JVM 적용; 목록 갱신은 기존 상세 시각 보존 | 「무장애 목록 원천 갱신일」「무장애 정보 수집일」로만 사용 [BF][BF][V25][V25][EXTRA][EXTRA] |
| `attraction_wellness.synced_at` | JVM 언어별 목록 교체 시 LocalDateTime.now() | 웰니스 정보 반영 시각. 전체 관광지 수집 시각 아님 [V25][V25][EXTRA][EXTRA] |
| `gocamping_site.source_modified_at` | DDL·JPA에는 있지만 Python site_rows와 JVM domain/fromDomain 전달에 없음; 엔티티 기본 null | **컬럼 존재 ≠ 적재됨**. 현재 쓰기 경로로 채워지지 않으므로 기본 날짜 근거로 사용 금지 [V32][V32][GC][GC][GCS][GCS][GCJ][GCJ] |
| `gocamping_site.synced_at` | Python plan 실행 now → JVM 전달·저장 | 고캠핑 원천 표 수집 묶음 시각. matching된 TourAPI 기본 레코드 수정일을 바꾸지 않음 [GC][GC][GCS][GCS][GCJ][GCJ] |

스키마 전체 검색에서 보이는 `attraction_embedding.created_at`, `attraction_similar.created_at`, `attraction_category_codes.created_at/synced_at`, `attraction_congestion.first_ymd/last_ymd/fetched_at`, `attraction_related.fetched_at`도 임베딩·관계·분류표·예측·연관정보에 국한된다. 이들은 기본 관광지의 원천 수정일·전체 수집일·사람 검수일 후보가 아니다. 아래 스키마 전수 목록에 경로·줄을 남겼다. 날씨·대기·지역 방문 통계의 관측·수신 날짜도 같은 이유로 제외한다.

## 3. place → search → SSR 전달 실태

1. place 응답 DTO에는 `source`, `sourceCreatedAt`, `sourceModifiedAt`, `introSyncedAt`, `petSyncedAt`, `extraSyncedAt`이 있다. `createdAt`, DB `updated_at`은 이 응답의 필드가 아니다. [DTO][DTO]
2. search-batch의 PlaceApiClient 관광지 DTO는 `sourceModifiedAt`만 받아, 재색인 시 `modifiedAt = attraction.sourceModifiedAt`으로 설정한다. `source`, 원천 생성일, 각 수집 시각은 전달하지 않는다. **재색인 시간과 modifiedAt은 다른 값이다.** [CLIENT][CLIENT][BATCH][BATCH]
3. 색인 문서·매핑에서 기본 감사 날짜는 nullable `modifiedAt` 하나이며 형식은 `yyyy-MM-dd'T'HH:mm:ss`다. 날짜 필드로 행사 유효 시작/종료일, 혼잡 예측 date도 있지만 각각 개최·예측 날짜다. `indexedAt`, `reviewedAt`, `pageModifiedAt`은 없다. search-app도 같은 nullable modifiedAt을 받아 도메인에 그대로 전달한다. [IDX][IDX][MAP][MAP][SEARCH][SEARCH][SDOMAIN][SDOMAIN]
4. SSR 주 JSON-LD는 TouristAttraction / Event / LodgingBusiness / TouristTrip으로 분기한다. 공통 필드에는 name, description, url, inLanguage, isPartOf, image 등이 있고 **dateModified를 넣지 않는다**. modifiedAt을 사용해 대신 기록하는 코드도 이 renderer에는 없다. [RENDER][RENDER]
5. SSR 및 FE 출처 문자열은 기본적으로 「출처: 한국관광공사 TourAPI」를 고정 출력하며 부가 정보가 존재하면 출처명을 추가한다. **GOCAMPING 기본 원천을 source 기반으로 선택할 수 없는 전달 공백**이 있다. camping 객체의 유무는 부가 정보 존재 여부이지 기본 source와 동치가 아니다. [RSOURCE][RSOURCE][FSOURCE][FSOURCE][SEARCH][SEARCH]
6. 참고로 빌드 prerender sitemap은 `a.modifiedAt`을 lastmod로 쓰지만, 그 사실이 날짜를 웹페이지 수정일로 바꾸지는 않는다. 이 작업에서는 sitemap 정책 수정이나 운영 sitemap 실측을 하지 않았다. [PRERENDER][PRERENDER]

## 4. 표시 매핑 확정안

아래는 구현할 계약이다. 「현재 전달 없음」을 날짜가 null인 레코드와 구분한다. DB에 있어도 search/SSR로 전달되지 않는 값은 공급 경로 확장 전 표시할 수 없다. 화면과 SSR은 동일한 라벨·값·null 정책을 사용한다.

| 표시 항목 | 실제 원천 필드 / 문서 필드 | 의미 | null·누락 처리 | 화면·SSR 표현 문구 / 현재 가능 여부 |
|---|---|---|---|---|
| 출처 | `attractions.source`; search 문서 필드 **없음** | 기본 데이터 원천 | 값 미전달·미지원이면 「출처: 정보 없음」. TourAPI로 자동 추정 금지 | TOURAPI → 「출처: 한국관광공사 TourAPI」; GOCAMPING → 「출처: 한국관광공사 고캠핑」. source 전달 신설 필요 [A][A][CLIENT][CLIENT][SEARCH][SEARCH] |
| 원천 갱신일 | TourAPI/고캠핑 modifiedtime → `attractions.source_modified_at` → search `modifiedAt` | 기본 원천 레코드 수정 | 「원천 갱신일: 정보 없음」. 원천 생성일·DB 변경일·다른 수집일 대체 금지 | 「원천 갱신일: YYYY-MM-DD」. 날짜값 전달은 현재 가능; label/render 추가 필요 [TOUR][TOUR][GC][GC][BATCH][BATCH][SEARCH][SEARCH] |
| 원천 생성일(선택) | `attractions.source_created_at`; search 없음 | 원천 레코드 생성 | 항목 생략 | 「원천 등록일: YYYY-MM-DD」. 검색 전달 추가 필요. 갱신일 대체 금지 [V8][V8][CLIENT][CLIENT] |
| 수집일(관광지 전체) | **없음 — 신설 필요**; 목록/전체 수집 시각도 없음 | 정의된 기본 레코드 수집 성공 시각 | 신설 전 「수집일: 정보 없음」 | generic 수집일을 created_at·updated_at·MAX(정보별 수집일)로 계산하지 않음 [A][A][V3][V3][CLIENT][CLIENT] |
| 이용정보 수집일 | `attractions.intro_synced_at`; search 없음 | detailIntro2 수신(정상 빈 응답 포함) | 해당 세부 날짜 항목 생략 | 「이용정보 수집일: YYYY-MM-DD」. 검색 전달 추가 필요 [V11][V11][INTRO][INTRO][CLIENT][CLIENT] |
| 반려동물 정보 수집일 | `attractions.pet_synced_at`; search 없음 | 매칭된 detailPetTour2 정보 수집 | 항목 생략 | 「반려동물 정보 수집일: YYYY-MM-DD」. 검색 전달 추가 필요 [V14][V14][PET][PET][CLIENT][CLIENT] |
| 사진·반복정보 수집일 | `attractions.extra_synced_at`; search 없음 | 보강 묶음 수신. 반복정보 미호출 가능 | 항목 생략 | 「사진·부가정보 수집일: YYYY-MM-DD」. 모든 세부 정보가 수집됐다는 표현 금지 [V17][V17][MEDIA][MEDIA] |
| 무장애 정보 수집일 / 고캠핑 정보 수집일(선택) | `attraction_barrier_free.detail_synced_at` / `gocamping_site.synced_at`; search 날짜 필드 없음 | 각 부가 원천 수신·수집 묶음 | 항목 생략 | 「무장애 정보 수집일: …」「고캠핑 정보 수집일: …」. 해당 메타데이터 전달 추가 필요 [V25][V25][V32][V32][SEARCH][SEARCH] |
| 검수일 | **없음 — 신설 필요** | 사람이 정해진 범위를 검수한 실제 시각 | 현재 일반 화면 항목 생략. 관리 명세에는 「없음 — 신설 필요」 | 향후 「검수일: YYYY-MM-DD」. probe checked_at·자동 수집·LLM 파생·DB 변경일을 검수일로 사용 금지 [A][A][PROBE][PROBE] |
| DB 최초 등록 / DB 변경 시각(운영 메타) | `created_at` / `updated_at`; search 없음 | 로컬 저장·행 변경 | 일반 신뢰 슬롯 생략 | 필요 시 운영 설명에만 「서비스 최초 등록」「DB 변경」. 수집·검수로 이름 변경 금지 [V3][V3][J][J] |
| 재색인 시각(운영 메타) | 관광지 문서의 독립 필드 **없음** | 읽기 모델 재생성 | 일반 신뢰 슬롯 생략 | `modifiedAt`을 「재색인일」로 부르지 않음 [BATCH][BATCH][IDX][IDX] |
| JSON-LD dateModified | **웹페이지 콘텐츠 수정일 필드 없음 — 신설 필요** | WebPage(CreativeWork) 변경 | property 생략; null·빈 문자열·오늘 날짜 출력 금지 | 새로운 pageModifiedAt 계약과 기록 경로가 생긴 뒤 WebPage 노드에만 출력 [RENDER][RENDER] |

**날짜 표현 정책:** 우선 YYYY-MM-DD로 표시한다. 저장 타입 DATETIME/LocalDateTime과 Python naive datetime.now는 자체적으로 시간대를 담지 않는다. 코드만으로 모든 저장값의 실제 KST/UTC가 일관됨을 확정할 수 없어 **미확인**이다. 관측용 freshness 코드가 intro 시각을 UTC로 해석하는 사실도 있다. 따라서 근거 없이 기존 문자열에 `Z` 또는 `+09:00`을 덧붙이거나 시간까지 KST로 표시하지 않는다. 고캠핑의 보정된 자정은 원천 날짜 정밀도로 취급한다. 날짜 경계 변환이 필요한 값은 원천·실행 환경의 시간대를 확인한 후 표시한다. [J][J][INTRO][INTRO][GC][GC][MAP][MAP][FRESH][FRESH]

**합성 원천 정책:** 무장애·웰니스·고캠핑·연관관광 정보는 각각 해당 절의 출처를 덧붙일 수 있다. 한 절의 수정일/수집일을 관광지 전체 날짜로 합치지 않는다. 여러 값의 최대값으로 「최신 정보」 또는 검수 완료를 주장하지 않는다.

## 5. JSON-LD dateModified 결정 근거

**권고 결정은 웹페이지 콘텐츠 수정일이다.** schema.org의 [dateModified](https://schema.org/dateModified)는 CreativeWork의 최근 수정일을 뜻하며 Date/DateTime을 사용한다는 정의를 전제로 한다. 이 관광지 상세에서 창작물은 관광지 자체가 아니라 그것을 설명하는 WebPage이므로, dateModified는 별도 WebPage 노드에 두고 페이지가 제공하는 콘텐츠의 실제 수정 시각을 가리키게 한다. 현재 `modifiedAt`은 기본 원천 레코드 수정일일 뿐이며 이용정보·사진·관련 링크·파생 설명의 변경을 모두 대표하지 않는다. 이를 웹페이지 수정일로 대신 쓰면 서로 다른 의미를 합치므로 금지한다. TouristAttraction·Event·LodgingBusiness의 현행 노드에 날짜를 무조건 추가하지 않고, 원천 갱신일은 화면 신뢰 표시로 유지한다. WebPage 콘텐츠 변경을 추적할 필드·기록 경로를 만들기 전에는 dateModified를 생략한다. 단순 재색인·매 요청 렌더 시각·배포 시각·사람 검수 시각 역시 콘텐츠 수정 근거 없이 대체하지 않는다. **schema.org 원문 재조회는 미확인:** 사용자 허용 URL이 place.1989v.com·api.1989v.com·sitemap으로 제한되어 외부 정의 페이지에 요청하지 않았다. 위 정의의 적용은 권고 판단이며 최신 원문 확인 완료로 주장하지 않는다.

## 6. 확인하지 못한 것과 구현 경계

- 운영 배포가 분석 커밋과 같은지, 실제 레코드 값·null 비율·고캠핑 source 분포·검색 색인 반영 여부: **미확인**.
- 원천 시간대·ingest 실행 환경 시간대·DB 세션 시간대 일치, 실제 시간 필드 입력 형식 분포: **미확인**.
- schema.org 최신 원문·실제 페이지 구조화 데이터 검증 도구 결과: **미확인**, 허용 사이트 제한으로 조회하지 않음.
- 코드 변경은 하지 않았다. 필요한 변경은 source/세부 수집 시각 전달, generic 수집 시각·검수 시각·페이지 콘텐츠 수정 시각의 별도 계약 신설이며, 기존 날짜를 대체값으로 사용하지 않는 것이 선행 조건이다.
- 이 산출물은 코드 읽기 문서다. 빌드·테스트·공개 API 조회는 수행하지 않았다. 파일 인용 범위·커밋·문서 필수 항목을 정적으로 검증한다.

## 7. origin/main 근거 파일·줄 번호

각 링크는 로컬 파일이 아닌 분석 커밋에 고정했다. 재현: `git show origin/main:<path> | nl -ba`. 아래에는 별도 관련 테이블의 스키마 날짜 필드 전수도 덧붙인다.

- **A**: `place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt:12–82`
- **AS**: `place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt:321–420`
- **J**: `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/AttractionJpaEntity.kt:91–180`
- **V3**: `place/feature/src/main/resources/placedb/migration/V3__create_attractions.sql:3–27`
- **V8**: `place/feature/src/main/resources/placedb/migration/V8__add_attraction_source_fields.sql:9–22`
- **V11**: `place/feature/src/main/resources/placedb/migration/V11__add_attraction_intro.sql:13–24`
- **V14**: `place/feature/src/main/resources/placedb/migration/V14__add_attraction_pet.sql:7–11`
- **V17**: `place/feature/src/main/resources/placedb/migration/V17__add_attraction_media.sql:14–18`
- **V23**: `place/feature/src/main/resources/placedb/migration/V23__add_attraction_event_dates_and_list_raw.sql:7–10`
- **V32**: `place/feature/src/main/resources/placedb/migration/V32__attraction_source_and_gocamping.sql:6–28`
- **SVC**: `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionService.kt:50–97`
- **REPO**: `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapter.kt:20–45`
- **DTO**: `place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt:133–241`
- **TOUR**: `place/ingest/src/sync_tour.py:219–283`
- **OV**: `place/ingest/src/backfill_overview.py:31–44`
- **INTRO**: `place/ingest/src/backfill_intro.py:77–96`
- **MEDIA**: `place/ingest/src/backfill_media.py:52–76`
- **PET**: `place/ingest/src/sync_pet_tour.py:71–87`
- **GC**: `place/ingest/src/gocamping.py:106–156`
- **GCJ**: `place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/GocampingSiteJpaEntity.kt:28–56`
- **GCS**: `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/GocampingService.kt:22–34`
- **GOOGLE**: `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionGooglePlaceService.kt:11–40`
- **CLIENT**: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt:39–80`
- **BATCH**: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt:284–316`
- **IDX**: `search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/AttractionIndexDocument.kt:20–86`
- **MAP**: `search/batch/src/main/resources/opensearch/attractions-index.json:470–473`
- **SEARCH**: `search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocument.kt:30–107`
- **SDOMAIN**: `search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionDocument.kt:9–85`
- **RENDER**: `search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt:222–325`
- **RSOURCE**: `search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt:609–619`
- **FSOURCE**: `portal-fe/src/pages/place/placeAttributes.ts:174–184`
- **FRESH**: `place/feature/src/main/kotlin/com/kgd/place/infrastructure/config/PlaceIngestConfig.kt:13–22`
- **V4**: `place/feature/src/main/resources/placedb/migration/V4__create_attraction_overview_probes.sql:12–19`
- **PROBE**: `place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/AttractionOverviewProbe.kt:13–29`
- **V5**: `place/feature/src/main/resources/placedb/migration/V5__create_attraction_links.sql:8–43`
- **LINK**: `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionLinkService.kt:82–112`
- **V25**: `place/feature/src/main/resources/placedb/migration/V25__create_attraction_barrier_free_and_wellness.sql:7–30`
- **BF**: `place/ingest/src/barrier_free.py:93–109`
- **EXTRA**: `place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionExtrasService.kt:43–101`
- **PRERENDER**: `portal-fe/scripts/prerender-seo.mjs:795–803`

### 관련 스키마의 추가 날짜 필드

- [`place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql:16`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql#L16): `embedded_at    DATETIME     NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql:17`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V12__create_attraction_embedding.sql#L17): `created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V13__create_attraction_category_code.sql:17`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V13__create_attraction_category_code.sql#L17): `synced_at   DATETIME     NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V13__create_attraction_category_code.sql:18`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V13__create_attraction_category_code.sql#L18): `created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V1__create_regions.sql:16`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V1__create_regions.sql#L16): `created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V22__create_attraction_similar.sql:14`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V22__create_attraction_similar.sql#L14): `computed_at   DATETIME     NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V22__create_attraction_similar.sql:15`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V22__create_attraction_similar.sql#L15): `created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V26__create_region_visitor_daily.sql:10`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V26__create_region_visitor_daily.sql#L10): `base_ymd      DATE           NOT NULL COMMENT '원천 baseYmd',`
- [`place/feature/src/main/resources/placedb/migration/V26__create_region_visitor_daily.sql:18`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V26__create_region_visitor_daily.sql#L18): `synced_at     DATETIME       NOT NULL COMMENT '마지막으로 받은 시각',`
- [`place/feature/src/main/resources/placedb/migration/V27__create_weather.sql:16`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V27__create_weather.sql#L16): `synced_at    DATETIME    NOT NULL COMMENT '마지막으로 받은 시각',`
- [`place/feature/src/main/resources/placedb/migration/V27__create_weather.sql:26`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V27__create_weather.sql#L26): `base_at    DATETIME NOT NULL COMMENT '원천 baseDate+baseTime (KST)',`
- [`place/feature/src/main/resources/placedb/migration/V27__create_weather.sql:28`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V27__create_weather.sql#L28): `fetched_at DATETIME NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V27__create_weather.sql:42`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V27__create_weather.sql#L42): `tm_fc      DATETIME   NOT NULL COMMENT '원천 발표 시각 tmFc (KST)',`
- [`place/feature/src/main/resources/placedb/migration/V27__create_weather.sql:44`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V27__create_weather.sql#L44): `fetched_at DATETIME   NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql:15`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql#L15): `first_ymd     DATE         NOT NULL COMMENT '파생: 가장 이른 예측일',`
- [`place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql:16`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql#L16): `last_ymd      DATE         NOT NULL COMMENT '파생: 가장 늦은 예측일',`
- [`place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql:19`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V28__create_attraction_congestion.sql#L19): `fetched_at    DATETIME     NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V29__create_attraction_related.sql:17`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V29__create_attraction_related.sql#L17): `fetched_at    DATETIME     NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V2__create_pois.sql:18`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V2__create_pois.sql#L18): `created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql:13`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql#L13): `synced_at    DATETIME    NOT NULL COMMENT '마지막으로 받은 시각',`
- [`place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql:20`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql#L20): `data_time    DATETIME    NULL     COMMENT '파생: 원천 dataTime (KST, 24:00 은 다음 날 00:00). 측정 없음이면 NULL',`
- [`place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql:22`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql#L22): `fetched_at   DATETIME    NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql:34`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V30__create_air_quality.sql#L34): `synced_at    DATETIME    NOT NULL,`
- [`place/feature/src/main/resources/placedb/migration/V6__create_admin_regions.sql:15`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V6__create_admin_regions.sql#L15): `created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,`
- [`place/feature/src/main/resources/placedb/migration/V6__create_admin_regions.sql:16`](https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V6__create_admin_regions.sql#L16): `updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,`

[A]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt#L12-L82
[AS]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/Attraction.kt#L321-L420
[J]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/AttractionJpaEntity.kt#L91-L180
[V3]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V3__create_attractions.sql#L3-L27
[V8]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V8__add_attraction_source_fields.sql#L9-L22
[V11]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V11__add_attraction_intro.sql#L13-L24
[V14]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V14__add_attraction_pet.sql#L7-L11
[V17]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V17__add_attraction_media.sql#L14-L18
[V23]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V23__add_attraction_event_dates_and_list_raw.sql#L7-L10
[V32]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V32__attraction_source_and_gocamping.sql#L6-L28
[SVC]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionService.kt#L50-L97
[REPO]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/adapter/AttractionRepositoryAdapter.kt#L20-L45
[DTO]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/presentation/attraction/dto/AttractionDtos.kt#L133-L241
[TOUR]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/sync_tour.py#L219-L283
[OV]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/backfill_overview.py#L31-L44
[INTRO]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/backfill_intro.py#L77-L96
[MEDIA]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/backfill_media.py#L52-L76
[PET]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/sync_pet_tour.py#L71-L87
[GC]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/gocamping.py#L106-L156
[GCJ]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/infrastructure/persistence/attraction/entity/GocampingSiteJpaEntity.kt#L28-L56
[GCS]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/GocampingService.kt#L22-L34
[GOOGLE]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionGooglePlaceService.kt#L11-L40
[CLIENT]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/batch/src/main/kotlin/com/kgd/search/infrastructure/client/PlaceApiClient.kt#L39-L80
[BATCH]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/batch/src/main/kotlin/com/kgd/search/infrastructure/job/AttractionApiReindexTasklet.kt#L284-L316
[IDX]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/batch/src/main/kotlin/com/kgd/search/infrastructure/indexing/AttractionIndexDocument.kt#L20-L86
[MAP]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/batch/src/main/resources/opensearch/attractions-index.json#L470-L473
[SEARCH]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/app/src/main/kotlin/com/kgd/search/infrastructure/opensearch/AttractionSearchDocument.kt#L30-L107
[SDOMAIN]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/domain/src/main/kotlin/com/kgd/search/domain/attraction/model/AttractionDocument.kt#L9-L85
[RENDER]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt#L222-L325
[RSOURCE]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt#L609-L619
[FSOURCE]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/portal-fe/src/pages/place/placeAttributes.ts#L174-L184
[FRESH]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/infrastructure/config/PlaceIngestConfig.kt#L13-L22
[V4]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V4__create_attraction_overview_probes.sql#L12-L19
[PROBE]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/domain/src/main/kotlin/com/kgd/place/domain/attraction/model/AttractionOverviewProbe.kt#L13-L29
[V5]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V5__create_attraction_links.sql#L8-L43
[LINK]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionLinkService.kt#L82-L112
[V25]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/resources/placedb/migration/V25__create_attraction_barrier_free_and_wellness.sql#L7-L30
[BF]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/ingest/src/barrier_free.py#L93-L109
[EXTRA]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/place/feature/src/main/kotlin/com/kgd/place/application/attraction/service/AttractionExtrasService.kt#L43-L101
[PRERENDER]: https://github.com/1989v/msa/blob/a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24/portal-fe/scripts/prerender-seo.mjs#L795-L803
