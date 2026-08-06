# 커머스 상품 데이터 소싱 · 검색 — 인계서

- 날짜: 2026-08-07
- 대상: 다른 세션에서 이 트랙을 이어받는 경우의 단일 진입점
- 관련 ADR: `docs/adr/ADR-0056-geo-poi-and-product-ingestion.md`, `docs/adr/ADR-0060-food-nutrition-enrichment.md`

## 한 줄 요약

**코드·문서·로컬 E2E 는 전부 완료돼 main 에 병합됐다. 막힌 곳은 단 하나 — data.go.kr
API 키가 없어 실데이터를 넣지 못했고, 그 결과 운영에는 상품 0건이라 검색 API 가 500 이다.**

## 실측 상태 (2026-08-07 기준)

| 항목 | 상태 | 근거 |
|---|---|---|
| 정규화 ETL (`tools/seed/products/normalize.py`) | ✅ 완료 | 4개 오픈데이터 소스 지원(식약처 품목제조보고/참가격/영양성분/원재료), CSV·API 양쪽 모드 |
| product 서비스 영양 9필드 | ✅ 완료 | 도메인·JPA·DTO·이벤트 전파, 마이그레이션 V20260615_001 / V20260703_001 |
| search 색인 + kcal 범위 필터 | ✅ 완료 | `products-index.json` 에 영양 필드 + `id: keyword`, `RankingQueryBuilder` range 필터 |
| 로컬 E2E | ✅ 검증됨 | 24건 샘플로 seed→bulk API→Kafka→OpenSearch→검색까지, `김치 + maxKcal=100` → 29kcal 반환 확인 |
| main 병합 | ✅ 완료 | `25a4c33` 병합·push 완료 |
| **운영 상품 데이터** | ❌ **0건** | `GET https://api.1989v.com/api/products?size=3` → `{"products":[],"totalElements":0}` |
| **운영 검색 API** | ❌ **500** | `GET /api/search/products?keyword=test` → 500. search 서비스 자체는 헬스 UP |
| place 서비스 (지리/POI) | ⏸ 비활성 | `k8s/overlays/oci-arm/kustomization.yaml` 에 `replicas: 0` 가드 |

검색 500 의 유력 원인은 **OpenSearch `products` 인덱스 부재**다 — 운영 리인덱스를 한 번도
돌리지 않았고(`k8s/base/search-batch/cronjob-reindex.yaml` 은 `suspend: true`), 색인이 없으면
조회가 예외로 떨어진다. 데이터를 넣기 전에 이것부터 확인할 것. (추정 — OCI 접근 후 실측 필요)

## 이어서 할 일 (순서대로)

### 1. data.go.kr 키 발급 — 이 트랙의 유일한 실질 차단 요소

https://www.data.go.kr 회원가입 → 아래 4건 활용신청(자동승인, 보통 1~2시간 내 키 발급):

| 데이터셋 | 번호 | 용도 |
|---|---|---|
| 식약처 식품(첨가물)품목제조보고 | 15064909 | 상품명·제조사·식품유형 (뼈대) |
| 한국소비자원 참가격 | 3043385 | 실판매가 |
| 전국통합식품영양성분정보(가공식품) | 15100066 | kcal·탄단지·당류·나트륨 (조인키: 품목제조보고번호) |
| 식약처 품목제조보고(원재료) | 15062098 | 원재료명 텍스트 |

발급 후 환경변수 2개로 나뉜다: `DATA_GO_KR_KEY`(참가격 등) / `MFDS_KEY`(식약처 계열).
상세 사용법은 `tools/seed/products/README.md`.

### 2. 실데이터 정규화

```bash
python3 tools/seed/products/normalize.py --source mfds --limit 5000 --out products.jsonl
python3 tools/seed/products/normalize.py --source join --nutrition ... --ingredients ...
```

산출물은 `products.jsonl`. 스키마와 옵션은 README 참조. (샘플만으로 확인하려면
`products.sample.jsonl` 24건이 이미 있다.)

### 3. 운영 적재

`search-batch` 의 seed Job 이 `POST /api/products/bulk` 로 넣는다 — DB 직삽입이 아니라
Create API 경유라서 Kafka → OpenSearch 색인까지 정상 경로를 탄다. OCI 에서:

```bash
kubectl -n commerce create job --from=cronjob/search-reindex reindex-manual   # 인덱스 생성/스왑
# seed Job 은 job-product-seed.yaml 참조 — products.jsonl 을 ConfigMap/PVC 로 전달
```

### 4. 검증

```bash
curl 'https://api.1989v.com/api/products?size=3'                                  # 0건 → N건
curl 'https://api.1989v.com/api/search/products?keyword=김치&size=3'               # 500 → 200
curl 'https://api.1989v.com/api/search/products?keyword=김치&maxKcal=100&size=3'   # 칼로리 필터
```

### 5. (별도) place 활성화 — 지리/POI 근처검색

절차는 `k8s/overlays/oci-arm/kustomization.yaml` 의 place 패치 주석에 그대로 적혀 있다:
mysql-0 에서 `place_db`/`place_user` 생성 SQL 1회 실행 → `replicas: 0` 패치 제거 커밋 → Argo sync.
GeoNames/상가정보 적재는 그 다음.

## 주의사항

- kubectl 로컬 컨텍스트는 회사 EKS 뿐이다. **OCI 클러스터 작업은 사용자 SSH(`ssh msa-oci`)로만** 한다.
- 워크트리 `~/IdeaProjects/msa-geo-run`(브랜치 `feat/product-ingestion-geo-poi`)에 로컬 검증 스택이
  남아 있다. main 에 이미 병합됐으므로 참고용이며, 정리해도 무방하다.
- 검색 API 경로는 `/api/search/**`(게이트웨이 라우트). `/api/v1/search/...` 는 404다.
- 상품 API 경로는 `/api/products/**`. 마찬가지로 `/api/v1/products` 는 404.
