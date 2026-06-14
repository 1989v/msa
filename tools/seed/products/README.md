# 상품 오픈데이터 시드 (ADR-0056 Part 1)

실제 한국 상품 데이터를 `product` 서비스에 적재하여 검색(제목/카테고리/설명/가격)에 활용하기 위한 ETL.

## 파이프라인

```
오픈데이터  ──normalize.py──▶  products.jsonl  ──search:batch(seed job)──▶  POST /api/products/bulk
(식약처/참가격/OFF)            (정규화 산출물)         ProductSeedIngestTasklet              │
                                                                                          ▼
                                                            product → Kafka(product.item.created)
                                                                                          ▼
                                                  search:consumer → OpenSearch "products" 색인
                                                                                          ▼
                                                  GET /api/search/products (category/title/desc/price)
```

DB 직삽입이 아니라 **Create API 경유**라 Kafka→OpenSearch 색인까지 정상 경로를 태운다.

## 데이터 소스 & 라이선스

| 소스 | data.go.kr | 제공 필드 | 라이선스 |
|------|-----------|-----------|----------|
| 식약처 식품(첨가물)품목제조보고 | #15064909 (식품안전나라 svc `I1250`) | 품목명, 제조사, 식품유형 | 이용허락범위 **제한없음** |
| 한국소비자원 참가격 | #3043385 | 상품명, 판매가격, 제조사, 판매처 | KOGL 제1유형(출처표시) |
| Open Food Facts Korea | — | 바코드, 이미지, 카테고리 | ODbL (enrichment-only, 원본 미보관) |

> 원천 raw 응답은 레포에 커밋하지 않는다. **정규화된 `products.jsonl` 만** 적재에 사용.
> 화면/문서에 출처 표기: "식품의약품안전처, 한국소비자원 참가격".

## 1) 정규화 (로컬, 1회성)

```bash
# 키 없이 — 동봉 샘플(24종)로 즉시 생성
python3 normalize.py --from-sample --out products.jsonl

# data.go.kr 키로 식약처 품목 수집 (가격은 참가격 join 전까지 카테고리 합성가)
export DATA_GO_KR_KEY='...(디코딩 서비스키)...'
python3 normalize.py --out products.jsonl --limit 2000
```

출력 한 줄 = 한 상품: `{"name","price","stock","brand","description","category"}` (price>0 필수 — Money 불변식).

## 2) 적재 (search:batch seed job)

로컬:
```bash
SEED_PATH=$(pwd)/products.jsonl REINDEX_SOURCE=seed \
  PRODUCT_SERVICE_URL=http://localhost:8081 \
  ./gradlew :search:batch:bootRun --args='--spring.batch.job.name=productSeedIngestJob'
```

K8s(OCI): `k8s/base/search-batch/job-product-seed.yaml` (commerce/search-batch 이미지 재사용).
seed JSONL 은 ConfigMap/PVC/initContainer 로 `/seed/products.jsonl` 에 주입한다.

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REINDEX_SOURCE` | `api` | `seed` 로 설정해야 ProductSeedIngest* 빈 활성화 |
| `SEED_PATH` | `/seed/products.jsonl` | 적재할 정규화 JSONL 경로 |
| `SEED_CHUNK_SIZE` | `500` | bulk API 청크 크기 (≤1000) |
| `PRODUCT_SERVICE_URL` | `http://localhost:8081` | product 서비스 base URL |
