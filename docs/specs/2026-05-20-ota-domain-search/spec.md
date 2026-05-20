<!-- source: search -->
# Spec — OTA 도메인 검색 (OTA-1, OTA-2 상세)

상위 spec: `requirements.md`
선행 인프라: ADR-0050 (search quality) + Phase 3 multi-scope MAB

## 0. 모듈 영향 (OTA-1 + OTA-2 한정)

| 모듈 | 변경 종류 |
|---|---|
| `product` | `regionId` 필드 신설 (Product 도메인 / DB / Kafka 이벤트) |
| (신규) `region/` | Region CRUD 서비스 — 또는 product 모듈 내 sub-package |
| `search:domain` | `ProductDocument.regionId` |
| `search:app` | `ProductEsDocument.regionId`, `MultiScopeBanditBlender` region scope 매핑, `IndexAliasManager` 매핑, synonyms analyzer 재구성 |
| `search:batch` | 평가 잡 region group by — 별도 task |
| `admin-fe` | Region CRUD 페이지 (OTA-1 후속) |

> Phase 3 의 `Product.brand` (T1 완료) 가 `tour-operator-id` 로 매핑되면 seller diversity 가 자연 활용된다. 본 spec 은 region 만 추가.

## 1. OTA-1 — Region 모델

### 1.1 도메인
```kotlin
data class Region(
    val id: String,           // ULID
    val name: String,
    val parentId: String?,    // null = COUNTRY level
    val level: RegionLevel,
    val nameEn: String?,
    val createdAt: Instant
)
enum class RegionLevel { COUNTRY, CITY, DISTRICT }
```

위치: option (a) `product/domain/.../region/` sub-package, option (b) 별도 모듈 `region/`. 본 spec 은 (a) 권장 — product service 책임 확장.

### 1.2 product 도메인 확장
- `Product.regionId: String?` (nullable)
- DB migration: `ALTER TABLE products ADD COLUMN region_id VARCHAR(26) NULL`
- ProductCreatedEvent / ProductUpdatedEvent payload 에 `regionId`

### 1.3 search 측
- `ProductEsDocument.regionId @Field(type = Keyword)`
- IndexAliasManager 매핑 추가
- `MultiScopeBanditBlender.keyFor(scope=region)` → `Region` proxy 추출 (`doc.regionId`)
- application.yml 활성화 예시:
  ```yaml
  search:
    bandit:
      scopes:
        - { name: category, weight: 0.5 }
        - { name: region, weight: 0.5 }
  ```

### 1.4 데이터 시드
- 초기 ~100 region (SQL seed)
- 후속: admin UI CRUD

### 1.5 평가
- `search.eval.variant=region_split` 으로 region 별 NDCG@10 측정
- Grafana 패널 region group by 추가

## 2. OTA-2 — Synonyms

### 2.1 ES analyzer 재구성
```
PUT products
{
  "settings": {
    "analysis": {
      "filter": {
        "ko_synonyms": {
          "type": "synonym_graph",
          "synonyms_path": "analyzers/synonyms-ko.txt",
          "updateable": true
        }
      },
      "analyzer": {
        "nori_with_synonyms": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["ko_synonyms"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "name": { "type": "text", "analyzer": "nori", "search_analyzer": "nori_with_synonyms" }
    }
  }
}
```

> 핵심: `updateable: true` + `_reload_search_analyzers` 로 무중단 갱신.

### 2.2 파일 경로
- ES 노드의 `config/analyzers/synonyms-ko.txt` (운영: ConfigMap mount)
- 초기 시드: `search/app/src/main/resources/synonyms-ko.txt` (배포 시 mount)

### 2.3 운영 절차
```bash
# 1. ConfigMap 갱신
kubectl create configmap es-synonyms-ko --from-file=synonyms-ko.txt --dry-run=client -o yaml | kubectl apply -f -

# 2. ES 무중단 reload (search-time analyzer 만 갱신 — index-time 은 reindex 필요)
curl -X POST "http://elasticsearch:9200/products/_reload_search_analyzers"
```

### 2.4 A/B
- variant 별 다른 synonyms 운영은 별도 인덱스 alias 필요 (운영 복잡도 ↑) — Phase 후속
- 본 spec OTA-2 는 단일 synonyms 적용

## 3. OTA-3 / OTA-4 (요약)

### 3.1 Attraction
- 별도 spec 필요 — domain 모델 + DB schema + product 연관 + 검색 wire-up
- 본 spec 의 OTA-1/2 가 안정화된 후 진행

### 3.2 Package
- 별도 spec 필요 — pricing rule + 다중 상품 묶음 + 패키지 ranking
- OTA-3 와 직교 (병렬 가능)

## 4. 마이그레이션 시나리오

| 시점 | 액션 |
|---|---|
| D+0 | OTA-1 product `regionId` 머지 (default null) |
| D+3 | region seed + admin CRUD 머지 |
| D+7 | search ES 매핑 + alias swap |
| D+10 | bandit scope region 활성화 (`scopes` 외부화) |
| D+14 | OTA-2 synonyms analyzer 재구성 + reload |
| D+30 | OTA-3 / OTA-4 spec 분리 작성 시작 |

## 5. 회귀 보호

- `Product.regionId` default null → 기존 데이터 영향 없음
- `search.bandit.scopes` 외부화 — region scope 미설정 시 category 단일 (legacy)
- synonyms analyzer 적용 전까지 기존 `nori` 그대로

## 6. 의존성

- product 서비스 도메인 변경 → product 측 ADR 필요 (region 모델 결정)
- region seed 데이터 출처 결정 (자체 vs 외부 API)
- synonyms 파일의 1차 운영자 확정 (운영 도메인 지식 입력)

## 7. 본 spec 이 명시적으로 미결정인 것

- (a) OTA 별도 레포 분리 vs (b) commerce 내 모듈 — 사용자 의사결정 대기
- ML 베이스 query understanding 도입 시점 — ADR-0050 P3 (LinUCB) + ADR-0047 (Wide&Deep) 가 안정화돼야 ROI 측정 가능
