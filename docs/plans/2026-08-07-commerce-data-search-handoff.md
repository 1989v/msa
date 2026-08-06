# 커머스 상품 데이터 소싱 · 검색 — 인계서

- 날짜: 2026-08-07 (심야 운영 구축 완료 반영 — 같은 날 2차 갱신)
- 대상: 다른 세션에서 이 트랙을 이어받는 경우의 단일 진입점
- 관련 ADR: `docs/adr/ADR-0056-geo-poi-and-product-ingestion.md`, `docs/adr/ADR-0060-food-nutrition-enrichment.md`

## 한 줄 요약

**운영 검색이 실제로 동작한다 — 샘플 24종이 적재·색인돼 keyword + kcal 필터까지
공개 API 로 검증 완료. 남은 것은 data.go.kr 키 발급 후 실데이터 교체뿐이다.**

## 실측 상태 (2026-08-07 2차, 운영 구축 후)

| 항목 | 상태 | 근거 |
|---|---|---|
| 정규화 ETL (`tools/seed/products/normalize.py`) | ✅ 완료 | 4개 오픈데이터 소스 지원(식약처 품목제조보고/참가격/영양성분/원재료), CSV·API 양쪽 모드 |
| product 서비스 영양 9필드 | ✅ 완료 | 도메인·JPA·DTO·이벤트 전파, 마이그레이션 V20260615_001 / V20260703_001 |
| search 색인 + kcal 범위 필터 | ✅ 완료 | `products-index.json` 에 영양 필드 + `id: keyword`, `RankingQueryBuilder` range 필터 |
| **운영 상품 데이터** | ✅ **24건 (샘플)** | `GET https://api.1989v.com/api/products?size=3` → `totalElements: 24` |
| **운영 검색 API** | ✅ **200** | `keyword=김치` → 종가집 포기김치(29kcal), `maxKcal=100` 필터 정상 |
| 운영 색인 파이프라인 | ✅ 검증됨 | seed Job→bulk API→Kafka(29092)→search-consumer→OpenSearch 24건 색인 실측 |
| place 서비스 (지리/POI) | ⏸ 비활성 | `k8s/overlays/oci-arm/kustomization.yaml` 에 `replicas: 0` 가드 |

## 2026-08-07 운영 구축에서 잡은 잠복 버그 (재발 시 참조)

1차 인계서의 "검색 500 = 인덱스 부재" 추정은 **부분만 맞았다**. 실제로는 아래가 겹쳐 있었다:

| # | 버그 | 수정 |
|---|---|---|
| 1 | 배치 매니페스트 3종에 `--spring.batch.job.enabled=true` 누락 → 잡 미실행, 파드 영구 Running (reindex 46h/eval 76d stuck) | `59994a5` — cronjob-reindex/eval, job-product-seed args |
| 2 | `SearchBatchApplication` 이 잡 완료 후 프로세스 미종료 → Job 영구 미Complete | `59994a5` — main() 에서 `SpringApplication.exit` |
| 3 | reindex/eval CronJob 파드 라벨에 `part-of` 누락 → default-deny 에서 egress 전면 차단 | `59994a5` — 템플릿 라벨 추가 |
| 4 | search-batch → product ingress 허용 NP 부재 → bulk 적재·페이지 스캔 차단 | `59994a5` — `allow-search-batch-to-product` |
| 5 | **`allow-app-to-kafka` 가 9092 만 허용, 앱은 `kafka:29092`(INTERNAL) 로 bootstrap** → K8s 프로파일 Kafka publish/consume 전면 차단 (Phase 1a 부터, 상품 0건이라 무증상) | `56d6383` — 29092 추가 |
| 6 | 운영 OpenSearch 에 `analysis-nori` 부재 — egress 하드닝으로 기동 래퍼의 플러그인 다운로드가 조용히 실패 | nori 베이크 이미지 `docker/opensearch/Dockerfile` → OCIR `opensearch-nori:3.3.0` + oci-arm 오버라이드 |
| 7 | **search/search-consumer/product 배포 이미지(88bb760)가 `faf6b07`(httpcore5 5.4.2 정렬) 이전** → 첫 검색에서 `NoSuchMethodError` 로 I/O reactor 사망 = 검색 500 의 직접 원인. consumer bulk flush 도 무증상 실패 | 로컬 Jib 빌드 → OCIR push → `3360833` 수동 bump (59994a5 태그) |

운영 절차 메모:

- **arm64 hosted runner 미확보로 images.yml 이 실패**하면(2026-08-06~07 발생): 로컬(Apple Silicon)에서
  `./gradlew -PjibRegistry=ap-chuncheon-1.ocir.io/axyooxbyk5yv -PjibTag=<sha> :svc:app:jib` 후
  oci-arm kustomization 수동 bump `[skip ci]`. OCIR 로그인은 클러스터 `ocir-pull-secret` 크레덴셜 재사용 가능.
- workflow_dispatch 는 1989v 계정 토큰으로 가능 (`GH_TOKEN=$(gh auth token -u 1989v) gh workflow run images.yml -f rebuild_all=true`).
- 수동 seed Job 은 kustomize 를 안 타므로 이미지 좌표를 OCIR 로 직접 치환해 apply 한다
  (ConfigMap `product-seed` 생성 → `k8s/base/search-batch/job-product-seed.yaml` 변형 apply).
- 재시드 시 기존 행 정리: 실패 재시도가 행을 남길 수 있다 (`backoffLimit` 만큼 중복).
  `DELETE FROM product_db.products` 후 Job 재실행이 가장 깨끗하다.

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

### 3. 운영 적재 — 경로 검증 완료 (샘플 24건으로 실측)

`search-batch` 의 seed Job 이 `POST /api/products/bulk` 로 넣는다 — DB 직삽입이 아니라
Create API 경유라서 Kafka → OpenSearch 색인까지 정상 경로를 탄다. OCI 에서:

```bash
# (샘플 잔여분 정리가 필요하면 먼저: DELETE FROM product_db.products)
kubectl -n commerce create configmap product-seed --from-file=products.jsonl=<정규화 산출물>
kubectl -n commerce delete job product-seed --ignore-not-found
# job-product-seed.yaml 의 이미지를 OCIR 좌표로 치환해 apply (위 운영 절차 메모 참조)
```

인덱스/alias 는 이미 존재한다 (`products` → `products_20260806190301`, nori 매핑).
매핑 변경 시에만 `kubectl -n commerce create job --from=cronjob/search-reindex reindex-manual`.

### 4. 검증 — 샘플 기준 통과 확인됨 (2026-08-07)

```bash
curl 'https://api.1989v.com/api/products?size=3'                                  # totalElements: 24 ✅
curl 'https://api.1989v.com/api/search/products?keyword=김치&size=3'               # 200, 종가집 포기김치 ✅
curl 'https://api.1989v.com/api/search/products?keyword=김치&maxKcal=100&size=3'   # 29kcal 반환 ✅
```

실데이터 교체 후에도 동일 3종으로 검증한다.

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
