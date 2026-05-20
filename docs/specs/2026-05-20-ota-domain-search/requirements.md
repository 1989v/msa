<!-- source: search -->
# Requirements — OTA 도메인 검색

상위 ADR (선행): `docs/adr/ADR-0050-search-quality-roadmap.md` (일반화된 ranking + MAB 인프라)
신규 ADR (후속 작성 예정): `docs/adr/ADR-00XX-ota-domain-modeling.md`

## 0. 본 spec 의 의사결정 게이트

본격 구현 전, 다음을 결정해야 함:

| 결정 | 옵션 |
|---|---|
| OTA 도메인 위치 | (a) 본 commerce 레포 모듈로 추가 / (b) 별도 sibling 레포 |
| Region taxonomy 소스 | (a) 자체 관리 (admin UI 로 CRUD) / (b) 외부 제공자 (Naver/Kakao Local API 등) |
| Synonyms 관리 | (a) `synonyms.txt` 정적 파일 / (b) ES `synonyms_path` + reload API / (c) DB + 어드민 UI |
| Attraction 데이터 출처 | (a) 자체 등록 / (b) Foursquare/Google Places import / (c) 운영자 큐레이션 |

각 항목 결정 후 본 requirements 갱신.

## 1. OTA-1: Region 모델 + region-scope MAB (~5md)

### FR-1.1 Region 도메인
- `Region(id, name, parentId, level, geo)` — 국가/도시/지역 계층
- level: COUNTRY / CITY / DISTRICT
- 데이터: 초기 ~100 개 (한국 주요도시 + 동남아 인기 destination)
- 관리: admin UI CRUD (Phase 1 은 SQL seed 만)

### FR-1.2 Product.regionId
- `Product.regionId: String?` 추가 — 상품의 주요 region (다중은 attraction 으로)
- product DB 마이그레이션 + `Product.create/restore` 시그니처 확장
- Kafka 이벤트 페이로드 `regionId` 추가

### FR-1.3 search 측 wire-up
- `ProductEsDocument.regionId` keyword 매핑
- IndexAliasManager 매핑 업데이트
- `MultiScopeBanditBlender.keyFor` 가 `scope=region` 일 때 `Region.regionId` 추출
- `application.yml`: `search.bandit.scopes` 에 region scope 추가 가이드

### FR-1.4 평가
- judgment set 에 region 별 query (예: "나트랑 호텔", "발리 투어") 추가
- NDCG@10 region group by 측정

## 2. OTA-2: Synonyms / Query Understanding (~3md)

### FR-2.1 Synonyms graph
- ES `nori` analyzer 에 `synonym_graph` filter 추가
- 동의어 파일 `search/app/src/main/resources/synonyms-ko.txt`:
  ```
  나트랑, 나짱, 냐짱, Nha Trang, 깜란
  발리, Bali, 덴파사르
  방콕, Bangkok, BKK
  ```
- 초기 ~100 entries (사용자 도메인 지식 기반)

### FR-2.2 운영
- `synonyms_path` + ES `_reload_search_analyzers` API 로 무중단 갱신
- 어드민 UI 후속 (admin-fe `/admin/search-debug/synonyms` 페이지)
- A/B: variant 별 다른 synonyms 적용 가능 (별도 인덱스 alias)

### FR-2.3 평가
- before/after 같은 query 의 recall 비교 ("깜란" 입력 시 nha trang 상품 노출 여부)

## 3. OTA-3: Attraction (~10md, high-level)

### FR-3.1 Attraction 도메인
- `Attraction(id, name, regionId, geoPoint, category)` — 명소
- Product ↔ Attraction N:M (`product_attractions` 조인)

### FR-3.2 검색 UI 진화
- 현재: 지역 탐색 + 필터
- After: free-text query → query understanding → attraction/region/category 자동 분기

### FR-3.3 query understanding 의 깊이
- 1차: 키워드 매칭 (입력 → 정확 매칭 attraction 우선)
- 2차: 컨텍스트 (날짜/인원/예산) 기반 의도 분류
- 3차: ML 분류기 (별도 ADR — Wide&Deep 계열, ADR-0050 P3 의 LinUCB 와 인접)

## 4. OTA-4: Package (~10md+, high-level)

### FR-4.1 Package 도메인
- `Package(id, name, items: List<Product>, price, validityWindow)` — 여러 상품 묶음
- pricing rule: 묶음 할인 등

### FR-4.2 프리텍스트 검색
- 현재: 단일 product 검색만
- After: query → 단일 product + package 후보 동시 노출
- 패키지 ranking: 묶음 가치 (할인율 × 인기도)

### FR-4.3 도입 검토 항목
- 패키지 검색 ROI: 통검 프리텍스트 유입량/판매 지표로 평가
- 비활성/활성 운영 토글 필요

## 5. 비기능 / 제약

- ADR-0025 Tier 1 P99 200ms 유지
- 본 spec 의 모든 신규 신호는 default off → 점진 활성화
- 데이터 마이그레이션: alias swap 절차 재사용
- 다국어 지원 (synonyms 가 ko 만이 아닌 en/jp 등 확장 가능 구조)

## 6. 성공 기준 (OTA-1 한정 — 측정 가능 범위)

| 항목 | 기준 |
|---|---|
| Region wire-up | "나트랑" 검색 시 regionId 기반 정확 매칭 ≥ 80% |
| region-scope MAB | A/B 에서 region 별 NDCG@10 baseline 대비 ≥ +3% |
| Synonyms | "깜란" 입력 시 nha trang 상품 recall ≥ 50% (0 → 50%) |

OTA-3/4 는 별도 spec 작성 후 정의.

## 7. 본 spec 이 다루지 않는 것 (Out of Scope)

- 항공권 / 환율 / 결제 게이트웨이 (별도 도메인)
- 다국어 UI / i18n (별도 spec)
- 모바일 앱 / 위치 기반 추천 (별도 spec)
- 머신러닝 베이스 query understanding (ADR-00XX 별도)
