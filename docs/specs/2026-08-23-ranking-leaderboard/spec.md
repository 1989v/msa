# 랭킹 리더보드 플랫폼 — Spec (P1: 주유소)

> 결정 근거는 ADR-0081. 이 문서는 **무엇을 어떻게 만드는가**만 적는다.
> 열린 항목은 `open-questions.yml`.

## 1. 범위

| 넣는다 | 뺀다 |
|---|---|
| 공통 리더보드 엔진 (보드·스냅샷·엔트리) | 사용자 투표·조회수 축 (P3) |
| 시군구별 최저가 20곳 일 1회 수집 | 실시간 가격 조회 · 전국 전량 |
| 시군구 × 유종 최저가 보드 자동 생성 | 유료 API(시도별 평균가·상호검색·기간통계) |
| 경로상 주유소 탐색 | 정밀 이탈시간(경유지 재호출) |
| `rank.1989v.com` 화면 | LOCALDATA·참가격 도메인 (P2) |

## 2. 모듈

```
ranking/domain    순수 Kotlin — 보드·스냅샷·엔트리·등락·순위 산정. Spring/JPA 없음
ranking/feature   Spring — 조회 API · 스냅샷 배치 · 경로 탐색 · 내부 적재 API
ranking/ingest    Python CronJob — 오피넷 수집 → 좌표 변환 → 내부 API 로 upsert
portal-fe         rank.1989v.com 호스트 분기 화면
```

`ranking:domain` + `ranking:feature` 는 **`code-dictionary:app` 에 폴드**한다(ADR-0081 §7).

## 3. 도메인 (`ranking:domain`)

### 3.1 모델

```kotlin
enum class RankingDomain { GAS_STATION }          // P2 에서 BUSINESS, PRODUCT 추가

enum class RankingMetric { FUEL_PRICE }           // 무엇으로 줄세우나

enum class SortDirection { ASC, DESC }            // 최저가는 ASC, 인기는 DESC

class RankingBoard(
    val slug: String,           // "gas-11680-b027"
    val domain: RankingDomain,
    val metric: RankingMetric,
    val direction: SortDirection,
    val scopeKey: String,       // 오피넷 지역코드
    val title: String,
    val unit: String,           // "원/L"
    val sourceLabel: String,    // "한국석유공사 오피넷"
)

class RankingSnapshot(val boardId: Long, val capturedAt: Instant, val entryCount: Int)

class RankingEntry(
    val rank: Int,
    val subjectKey: String,     // "gas:A0019329" — opaque, wishlist targetKey 규약
    val subjectName: String,
    val score: BigDecimal,
    val prevRank: Int?,         // null = 신규 진입
    val payload: Map<String, Any?>,
) {
    val movement: Movement get() = Movement.of(rank, prevRank)
}

sealed interface Movement {
    data object New : Movement
    data object Same : Movement
    data class Up(val places: Int) : Movement
    data class Down(val places: Int) : Movement
}
```

### 3.2 순위 산정 — `Ranker`

점수가 매겨진 대상 목록을 받아 엔트리를 만든다. **동점은 같은 순위, 다음 순위는 건너뛴다**
(1, 1, 3 — standard competition ranking).

이전 스냅샷의 `subjectKey → rank` 맵을 함께 받아 `prevRank` 를 채운다.
**이전에 없던 대상은 `prevRank = null`(NEW)** 이지, 0 이나 최하위가 아니다.
**이번에 없는 대상은 엔트리를 만들지 않는다** — 이전 순위가 유령으로 남으면 안 된다.

> 도메인은 "무엇이 좋은 주유소인지" 모른다. 점수는 이미 매겨져서 들어온다.

## 4. 스키마 — `V20__ranking.sql`

`code-dictionary:app` 의 마이그레이션에 붙는다(현재 최신 V19). 스키마를 공유하는
deal·blog 과 같은 자리다.

> **커밋한 마이그레이션은 되고치지 않는다.** main 이 곧 배포 브랜치라 이미 적용됐을 수 있고,
> 체크섬이 어긋나면 서비스가 죽으며 태그 롤백도 듣지 않는다. 수정은 항상 새 버전으로.

```sql
CREATE TABLE ranking_board (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  domain VARCHAR(30) NOT NULL,           -- enum STRING
  metric VARCHAR(30) NOT NULL,
  direction VARCHAR(4) NOT NULL,
  scope_key VARCHAR(20) NOT NULL,
  scope_name VARCHAR(60) NOT NULL,
  title VARCHAR(150) NOT NULL,
  subtitle VARCHAR(200) NULL,
  unit VARCHAR(20) NOT NULL,
  source_label VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  latest_snapshot_id BIGINT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  KEY idx_board_domain_scope (domain, scope_key)
);

CREATE TABLE ranking_snapshot (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  board_id BIGINT NOT NULL,
  captured_at DATETIME(6) NOT NULL,
  entry_count INT NOT NULL,
  KEY idx_snapshot_board_time (board_id, captured_at DESC)
);

CREATE TABLE ranking_entry (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  snapshot_id BIGINT NOT NULL,
  rank_no INT NOT NULL,                  -- `rank` 는 MySQL 8 예약어
  subject_key VARCHAR(120) NOT NULL,
  subject_name VARCHAR(200) NOT NULL,
  score DECIMAL(18,4) NOT NULL,
  prev_rank INT NULL,                    -- NULL = 신규 진입
  payload JSON NULL,
  KEY idx_entry_snapshot_rank (snapshot_id, rank_no)
);

CREATE TABLE gas_station (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  opinet_id VARCHAR(30) NOT NULL UNIQUE, -- UNI_ID
  name VARCHAR(200) NOT NULL,
  brand_code VARCHAR(10) NULL,
  brand_name VARCHAR(50) NULL,
  is_self BOOLEAN NOT NULL DEFAULT FALSE,
  katec_x DECIMAL(14,4) NULL,            -- 원천 보존 (변환 전)
  katec_y DECIMAL(14,4) NULL,
  latitude DECIMAL(10,7) NULL,           -- 파생 (WGS84)
  longitude DECIMAL(10,7) NULL,
  area_code VARCHAR(10) NULL,            -- 오피넷 지역코드
  road_address VARCHAR(300) NULL,
  jibun_address VARCHAR(300) NULL,
  tel VARCHAR(30) NULL,
  has_car_wash BOOLEAN NULL,
  has_maintenance BOOLEAN NULL,
  has_cvs BOOLEAN NULL,
  is_24h BOOLEAN NULL,
  synced_at DATETIME(6) NOT NULL,
  KEY idx_station_area (area_code),
  KEY idx_station_geo (latitude, longitude)
);

CREATE TABLE gas_station_price (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  station_id BIGINT NOT NULL,
  product_code VARCHAR(10) NOT NULL,     -- B027 휘발유 / D047 경유 / …
  price INT NOT NULL,
  traded_at DATE NULL,
  updated_at DATETIME(6) NOT NULL,
  UNIQUE KEY uk_price_station_product (station_id, product_code)
);
```

FK 는 두지 않고 **FK-as-ID** 로 간다(`jpa-persistence.md`). enum 은 STRING.

## 5. 수집기 — `ranking/ingest`

`place/ingest` 와 같은 형태(Python + Dockerfile + CronJob). 키가 없으면 **조용히 건너뛴다.**

```
--job=gas-stations   오피넷 → 좌표 변환 → POST /internal/ranking/gas/stations/bulk
--job=gas-boards     적재분으로 시군구 × 유종 보드 스냅샷 생성 트리거
```

### 5.1 호출 전략 (개정 2026-08-23 — 원천을 공공데이터포털로)

**시군구 × 유종의 `지역별 최저가 TOP20` 순회** — 약 500콜/일.

포털이 주는 5종에는 **지역 단위 전량+가격이 없다**. 가격을 주는 지역 단위 경로가 TOP20 뿐이라,
우리가 아는 것은 **시군구별 싼 주유소 상위 20곳**(전국 약 5,000곳)이다. "최저가 랭킹"이
목적이라 데이터셋이 목적과 겹치지만 **전국 전량은 아니다** — 경로 탐색 화면이 그 범위를 밝힌다.

한도 초과는 **HTTP 200 + 본문 `resultCode`** 로 온다. 만나면 **그 실행을 즉시 멈춘다.**
부분 적재를 남기면 다음 전체 동기화가 나머지를 지운다.

### 5.2 좌표 변환

`GIS_X_COOR`/`GIS_Y_COOR` 는 **KATEC(TM128)** 이고, 위경도로 오는 오퍼레이션도 있다.
KATEC 이면 WGS84 로 변환해 `latitude`/`longitude` 에 넣고 **원본도 `katec_x`/`katec_y` 에 남긴다.**
**이미 위경도면 변환하지 않는다** — 변환된 값을 또 변환하면 한반도 밖으로 날아간다.

> 변환을 빼먹으면 값이 십만 단위라 그럴듯한 채로 지도 핀만 전부 어긋난다. 골든 좌표 테스트로 막는다.

### 5.3 전체 동기화 규약

`/internal/ranking/gas/stations/bulk` 는 **전체 동기화**다 — 보내지 않은 필드는 null 이 된다.
그래서 `data-sources.md` §0 ③ 의 왕복 규약을 그대로 적용한다:

| 방향 | 자리 |
|---|---|
| 보낼 때 | `ranking/ingest` 의 `UPSERT_FIELDS` |
| 읽을 때 | `GasStationResponse` (조회 응답 DTO) |

`GasStationDtoRoundTripTest` 가 "적재할 수 있는 필드는 전부 조회로 되읽을 수 있어야 한다"를
리플렉션으로 강제한다.

## 6. API

| Method | Path | 용도 | Tier |
|---|---|---|---|
| GET | `/api/v1/ranking/boards` | 보드 목록 (domain·scope 필터) | 1 |
| GET | `/api/v1/ranking/boards/{slug}` | 최신 스냅샷 엔트리 + 등락 | 1 |
| GET | `/api/v1/ranking/gas/areas` | 시도·시군구 선택지 (오피넷 지역코드) | 1 |
| POST | `/api/v1/ranking/gas/route` | 경로상 주유소 탐색 | 2 (외부 1콜) |
| POST | `/internal/ranking/gas/stations/bulk` | 수집기 전용 — 클러스터 내부 | — |

응답은 `ApiResponse<T>`. `/internal/**` 은 ingress 에 노출하지 않는다(ADR-0070 §3 패턴).

**게이트웨이에 `/api/v1/ranking/**` 라우트를 추가한다.** 빠뜨리면 배포는 성공하고 화면만 404 다
(`/api/v1/tech/**` 에서 실제로 겪음).

지역 계층은 **오피넷 `지역코드 조회`** 로 자체 확보한다. place 서비스를 부르지 않는다 —
네트워크 홉과 서비스 결합을 하나 아끼고, 주유소의 지역은 어차피 오피넷 코드계로 온다.

## 7. 경로 탐색

```
POST /api/v1/ranking/gas/route
{ "origin": {lat,lng}, "destination": {lat,lng},
  "productCode": "B027", "detourLimitMin": 5,
  "selfOnly": false, "brands": [] }
```

1. **Google Routes API** 1콜 → encoded polyline
2. 폴리라인 디코드 → 약 3km 간격 샘플 포인트
3. 각 포인트 반경 내 `gas_station` 조회 (**우리 DB만** — 오피넷 실시간 호출 없음)
4. `opinet_id` 로 중복 제거
5. 폴리라인 최근접점까지의 거리로 **이탈 시간 근사** → `detourLimitMin` 초과분 제외
6. 가격 오름차순 정렬 + 경로 평균가 대비 절약액

**이탈 시간은 근사값이다.** "약 N분"으로 표기하고 단정하지 않는다. 후보마다 경유지 재호출을
하면 정확하지만 1건당 1콜이라 월 10,000 무료를 즉시 태운다(OQ-5).

`GOOGLE_ROUTES_API_KEY` 가 없으면 **이 화면만 비활성**, 리더보드는 정상이다.

## 8. FE — `rank.1989v.com`

`portal-fe` 단일 번들 호스트 분기(ADR-0065 place 와 동형). **색인 대상**(deal 과 반대 —
집계·등락이 자체 부가가치다).

- `/` 보드 목록 — 내 지역 자동 선택 없음(위치 권한 요구 안 함), 시도·시군구 선택
- `/boards/:slug` 리더보드 — 순위·가격·등락 배지(NEW/↑n/↓n)·브랜드·셀프
- `/route` 경로 탐색 — 출발·도착 입력, 결과 카드 + 지도

토큰은 **root `DESIGN.md`** 를 따른다. hex 직접 입력 금지.
화면 하단에 **"출처: 한국석유공사 오피넷"** 표기.

**신규 서브도메인 체크리스트 4단계를 전부 탄다** — ingress host 블록 / `App.tsx` host 분기 +
apex 리다이렉트 / 프리렌더 `_hosts/$host` 키 / `serviceHref.ts` 의 `SUBDOMAIN_ORIGIN` 한 줄.

## 9. 폴드 배선 — 세 군데

| 파일 | 더할 것 |
|---|---|
| `CodeDictionaryApplication.kt` | `scanBasePackages` 에 `com.kgd.ranking` |
| `CodeDictionaryJpaConfig.kt` | `@EnableJpaRepositories` 에 `com.kgd.ranking` |
| `DataSourceConfig.kt` | EMF `.packages(...)` 에 `com.kgd.ranking` |

> 하나라도 빠지면 기동 실패가 아니라 **조용한 404** 다. 배포는 성공한 것처럼 보인다.

## 10. 시크릿 / 설정

| 키 | 자리 | 없으면 |
|---|---|---|
| `OPINET_API_KEY` | Secret `ranking-ingest-secrets` | 수집 잡이 건너뛴다 (샘플 JSONL 로 E2E 가능) |
| `GOOGLE_ROUTES_API_KEY` | 앱 Secret | 경로 화면만 비활성 |

Routes 키는 **서버 호출이라 IP 제한**이다. Maps JS 키(리퍼러 제한)와 반드시 분리한다.

## 11. 수용 기준

- [ ] 시군구를 고르면 최저가 주유소 Top N 이 **어제 대비 등락과 함께** 보인다
- [ ] 첫 스냅샷에서는 전부 NEW 로 표기되고 화면이 깨지지 않는다
- [ ] 출발·도착을 넣으면 경로상 주유소가 **약 N분 이탈 + 절약액**과 함께 나온다
- [ ] 수집 CronJob 이 전국을 하루 1회 무료 한도 안에서 돈다
- [ ] 지도의 핀이 실제 주유소 위치에 찍힌다 (KATEC 변환 검증)
- [ ] 화면에 "출처: 한국석유공사 오피넷" 이 있다
- [ ] `data-sources.md` 대장에 오피넷·Google Routes 두 줄이 추가돼 있다
