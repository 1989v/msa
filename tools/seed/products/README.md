# 상품 오픈데이터 시드 (ADR-0056 Part 1 · ADR-0059 영양)

실제 한국 상품 데이터를 `product` 서비스에 적재하여 검색(제목/카테고리/설명/가격)과
**칼로리 계산기/영양 필터**(에너지·탄단지·당류·나트륨, 100g 기준)에 활용하기 위한 ETL.

## 파이프라인

```
오픈데이터  ──normalize.py──▶  products.jsonl  ──search:batch(seed job)──▶  POST /api/products/bulk
(식약처/참가격/영양표준)        (정규화 산출물)         ProductSeedIngestTasklet              │
                                                                                          ▼
                                                            product → Kafka(product.item.created)
                                                                                          ▼
                                                  search:consumer → OpenSearch "products" 색인
                                                                                          ▼
                                    GET /api/search/products?keyword=&minKcal=&maxKcal=
                                    (category/title/desc/price + 영양/원재료/원산지)
```

DB 직삽입이 아니라 **Create API 경유**라 Kafka→OpenSearch 색인까지 정상 경로를 태운다.

## 데이터 소스 & 라이선스

| 소스 | data.go.kr | 제공 필드 | 라이선스 |
|------|-----------|-----------|----------|
| 식약처 식품(첨가물)품목제조보고 | #15064909 (식품안전나라 svc `I1250`) | 품목명, 제조사, 식품유형, **품목제조보고번호** | 이용허락범위 **제한없음** |
| 한국소비자원 참가격 | #3043385 (openapi.price.go.kr) | `getProductInfoSvc`(goodName/소분류) + `getProductPriceInfoSvc`(실판매가 goodPrice) | KOGL 제1유형(출처표시) |
| 식약처 전국통합식품영양성분정보(가공식품) | #15100066 (표준데이터) | **에너지(kcal)·탄수화물·단백질·지방·당류·나트륨(100g)**, 원산지국명, 품목제조보고번호(조인키) | 제한없음 |
| 식약처 식품(첨가물)품목제조보고(원재료) | #15062098 (svc `C002`) | **원재료명 텍스트**(RAWMTRL_NM, 표시순서) — 함량% 미제공 | 제한없음 |

> 원천 raw 응답은 레포에 커밋하지 않는다. **정규화된 `products.jsonl` 만** 적재에 사용.
> 화면/문서에 출처 표기: "식품의약품안전처, 한국소비자원 참가격".
> ⚠ 영양값은 표준데이터 기준(연 1회 갱신, 리뉴얼 반영 지연) — **참고용, 의료/다이어트 처방 아님** 면책 필수.
> ⚠ 원산지는 영양DB 원산지국명 best-effort — **"원료 국내산" 단정 표기 금지**(표시광고 리스크).

## 키 (2종 — 포털이 다름)

| 환경변수 | 포털 | 대상 API |
|---|---|---|
| `DATA_GO_KR_KEY` | data.go.kr (Encoding 키, 추가 인코딩 금지) | 참가격 #3043385 · 영양표준 #15100066 |
| `MFDS_KEY` | 식품안전나라 인증키 (미설정 시 `DATA_GO_KR_KEY` 재사용) | I1250 · C002 |

## 1) 정규화 (로컬, 1회성)

```bash
export DATA_GO_KR_KEY='...(Encoding 서비스키)...'
export MFDS_KEY='...(식품안전나라 인증키, 다르면)...'

# (A) 참가격 단독 — 100% 실판매가 생필품 (품목보고번호 없음 → 영양 미조인)
python3 normalize.py --source chamgagyeok --out products.jsonl

# (B) 기본 join — 식약처 품목명(볼륨) + 참가격 실가격 + 영양(API 모드) 자동 조인
python3 normalize.py --source join --limit 2000 --out products.jsonl

# (B') 영양 CSV 모드(권장) — 포털에서 #15100066 CSV 내려받아 확정 한글 헤더로 파싱
python3 normalize.py --source join --nutrition-csv 통합식품영양성분정보_가공식품.csv --out products.jsonl

# (B'') 원재료 텍스트까지 (C002, 건당 1콜 — 기본 300건 cap)
python3 normalize.py --source join --nutrition-csv ... --ingredients --ingredients-cap 300

# 영양 API 필드명 진단 — 매칭 0건일 때 실제 키 확인 후 NUTRI_KEYS 보정
python3 normalize.py --dump-keys

# (C) 키 없이 — 동봉 샘플(24종, 영양 14건 포함)
python3 normalize.py --from-sample --out products.jsonl
```

**영양 조인 메커니즘**: 식약처 I1250 의 `PRDLST_REPORT_NO` == #15100066 의 `품목제조보고번호`
**exact join** (fuzzy 아님 — 동음이의 충돌 없음). 기준량이 100g/100mL 인 행만 채택하므로
칼로리 계산은 `(값/100) × 섭취량 g` 으로 단순하다. 미매칭 상품은 영양 null 유지(추정 채움 금지).

**참가격 가격 메커니즘**: `getProductPriceInfoSvc` 는 조사일(`goodInspectDay`, **매주 금요일**)만 유효 →
미지정 시 최근 금요일들을 역순으로 자동 탐색. goodId 별로 여러 판매점 가격의 **중앙값**을 대표가로 사용.

출력 한 줄 = 한 상품 (영양/원재료/원산지/조인키는 값 있을 때만):
`{"name","price","stock","brand","description","category",
  "energyKcal","carbohydrateG","proteinG","fatG","sugarG","sodiumMg",
  "ingredients","originCountry","itemReportNo"}` (price>0 — Money 불변식, 영양 100g 기준)

## 2) 적재 (search:batch seed job)

로컬:
```bash
SEED_PATH=$(pwd)/products.jsonl REINDEX_SOURCE=seed \
  PRODUCT_SERVICE_URL=http://localhost:8081 \
  ./gradlew :search:batch:bootRun --args='--spring.batch.job.enabled=true --spring.batch.job.name=productSeedIngestJob'
```

K8s(OCI): `k8s/base/search-batch/job-product-seed.yaml` (commerce/search-batch 이미지 재사용).
seed JSONL 은 ConfigMap/PVC/initContainer 로 `/seed/products.jsonl` 에 주입한다.

## 3) 검증 (칼로리 필터)

```bash
curl -G localhost:8083/api/search/products --data-urlencode 'keyword=김치' --data-urlencode 'maxKcal=100'
# → 종가집 포기김치(29kcal), 응답에 energyKcal/carbohydrateG/.../ingredients/originCountry 동봉
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `REINDEX_SOURCE` | `api` | `seed` 로 설정해야 ProductSeedIngest* 빈 활성화 |
| `SEED_PATH` | `/seed/products.jsonl` | 적재할 정규화 JSONL 경로 |
| `SEED_CHUNK_SIZE` | `500` | bulk API 청크 크기 (≤1000) |
| `PRODUCT_SERVICE_URL` | `http://localhost:8081` | product 서비스 base URL |
| `DATA_GO_KR_KEY` | — | 참가격·영양표준 (data.go.kr Encoding 키) |
| `MFDS_KEY` | `DATA_GO_KR_KEY` | 식품안전나라 I1250/C002 인증키 |
