# Spec — K-관광 검색 (k-tour-search)

> Status: Draft (2026-08-11)
> ADR: ADR-0065-k-tour-search (구조 결정 — place SSOT + search 색인)
> Phasing: P1 이 이 스펙의 구현 범위. P2/P3 은 방향만 확정.

## 목표

외국인 관광객·국내 사용자가 **국내 관광지를 국문/영문으로 검색·지도 탐색**할 수 있는
실데이터 검색 도메인을 추가한다. 기존 products 검색(식품 샘플)은 그대로 유지한다.

## P1 범위

### 1. 데이터 파이프라인 (TourAPI 4.0 → place)

```
TourAPI(KorService2/EngService2)
  → tools/seed/tour/sync_tour.py (로컬 실행, ETL)
  → attractions.jsonl (lang 별 레코드)
  → POST place /api/places/attractions/bulk (contentId+lang 멱등 upsert)
  → place MySQL(SSOT) → search-batch attractionApiReindexJob → OpenSearch attractions (alias swap)
```

- **언어 모델**: 국문(KorService)과 영문(EngService)은 TourAPI contentId 체계가 달라
  **언어별 별도 레코드**(`lang: ko|en`)로 적재한다. 검색은 `lang` 필터. 국영문 쌍 매핑은 P2(유사어 사전 생성 시) 과제.
- **ETL 옵션**: `--service kor|eng`, `--content-type 12`(관광지, 기본) `+14`(문화시설)·`76`(레저) 확장 가능,
  `--area <areaCode>` 지역 한정, `--limit`. 산출 스키마(1줄=1관광지):
  `{contentId, lang, title, addr1, areaCode, sigunguCode, cat1, cat2, cat3, category, lat, lng, imageUrl, tel, overview?, modifiedAt}`
  - `category`: cat1/cat2/cat3 → 자체 카테고리 매핑(자연/역사/문화시설/레포츠/쇼핑/음식 등, 매핑 테이블은 ETL 에 상수).
  - `overview` 는 detailCommon2 추가 호출(옵션 `--with-overview`, 건당 1콜 — cap 인자).
- **동봉 샘플**: `attractions.sample.jsonl` — 서울/부산/경주 등 대표 관광지 ko 20 + en 10 (수기 정제,
  TourAPI 실스키마와 동일 필드). **키 없이 E2E 검증용** (식품 트랙 교훈).
- **키**: data.go.kr `TOUR_API_KEY` (TourAPI 국문·영문 활용신청). 미발급 시 `--from-sample`.

### 2. place — Attraction 도메인 (SSOT)

- `:place:domain` — `Attraction` (contentId+lang 자연키, 좌표 불변식은 기존 GeoMath/좌표 VO 재사용), 순수 Kotlin.
- `:place:app`
  - Flyway `V..__create_attractions.sql`: `attractions` 테이블, `UNIQUE(content_id, lang)`,
    `INDEX(area_code)`, `INDEX(category)`. 좌표는 lat/lng DECIMAL (기존 pois 패턴).
  - API:
    | Method | Path | 인증 | 설명 |
    |---|---|---|---|
    | POST | `/api/places/attractions/bulk` | ADMIN | 멱등 upsert (contentId+lang) |
    | GET | `/api/places/attractions?lang=&areaCode=&category=&page=&size=` | public | 페이지 스캔 (reindex 소스) |
    | GET | `/api/places/attractions/{id}` | public | 상세 |
  - OpenSearch 동기 색인은 **하지 않는다** — attractions 읽기 모델은 search-batch 가 일괄 재색인
    (POI 의 동기색인과 다른 선택 — reference data 대량 적재라 배치가 단순, ADR-0065).

### 3. search — attractions 색인·검색

- `attractions-index.json` (search-batch 리소스, products-index.json 패턴):
  - settings: nori_analyzer(ko) — 기존 정의 재사용. english 필드는 `english` 빌트인 analyzer.
  - mappings: `id/lang/areaCode/category: keyword`, `title/overview/addr: text`
    (ko 레코드는 nori, en 레코드는 english — **단일 필드 + lang 별 서브필드**(`title.ko`, `title.en` multi-field)
    대신 **문서 단위 lang 분리**이므로 `title: text(nori) + title.en: text(english)` 두 서브필드로 색인해
    lang 필터와 무관하게 양쪽 analyzer 검색 가능), `location: geo_point`, `imageUrl: keyword(index:false)`,
    `popularity: long`(P1 은 0, P2 채움), `modifiedAt: date`.
- `:search:batch` — `AttractionApiReindexJob`: place `/api/places/attractions` 페이지 풀스캔 →
  `attractions_yyyyMMddHHmmss` 색인 → alias swap (`IndexAliasManager` 재사용, alias 명 파라미터화).
  CronJob `attraction-reindex` (suspend: true, 온디맨드 — search-reindex 패턴, **enabled 플래그·part-of 라벨 포함**).
- `:search:app` — 검색 API:
  | Method | Path | 설명 |
  |---|---|---|
  | GET | `/api/search/attractions?keyword=&lang=ko|en&areaCode=&category=&lat=&lng=&radiusKm=&page=&size=` | 키워드+필터 검색. lat/lng/radiusKm 지정 시 geo_distance filter + 거리순 정렬 옵션(`sort=distance`), 미지정 시 관련도순 |
  | GET | `/api/search/attractions/{id}` | 단건 (지도 상세 패널) |
  - 응답: `ApiResponse<AttractionSearchResult>` — id, lang, title, category, areaCode, addr, lat, lng,
    imageUrl, overview(요약 200자), distanceKm(geo 검색 시).
  - 도메인/포트 구조는 products 검색과 동일 (`AttractionDocument`, `AttractionSearchPort`,
    `SearchAttractionService`). 랭킹은 P1 은 BM25 관련도 + 결정적 tiebreaker 만.

### 4. portal-fe — K-Tour 지도 검색 UI

- 라우트: `/tour` (ko) · `/en/tour` (en) — ADR-0062 언어 URL 승격 규칙 준수. root SPA 내 신규 섹션.
- **Google Maps JS API** (Essentials 무료 한도, 콘솔 쿼터 캡): 마커 + 클러스터링, 결과 리스트 ↔ 마커 연동,
  지도 이동 시 "이 지역 재검색"(bounds 중심 + 반경), "내 주변"(geolocation → nearby).
- 검색바(키워드) + 카테고리 칩 + 지역(광역) 셀렉트. lang 은 URL 로 결정 (`/tour`=ko, `/en/tour`=en).
- 상세 패널: 사진·주소·개요·"구글맵에서 보기" 딥링크(`https://www.google.com/maps/search/?api=1&query=lat,lng`).
- API 키: FE 환경 주입(빌드타임), HTTP referrer 제한으로 보호. 키 발급은 사용자 작업 (선행조건).
- DESIGN.md 토큰 준수 (hex 직접 입력 금지). 지도 스타일은 기본.

### 5. 배포/인프라

- place 활성화: 문서화된 절차 (mysql-0 `place_db`/`place_user` 생성 SQL 1회 → oci-arm `replicas: 0` 가드 제거).
  리소스 tier S(512Mi) — free-tier 메모리 예산 내 (ADR-0065 에 예산 명시).
- NetworkPolicy: `allow-search-batch-to-place` 추가 (reindex 페이지 스캔 경로,
  04-allow-backend-to-backend.yaml 컨벤션). place 는 `part-of` 라벨로 기존 mysql/opensearch NP 자동 수혜.
- CronJob `attraction-reindex` 는 suspend — 적재 후 온디맨드 실행.

### P1 검증 (완료 조건) — ✅ 통과 (2026-08-11 운영 실측)

```bash
# 샘플 30건 기준 (키 발급 전)
curl 'https://api.1989v.com/api/places/attractions?lang=ko&size=3'          # SSOT — total 30 (ko 20 + en 10) ✅
curl 'https://api.1989v.com/api/search/attractions?keyword=해수욕장&lang=ko'   # 국문 — nori 복합명사 분해 4건 ✅
curl 'https://api.1989v.com/api/search/attractions?keyword=야경&lang=ko'      # 국문 — overview 본문 매칭 4건 ✅
curl 'https://api.1989v.com/api/search/attractions?keyword=palace&lang=en'  # 영문 — 2건 ✅
curl 'https://api.1989v.com/api/search/attractions?lat=37.5788&lng=126.977&radiusKm=5&sort=distance'  # 근방 6건 거리순 ✅
# FE: https://1989v.com/tour · /en/tour → 200 ✅ (구글맵은 VITE_GOOGLE_MAPS_KEY 시크릿 등록 후 활성 — 미등록 시 리스트-only)
```

> `keyword=궁궐` 은 0건 — 샘플 문서 어휘에 "궁궐" 이 없어 BM25 로는 불가한 사례.
> 정확히 P2 유사어(synonym) 단계가 푸는 문제로, P2 검증 케이스로 승격한다.

## P2 (방향 확정, 별도 구현)

- **자동완성**: `/api/search/attractions/suggest?q=&lang=` — products suggest(match_bool_prefix) 포팅.
- **유사어**: TourAPI 국영문 타이틀 쌍 + 관광 별칭(고궁↔궁궐 등) → `synonym_graph` 필터.
  국영문 쌍 매핑(좌표 근접 + 이름 유사도 휴리스틱) 도구를 ETL 에 추가.
- **자체 랭킹**: function_score — `popularity`(관광빅데이터 방문자 지표), freshness(modifiedAt),
  CTR(analytics 이벤트 연계). RankingProperties/variant A/B 패턴 재사용.
- **주기 동기화**: sync CronJob 화 (TourAPI egress NP 허용 + 주간 스케줄) — "주기적 데이터 리서치" 충족.

## P3 (방향만)

- **평가 자동화**: attractions judgment set(초기 수동 시드 → 클릭로그 보강) + `searchEvaluationJob`
  인덱스 파라미터화 → NDCG@10/MRR 일일 산출 (기존 RankingMetrics/ClickHouse 재사용).
- **SNS 보조 신호**: Instagram Graph API hashtag 카운트(공식·무료, Business 계정 필요) → popularity 보조 가중.
- **벡터 검색**: 보류 — 임베딩은 로컬 모델로 ETL 타임 생성(인덱스 knn_vector), 쿼리 타임 인코딩은 미결.

## 명시적 비범위

- 인스타/X 크롤링·비공식 수집 (ToS 위반)
- 리뷰/평점/UGC (관광지 데이터는 read-only reference)
- 상시 place 외 신규 파드 (free-tier 제약)
- products 검색 변경 (기존 유지)
