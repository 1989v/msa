# Requirements — K-관광 검색 (k-tour-search)

> Shaped: 2026-08-11 (interview 4문항 완료)
> Origin: 사용자 요청 — "검색 데이터를 학습목적(식품 샘플 24건)이 아니라 실제 검색할만한 데이터로"

## 원 요청 (6항목)

1. 국내 지리정보 + 주기적 데이터 리서치로 국내 최신 인기 관광지 카테고라이징 제공.
   영문 병행 — 외국인 관광객 K-관광 조회용
2. 지도 기반 검색 — 구글맵 연동 등 편의 기능
3. 관광지 근방검색, 유사어, 벡터 기반 검색
4. 자체 랭킹
5. 자동완성
6. NDCG/MRR 지표 자동화 측정

## 인터뷰 확정 사항

| 결정 | 선택 | 근거 |
|---|---|---|
| 데이터 소스 | **공공 API 주축 + SNS 보조** | 인스타/X 스크래핑은 ToS 위반·공식 API 유료(X Basic $200/월+). TourAPI 4.0(국문+영문)·관광빅데이터(방문자 지표)로 합법·무료 커버. 인스타는 공식 API 범위(Graph API hashtag)의 보조 신호만 |
| 지도 | **Google Maps JS API** | 무료 한도(Essentials) 내 운영 + 콘솔 쿼터 캡으로 과금 차단 |
| 벡터 검색 | **이번 스코프 보류** | 방향만 기록: 임베딩은 로컬(개발자 머신) 로컬 모델로 ETL 타임 생성. 쿼리 타임 인코딩 문제는 미결 (open-questions) |
| 서비스 구조 | **place SSOT + search 색인** | products 와 동일 패턴. search 의 랭킹/MAB/eval/suggest 인프라 재사용 극대화 |

## 기존 자산 실사 (2026-08-11)

| 요구항목 | 기존 자산 | 갭 |
|---|---|---|
| 지리정보/근방 | place 서비스 (Region/Poi, geo_distance, OpenSearch poi 인덱스) — **비활성** | 활성화 + Attraction 도메인 추가 |
| 랭킹 | search function_score + Thompson MAB (ADR-0043/0050) + 온라인 A/B variant | attractions 도메인 적용 |
| 자동완성 | `/api/search/products/suggest` (match_bool_prefix + popularity boost, 매핑 변경 불필요) | attractions 포팅 |
| NDCG/MRR | `RankingMetrics`(NDCG/MRR/P@k/R@k) + judgment 로더 + `search-eval-daily` CronJob (실행버그 2026-08-07 수정 완료) | attractions judgment set + 잡 파라미터화 |
| 벡터 | OpenSearch k-NN 플러그인 번들 확인 | 쿼리 타임 임베딩 (보류) |
| 색인 파이프라인 | search-batch reindex(alias swap)/seed Job — 운영 검증 완료 (2026-08-07) | attraction reindex 잡 추가 |

## 제약

- **OCI free tier 최상위 제약** (project memory 2026-08-09): 상시 파드 추가는 place 1개(S tier)만.
  용량 부족 시 증설이 아니라 동시성 축소.
- egress 하드닝 (ADR-0061): 클러스터 내 외부 API 호출은 NP 명시 허용 필요.
  → P1 은 ETL 로컬 실행(검증된 products 패턴), 주기 CronJob 화는 P2.
- data.go.kr 키 미발급 상태 (식품 트랙과 공유) — TourAPI 활용신청을 키 발급 목록에 추가.
  키 없이도 동봉 샘플로 E2E 검증 가능해야 한다 (식품 트랙 교훈).
- 기존 products 검색(샘플 24건)은 그대로 유지 — attractions 는 별도 인덱스/API.

## Phasing

- **P1 (이번 구현)**: TourAPI ETL(ko+en) + place Attraction SSOT + attractions 색인/검색/근방 API
  + portal-fe 지도 UI(구글맵, ko/en) + place 활성화
- **P2**: 자동완성 포팅 + 유사어(국영문 쌍 기반 synonym) + 자체 랭킹(방문자 지표·CTR·freshness) + sync CronJob 화
- **P3**: eval 확장(NDCG/MRR judgment set) + SNS 보조 신호(Instagram Graph API) + 벡터(보류 해제 시)
