# Ranking Service — 랭킹 리더보드 (ADR-0081)

"아무거로나 순위를 매겨 보여주는 곳." P1 은 **주유소**다.
`rank.1989v.com` — code-dictionary:app 에 폴드된 라이브러리 + 별도 수집 CronJob.

## Modules

| Gradle / 경로 | 역할 |
|---|---|
| `:ranking:domain` | 순수 Kotlin — 보드·스냅샷·엔트리·등락·순위 산정. Spring/JPA 없음 |
| `:ranking:feature` | Spring 라이브러리(비-bootable) — 조회 API · 스냅샷 배치 |
| `ranking/ingest` | Python CronJob — 오피넷 유가 API 수집 → 좌표 변환 → 내부 API 적재 |

스키마·마이그레이션은 **호스트(code-dictionary)가 소유**한다 (`V20__ranking.sql`).
deal/blog 과 같은 형태 — 전용 datasource 를 두지 않는다.

## Commands

```bash
./gradlew :ranking:domain:test      # 도메인 (Spring context 없음)
./gradlew :ranking:feature:test     # 조회 서비스·DTO 왕복
cd ranking/ingest && python3 -m tests.test_katec && python3 -m tests.smoke_test
```

## 이 서비스에서 조용히 틀리는 곳

### 0. 우리가 아는 주유소는 전국 전량이 아니다

현재 수집은 시군구 × 유종의 **최저가 TOP20** 이라 데이터셋은 **싼 주유소 상위 20곳**(약 5,000곳)이다.
"최저가 랭킹"이 목적이라 목적과 겹치지만, **화면이 "전국 모든 주유소"라고 말하면 거짓**이 된다.
개발가이드에 `주유소 판매가격정보(지역별)`(전량+가격)이 있으면 오퍼레이션 맵 한 곳만 고쳐 넘어간다.

### 1. 좌표 형태가 오퍼레이션마다 다르다

`GIS_X_COOR`/`GIS_Y_COOR` 는 위경도가 아니라 **KATEC(TM128)** 이고, 위경도로 주는 오퍼레이션도
있다. KATEC 은 십만 단위라 그럴듯해 보이고 그대로 저장하면 **지도 핀만 전부 어긋난다.**
반대로 **이미 위경도인 값을 또 변환하면 한반도 밖으로 날아간다** — 형태를 판정해 한 번만
변환하고 원천 좌표도 남긴다. 기대값은 우리 코드가 아니라 **PROJ 로 뽑았다**
(`tests/test_katec.py`).

### 2. 폴드 배선 세 군데

`scanBasePackages` / EMF `.packages(...)` / `@EnableJpaRepositories`.
하나라도 빠지면 기동 실패가 아니라 **조용한 404** 라 배포가 성공한 것처럼 보인다.

### 3. 적재는 전체 동기화다

`/internal/ranking/gas/stations/bulk` 는 보내지 않은 필드를 null 로 덮고, 보내지 않은 유종의
가격 행을 지운다. 그래서 수집기는 유종을 **주유소 단위로 모아** 보낸다.
`GasStationDtoRoundTripTest` 가 "적재 가능 필드 = 조회 가능 필드"를 리플렉션으로 강제한다.

### 4. 순위는 스냅샷이다

`latestSnapshotId` 는 엔트리를 **다 쓴 뒤에** 건다. 먼저 걸면 배치가 도는 동안 조회가 반쪽
스냅샷을 읽는다. `prevRank = null` 은 **신규 진입**이지 0 이나 최하위가 아니다.

### 5. 사용자 요청 경로에 외부 호출이 없다

주유소·가격은 매일 받아둔 DB 만 읽는다. 유가 API 를 요청 경로에서 부르면 인기가 생기는 순간
일일 한도가 터진다. 유료 오퍼레이션(**시도별** 평균가·상호 검색·기간 통계)은 부르지 않는다.

길안내도 우리가 하지 않는다 — **구글맵 Maps URLs 링크**로 넘긴다(키·쿼터 없음).
경로 API 를 직접 부르면 출발지가 전국에 흩어져 캐시가 듣지 않고 호출 수가 사용자 수를 따라간다.

한도 초과는 **HTTP 200 + 본문 `resultCode`** 로 온다 — 상태코드만 보면 성공으로 읽는다.

## API

| Method | Path | 비고 |
|---|---|---|
| GET | `/api/v1/ranking/boards` | 보드 목록 (`domain`·`scope` 필터) |
| GET | `/api/v1/ranking/boards/{slug}` | 최신 스냅샷 + 등락 |
| GET | `/api/v1/ranking/gas/areas` | 보드가 있는 지역만 |
| POST | `/internal/ranking/gas/stations/bulk` | 수집기 전용. ingress 미노출 |
| POST | `/internal/ranking/gas/boards/rebuild` | 〃 |

게이트웨이 라우트는 `/api/v1/ranking/**` 만 연다. 라우트를 빠뜨리면 배포는 성공하고
화면만 404 다.

## 키

| 키 | Secret / ConfigMap | 없으면 |
|---|---|---|
| `OPINET_API_KEY` | `ranking-ingest-secrets/opinet-api-key` | 수집 잡이 "아직 안 켬"으로 정상 종료 (샘플 JSONL 로 개발 가능) |

**포털 키로는 부를 수 없다.** 포털의 한국석유공사 항목은 `API 유형: LINK` 라 중계하지 않고
바로가기만 걸어둔 것이다 — opinet.co.kr 에서 직접 받는다. 인증 파라미터도 `code` 다.


## 다음 슬라이스

| 도메인 | 원천 | 랭킹 축 |
|---|---|---|
| 업종(빵집·고기집 등) | LOCALDATA 지방행정인허가 | 업력 · 밀도 · 월별 개폐업 증감 |
| 생필품 | 참가격 + 식약처 영양 (**적재 파이프라인 이미 있음**) | 실판매가 · kcal/나트륨 |
| 전 도메인 | 우리 조회수·투표 | 선호 |

## Related

- 결정 → `docs/adr/ADR-0081-ranking-leaderboard-platform.md`
- 스펙 → `docs/specs/2026-08-23-ranking-leaderboard/`
- 원천 대장 → `docs/architecture/data-sources.md` §8·§9
- 수집기 → `ranking/ingest/README.md`
