# ADR-0065 K-관광 검색 — place SSOT + search 색인, TourAPI 소싱

## Status
Accepted (2026-08-11) — P1 구현 반영

## Context

검색 도메인의 운영 데이터가 학습용 식품 샘플 24건뿐이다 (ADR-0056/0060 트랙, 실데이터는
data.go.kr 키 대기). 사용자 요구는 "실제 검색할만한 데이터" — 국내 인기 관광지를
국문/영문으로 제공해 외국인 K-관광 조회 유스케이스를 만드는 것. 요구 6항목(지리정보·주기
리서치/지도/근방·유사어·벡터/랭킹/자동완성/NDCG·MRR) 중 4개는 이미 products 도메인에 구현된
인프라(geo_distance, function_score+MAB+A/B, match_bool_prefix suggest, RankingMetrics+eval CronJob)의
포팅으로 충족 가능하다.

제약: OCI free tier 최상위 제약(상시 파드 예산), egress 하드닝(ADR-0061, 클러스터 내 외부 API
호출은 NP 명시 허용), SNS 스크래핑 ToS 리스크.

## Decision

1. **데이터 소스 = 공공 API 주축**: 한국관광공사 TourAPI 4.0 (KorService2 국문 + EngService2 영문 —
   좌표·카테고리·사진·개요 공식 제공) + 관광빅데이터 방문자 지표(P2 popularity). 인스타/X 는
   **크롤링 금지**, P3 에 공식 Instagram Graph API hashtag 카운트만 보조 신호로 검토.
2. **place = 관광지 SSOT**: 비활성이던 place 서비스를 활성화하고 `Attraction` 도메인
   (contentId+lang 멱등키, 언어별 레코드)을 추가한다. 신규 상시 파드는 place 1개(tier S 512Mi)만.
3. **search = 읽기 모델**: `attractions` 인덱스(nori + english analyzer, geo_point)와 검색/근방
   API 를 search 서비스에 둔다. products 와 동일 패턴 — 랭킹/A-B/suggest/eval 인프라 재사용.
4. **색인 경로 = 배치 재색인** (POI 의 동기 색인과 다른 선택): attractions 는 대량 reference
   data 라 Kafka/동기색인 대신 search-batch `AttractionApiReindexJob`(place API 풀스캔 → alias
   swap)으로 일괄 재구축한다. 데이터 갱신 주기(주 1회 수준)에 이벤트 파이프라인은 과잉.
5. **ETL 실행 위치 = P1 로컬, P2 CronJob**: egress 하드닝 아래에서 P1 은 로컬 ETL
   (`tools/seed/tour/`) → bulk API (products 트랙에서 검증된 경로). 주기화는 P2 에서 sync
   CronJob + egress NP 한 줄로 승격.
6. **지도 = Google Maps JS API** (Essentials 무료 한도 + 콘솔 쿼터 캡). FE 는 portal-fe 를
   **`place.<domain>` 서브도메인**으로 서빙 — 독립 기능단위는 서브도메인으로 분리한다는
   플랫폼 원칙에 따라 game(ADR-0059)과 동일한 host 인식 루트 라우팅. 언어는 `/`(ko)·`/en`(en)
   (ADR-0062). apex `/place` 는 프로덕션에서 서브도메인으로 리다이렉트, 구 `/tour` 는 `/place` 로
   흡수. 명칭은 백엔드 서비스명과 통일해 **place** 로 고정 (tour 표기 폐기, 2026-08-11).
7. **벡터 검색 보류**: 임베딩 생성은 로컬 모델(ETL 타임)로 방향 확정, 쿼리 타임 인코딩은
   free-tier 마진 재계산 후 재개 (open-questions OQ-5).

## Consequences

- (+) 신규 인프라 없이 기존 검색 플랫폼 자산을 두 번째 도메인으로 증명 — 포트폴리오 가치.
- (+) 합법·무료 소스로 영문 병행 데이터 확보. 키 1개(data.go.kr)로 식품 트랙과 공유.
- (−) place 상시 512Mi 소비 — free-tier 메모리 예산 재계산 필요 (마진 ~1.2Gi 에서 소화,
  부족 시 비핵심 서비스 동시성 축소로 대응).
- (−) 언어별 레코드 분리로 국영문 쌍 연결이 즉시 없음 — P2 유사어 사전 생성 시 휴리스틱 매핑.
- (−) 배치 재색인이라 SSOT-색인 간 지연 존재(온디맨드/주기 실행) — reference data 특성상 허용.
- NP 추가: `allow-search-batch-to-place`. CronJob 매니페스트는 2026-08-07 배치 버그 교훈
  (enabled 플래그·part-of 라벨) 반영 필수.

## References

- ADR-0056 (place/POI·상품 적재), ADR-0050 (검색 품질 로드맵), ADR-0055 (OpenSearch 전환),
  ADR-0061 (엣지 하드닝), ADR-0062 (SEO/언어 URL)
- spec: `docs/specs/2026-08-11-k-tour-search/`
