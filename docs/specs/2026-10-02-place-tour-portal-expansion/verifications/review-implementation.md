# Implementation Review — place 관광 포털 확장 (ADR-0104)

대상: `spec.md` · `context/open-questions.yml` · `docs/adr/ADR-0104-place-tour-portal-expansion.md`
기준 코드: 같은 워크트리(wt3)

## 체크리스트 판정

| # | 항목 | 판정 |
|---|------|------|
| 1 | 참조 클래스·모듈 존재 | 대체로 일치. 단 변경 지점 둘이 빠졌다(I1·I2) |
| 2 | 기존 코드와의 충돌 | 수집 함수 구조·nginx 폴백과 충돌 지점 있음(I3·I6) |
| 3 | 복잡도 위험 식별 | 코스 매칭의 메모리, 날짜 형식(I2·I4) |
| 4 | NFR 안티패턴 | 종료일 없는 행사의 질의 누락(I5) |
| 5 | 마이그레이션·롤백 | 이미지 이름·재빌드 범위가 실제와 다르고, 롤백은 서술이 없다(I7·I8) |
| 6 | 동시성 | 03:40 수집과 구글 보강 잡이 겹친다(I9) |

## 스펙이 가리킨 코드 — 실제 상태 확인 (이상 없음)

- `sync_tour.CONTENT_TYPES` 5종 · `fetch_area_based` · `_ldong` · `categorize`: `place/ingest/src/sync_tour.py:47-53, 87-107, 174-186, 197-265`. `LCLS1_MAP` 의 `"EV": "culture"`(`:63`)가 스펙이 막으려는 섞임의 원인이 맞다.
- `syncFrom` 보강 필드 `?:` 패턴: `place/domain/.../Attraction.kt:331-364`. 새 컬럼을 이 패턴으로 넣으면 개요·이용정보·사진·반려동물 왕복이 지우지 않는다.
- `UPSERT_FIELDS`: `place/ingest/src/backfill_overview.py:34-42`. 왕복 경로 셋이 `backfill_intro.py:88` · `backfill_media.py:65` · `backfill_overview.py:163` 에서 이 목록을 쓴다.
- 최신 Flyway 는 `V22__create_attraction_similar.sql` 이고 V23 은 비어 있다(`place/feature/src/main/resources/placedb/migration/`).
- 재색인 키셋 두 번 훑기 · `readIntro`: `AttractionApiReindexTasklet.kt:101, 115-116, 291-309, 348-352`.
- `verifySearchIndexContract`: 루트 `build.gradle.kts:494-601`. 매핑 최상위 키 기준이라 `enabled:false` 객체(코스 구성)도 한 필드로 다뤄진다.
- 렌더 경로·`noindex` 메타: `AttractionPageController.kt:22-46`(`no-cache`), `AttractionPageRenderer.kt:54, 132`.
- `CONTENT_TYPE_KO/EN` 에 15/25/32 · 85/80 이 이미 있다: `portal-fe/src/pages/place/placeAttributes.ts:135-142`.
- 화면의 「전체」·주변 관광지·지역 목록은 모두 `SIGHT_CATEGORIES` 를 명시해 부른다(`PlacePage.tsx:272`, `AttractionPage.tsx:118`, `RegionPage.tsx:105`). 새 유형이 기존 절에 새어 들지 않는다.
- egress 는 라벨 허용이라 새 정책이 필요 없다: `k8s/base/network-policy/11-allow-egress-https-public.yaml:33`.
- 일일 한도: 보강 잡 예산이 개요·이용정보 20,000, 사진·반복정보 45,000이다(`cronjob-overview.yaml:63`, `cronjob-intro.yaml:69`, `cronjob-media.yaml:60`). 새 행 약 4,600건은 하루 이틀이면 채워진다. 수집 약 50콜(I10 참고)도 운영 키의 오퍼레이션별 한도 안이다.

## 이슈 (REVISE)

### I1 [#1] search-batch `PlaceApiClient` 가 변경 지점에서 빠졌다
- 근거: `search/batch/.../client/PlaceApiClient.kt:30-33` 주석 — 「필드를 여기 추가하지 않으면 기본값 null 이 조용히 이긴다」(썸네일 사고). 매핑은 `:154-192` 에서 손으로 한다.
- SR-4 는 매핑·쓰기·읽기 문서와 재색인 테스트만 적었다. 그런데 `verifySearchIndexContract`(`build.gradle.kts:499-501`)는 이 DTO 를 보지 않는다. 재색인 테스트(`AttractionApiReindexTaskletTest`)도 클라이언트를 mock 하므로 JSON→DTO 누락을 못 잡는다.
- 수정안: SR-4 변경 지점에 `PlaceApiClient.AttractionDto` + `fetchPageAfter` 매핑(행사 시작·종료일, 목록 원문)을 넣는다. `PlaceApiClientTest` 에 「응답 JSON 에 날짜가 있으면 DTO 에 실린다」 케이스를 더한다. SR-2 의 「여섯 곳」도 실제 매핑 함수 기준으로 적는다: `Attraction.create`·`restore`·`syncFrom`, 엔티티 `fromDomain`/`toDomain`, bulk DTO→도메인, 목록 응답 DTO, `UPSERT_FIELDS`, search `PlaceApiClient`.

### I2 [#1·#3] 코스 구성의 「같은 언어 관광지 id」 매칭 수단이 없다
- 근거: 1차 투영 `RegionProjection` 은 id·lang·코드·좌표·제목만 갖고 contentId 가 없다(`AttractionApiReindexTasklet.kt:317-328`). 2차 색인은 페이지 단위라 다른 페이지의 contentId 를 모른다. 배치 힙 약 256MB 가 전제다(`:37-38, 288-289`).
- 수정안: SR-4 에 매칭 방법을 적는다. 1차 훑기에서 `(lang, contentId) → id` 맵을 함께 만든다(6만 건 × 문자열 하나, 수 MB). 「매칭 실패 n건」을 완료 로그에 더한다.

### I3 [#2] `fetch_area_based` 는 오퍼레이션과 유형 표가 박혀 있어 그대로 재사용할 수 없다
- 근거: 오퍼레이션이 `"areaBasedList2"` 로 고정(`sync_tour.py:207`)이고 `CONTENT_TYPES[content_type][svc_key]`(`:200`)이다. 여행코스는 영문 키가 없어 `KeyError` 가 난다. `_job_sync`(`main.py:86-88`)는 kor·eng 를 무조건 돈다.
- 수정안: SR-1 에 「행 정규화(`normalize_row(it, lang)`)를 목록 호출에서 떼어 세 오퍼레이션이 함께 쓴다」를 적는다. `CONTENT_TYPES` 는 언어 키가 없을 수 있는 형태로 바꾸고, 새 잡은 `_job_sync` 를 거치지 않는다. 기존 `--job=sync` 의 동작이 같은지 T6 픽스처로 확인한다.

### I4 [#3] 행사 날짜 형식 변환이 정의되지 않았다
- 근거: 원천은 `yyyyMMdd` 문자열이고 bulk DTO 는 `java.time` 타입이다(`AttractionDtos.kt:11, 43-63`). 기존 일시는 `parse_modified`(`sync_tour.py:189-194`)가 ISO 로 바꿔 보낸다. bulk 는 2,000건이 요청 하나라(`place_client.py:16, 78-87`) 한 행의 형식 오류가 묶음 전체를 400 으로 떨어뜨린다.
- 수정안: SR-1 에 「`eventstartdate`/`eventenddate` → `yyyy-MM-dd`, 8자리 숫자가 아니면 None + 건수 로그」를 적는다. pytest 에 빈 값·`0`·7자리 표본을 둔다.

### I5 [#4] 종료일 없는 행사가 범위 질의에서 빠진다
- 근거: SR-3 은 「종료일이 없으면 시작일을 종료일로」 판정한다. SR-4 는 `eventStatus` 를 날짜 범위 질의로 바꾼다. 색인에 종료일이 없으면 `range eventEndDate >= today` 가 그 문서를 놓쳐 Kotlin 판정과 검색 결과가 갈린다. 행사 sitemap 의 「종료+30 ≥ 오늘」도 같다.
- 수정안: 둘 중 하나를 SR-4 에 못박는다. ① 재색인이 실효 종료일(종료 ?: 시작)을 색인 필드로 싣고 원값은 그대로 둔다. ② 질의가 `should: [range end, (must_not exists end) AND range start]` 로 짠다. 순수 함수가 「상태 → 날짜 범위」도 내도록 해 필터가 그 경계값을 쓰게 하고, 골든 픽스처에 종료일 없는 사례를 넣는다.

### I6 [#2] 행사 sitemap 프록시는 기존 렌더 location 의 폴백을 베끼면 안 된다
- 근거: 상세 렌더 location 은 5xx 를 가로채 SPA 셸 200 으로 바꾼다(`portal-fe/nginx.conf:167-168, 171-178`). 같은 설정을 쓰면 SR-7 의 503 이 `index.html` 200 으로 나간다. 크롤러 입장에서는 스펙이 피하려는 「빈 200」과 같다. 정확 일치 location 은 정규식 `^/(sitemap…)\.xml$`(`:66`)보다 먼저 잡히므로 우선순위는 문제없다. 다만 호스트를 가리지 않아 apex·game 호스트에서도 place 행사 sitemap 이 열린다.
- 수정안: SR-7 에 「`proxy_intercept_errors off`·`error_page` 없음, 503 그대로 · place 호스트가 아니면 404 · `Cache-Control` 은 search 가 붙인다」를 적는다. `writePlaceSitemaps` 가 상세 0건일 때 인덱스가 아닌 urlset 을 내는 분기(`prerender-seo.mjs:796-798`)에서도 행사 파일을 가리키는지 정한다.

### I7 [#5] 배포 이미지 이름과 재빌드 범위가 실제와 다르다
- 근거:
  - place 는 `:place:feature` 로 `content:app` 에 접혀 있다(`settings.gradle.kts:54-59`). 수집 잡도 `http://content:8097` 을 부른다(`cronjob-pet-tour.yaml:46`). SR-10 의 「JVM place 이미지」는 실제로는 `content` 이미지다.
  - `search/domain/*` 변경은 `search` 이미지만 다시 굽는다(`scripts/ci/topology.sh:16`, `images.yml:173-175`). 그런데 search-batch 가 domain 클래스를 쓴다(`AttractionApiReindexTasklet.kt:3-10`). 판정 함수·코스 파서·`AttractionDocument` 를 domain 에 두고 batch 파일을 안 건드린 커밋이면 재색인은 옛 바이트코드로 돈다.
- 수정안: SR-10 ①을 「content(JVM) → place-ingest」로, ②를 「search-batch · search · portal-fe」로 고친다. domain 만 바뀐 커밋은 `services=search-batch` 로 명시 재빌드한다. 운영 확인에 batch 로그의 새 필드 적재 건수 한 줄을 더한다.

### I8 [#5] 롤백 서술이 없다
- 근거: SR-2 는 「커밋한 V23 은 고치지 않는다」까지만 적었다.
- 수정안: 한 줄을 더한다. 「V23 은 nullable 컬럼 추가뿐이라 옛 content 이미지로 되돌려도 `validate` 가 통과한다. 되돌릴 때는 `place-ingest-tour-sync` 를 먼저 suspend 한다(옛 bulk DTO 가 모르는 필드를 받는다).」 bulk 가 모르는 필드를 무시하는지 거부하는지를 이때 확인한다.

### I9 [#6] KST 03:40 수집이 구글 place_id 보강과 겹친다
- 근거: `place-ingest-google-places` 는 KST 03:20 시작에 기한 1시간이다(`cronjob-google-places.yaml:24, 36`). `upsertAll` 은 읽은 엔티티에 `syncFrom` 을 적용해 전체를 저장하고 `@Version` 이 없다(`AttractionRepositoryAdapter.kt:28-44`). 읽기와 저장 사이에 보강 잡이 쓴 `googlePlaceId` 는 `source ?: 읽은 값(null)` 으로 덮인다. 새 행이 보강 대상이 되므로 겹칠 가능성이 생긴다.
- 수정안: 시각을 KST 03:10(UTC 18:10)으로 당긴다. 약 50콜이라 03:20 전에 끝난다. 재색인 04:30 이전이라는 조건도 그대로다. 혹은 SR-1 에 「보강 잡과 겹치지 않는 자리」를 조건으로 적는다.

### I10 [#3, 경미] 호출 수 추정이 조회 기간과 맞지 않는다
- 근거: SR-1 은 행사 조회 시작일을 오늘 − 365일로 둔다. 호출 수(「국·영 각 3쪽 내외」)와 SR-10 규모(국문 294)는 ADR-0104 `:11` 의 「10-01 이후 시작」 기준이다. 1년 창이면 행사가 몇 배가 되고, 대부분은 이미 종료 + 30일이 지난 행사다.
- 수정안: Q1 확인 때 −365 창의 건수와 쪽수를 함께 재서 SR-1·SR-10 의 수치를 고친다. 좌표 없어 버린 행사 건수도 Q4 와 같이 잰다(`sync_tour.py:218-222` 가 좌표 없는 행을 조용히 버린다).

## 요약

스펙이 가리킨 기존 코드는 실제와 맞는다. 전체 동기화가 새 컬럼을 지우는 경로는 `syncFrom` 의 `?:` 와 `UPSERT_FIELDS` 로 막혀 있다. 일일 한도와 egress 도 문제없다.
막아야 할 것은 빠진 변경 지점 둘(I1 search `PlaceApiClient`, I2 코스 id 매칭)이다. 그다음은 날짜 형식(I4), 종료일 없는 행사의 질의 누락(I5), 행사 sitemap 의 폴백(I6), 이미지 이름·재빌드 범위(I7), 스케줄 겹침(I9)이다. 전부 스펙 문안을 고치면 해결되고, 사람이 판단해야 할 충돌은 없다.

VERDICT: REVISE

## 반영

근거 확인: `PlaceApiClient.kt:30-33` · `AttractionApiReindexTasklet.kt:317-328` · `sync_tour.py:197-200,207` · `main.py:83-88` · `place_client.py:16,78-87` · `AttractionDtos.kt:11,43` · `nginx.conf:66,158-168` · `settings.gradle.kts`(place:feature → content:app) · `cronjob-pet-tour.yaml:46` · `scripts/ci/topology.sh:16`(`search/*` → search) · `images.yml`(`search/batch/*` 만 search-batch) · `cronjob-google-places.yaml:24,36` · `AttractionRepositoryAdapter.kt:28-44,82-83` · `prerender-seo.mjs:796-798`.

| 지적 | 반영 위치 | 내용 |
|---|---|---|
| I1 | spec.md:77(`PlaceApiClient` 매핑 + `PlaceApiClientTest`) · :47-48(자리 목록을 실제 매핑 함수 기준으로) | |
| I2 | spec.md:80 · :165 | 1차 투영에 contentId, `(lang, contentId) → id` 지도, 매칭 실패 건수 |
| I3 | spec.md:23, :25-26(`normalize_row` 분리 · 언어 키 없는 표 · 기존 `--job=sync` 결과 불변) · :35(`_job_sync` 를 거치지 않음) | |
| I4 | spec.md:27-28 | ISO 변환, 실패는 값만 None + 건수, 행은 적재 |
| I5 | spec.md:76 · :64 | ① 방식(유효 종료일 색인) 채택 |
| I6 | spec.md:130-132(nginx 계약 ①~⑤) · :124-125(상세 0건 분기는 행사 파일을 가리키지 않음) | |
| I7 | spec.md:154(content) · :155-156(search-batch·search·portal-fe, `search/domain` 만 바뀐 커밋은 `services=search-batch` 수동 실행) · :165 | |
| I8 | spec.md:159-160 | 수집 잡 먼저 suspend, V23 nullable, 옛 bulk 의 모르는 필드 처리 확인 |
| I9 | spec.md:35-37 · ADR-0104 결정 3 | KST 03:10, `activeDeadlineSeconds` 540 으로 03:20 전 종료 보장, 첫 실행 소요 기록 |
| I10 | spec.md:39-40 · ADR-0104 결과 · open-questions Q1 | 호출 수를 쪽수 식으로 바꾸고 −365 창 규모는 Q1 첫 호출에서 확정, 60쪽 초과 시 −180일 |
