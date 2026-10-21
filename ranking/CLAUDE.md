# Ranking Service — 랭킹 리더보드 (ADR-0081)

"아무거로나 순위를 매겨 보여주는 곳." **주유소·카페 음료**를 비교한다.
`rank.1989v.com` — content:app 에 폴드된 라이브러리 + 별도 수집기.

## Modules

| Gradle / 경로 | 역할 |
|---|---|
| `:ranking:domain` | 순수 Kotlin — 보드·스냅샷·엔트리·등락·순위 산정. Spring/JPA 없음 |
| `:ranking:feature` | Spring 라이브러리(비-bootable) — 조회 API · 스냅샷 배치 |
| `ranking/ingest` | Python CronJob — 오피넷 유가 API 수집 → 좌표 변환 → 내부 API 적재 |

ADR-0093 이후 전용 `ranking_db` 및 `rankingdb/migration` 을 사용한다.
`RankingDataSourceConfig` 가 EMF·Repository·`rankingTransactionManager` 를 배선한다.

## 구조 상태 (ADR-0083)

표준 준수 (2026-08-26, 플랜 P2-1 완료) — `application/{ranking,gas}/{usecase,port,service,dto}` + `infrastructure/persistence/adapter`.
UseCase 인터페이스 5 · Port 4 · Adapter 4. 서비스는 도메인 모델(`GasStation`·`RankingBoard`·`RankingEntry`)만 다루고
JSON payload 직렬화·유종 가격 행 동기화는 어댑터가 한다. 테스트는 Port MockK.

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
| GET | `/api/v1/ranking/cafe/drinks` | 메뉴 부분검색·복수 brand·group·temperature·maxSugar·maxCaffeine·caffeine=none·sort·page/size |
| GET | `/api/v1/ranking/cafe/groups` | 유형별 행 수 |
| GET | `/api/v1/ranking/cafe/brands` | 브랜드별 행 수·공식 출처 URL들·확인일 |
| POST | `/internal/ranking/cafe/drinks/bulk` | 요청에 등장한 브랜드만 트랜잭션으로 교체. ingress 미노출 |

게이트웨이 라우트는 `/api/v1/ranking/**` 만 연다. 라우트를 빠뜨리면 배포는 성공하고
화면만 404 다.


## 카페 음료 슬라이스

공식 영양정보 9브랜드 **1,922행**(2026-10-20). `application/cafe/{usecase,port,service,dto}` →
Querydsl 조회 저장소·JPA Adapter 구조다. 원천 25필드는 개별 컬럼에 남기고 `raw_nutrition` JSON 텍스트와
`notes` 원문을 보존한다. `drink_group` 은 `ranking:domain` 메뉴명 규칙 한 곳에서 파생하며,
`cup_volume_ml`·`volume_source`는 원천 ml 우선 → 빽다방 컵용량 원문 → 투썸 공식 사이즈표 순으로 도메인에서 파생해 적재한다. 원천 `volume_ml`은 덮지 않으며 컵용량이 양수일 때 당류·카페인·열량 100ml당 값을 산출한다. g을 ml로 환산하지 않는다.
V3는 원천 ml가 있는 기존 행만 보강하며, 사이즈표·원문 파생 및 농도 정렬 갱신은 브랜드별 bulk 재적재로 수행한다.

유일키는 `(brand_slug, menu_name, temperature, size_label, caffeine_status)`다.
온도·사이즈 null은 DB에서 빈 문자열로 정규화한다. 이디야 70쌍은 이름이 같아도 일반/디카페인의
영양이 달라 `caffeine_status`로 서로 다른 판을 보존한다. 동기화는 요청 브랜드만 삭제·재적재하며
빈 요청은 삭제하지 않는다. 서비스는 반드시 `rankingTransactionManager`를 사용한다.

카페인 `DISCLOSED/ZERO/DECAF/UNDISCLOSED`를 STRING으로 저장한다. `caffeine=none`은
**ZERO+DECAF만** 포함한다. 미공개를 0으로 바꾸지 않고, 수치 상한 조건은 null을 제외한다.
정렬은 `sugar`(기본)/`caffeine`/`kcal`/`sugarPer100ml` 오름차순, null 마지막, 페이지 size 1~200이다.
`/cafe`는 rank 호스트 화면이며 유형을 고르면 현재 페이지 결과를 브랜드별로 나란히 표시한다.

```bash
cd ranking/ingest
python3 -m src.cafe_load --base-url http://localhost:8097
python3 -m tests.test_cafe_load
```

적재기는 `data/cafe/drinks.*.jsonl`을 읽어 camelCase API 필드로 보내되 raw 키·값은 바꾸지 않는다.
빈 파일은 전송하지 않아 우지·팀홀튼 등의 기존 자료가 지워지지 않는다. 원천 JSONL은 공개 git에서 제외한다.
출처·라이선스·수집 범위 → `docs/architecture/data-sources.md` §9. MySQL 스키마 검증은 Docker가
있을 때 수행하고, Querydsl 필터·정렬·카페인 미공개 배제 회귀는 외부 서비스 없는 H2에서 실행한다.

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

## 카페 주변 비교 (ADR-0113, P2)

- ranking 소유 SOHO 전국 카페/베이커리 배치 → V5 전용 3테이블. place DB/요청 API 재사용 없음.
- `POST /api/v1/ranking/cafe/nearby-search`는 위치 본문만 받는다. 0.5/1/3km, 기본1km.
  `GET /api/v1/ranking/cafe/capability`, `/areas?parent=`로 서버 공개 상태와 실제 지원 지역을 확인한다.
- `POST /internal/ranking/cafe/stores/bulk`는 완전 스냅샷 1회 트랜잭션이다. 빈/부분/급변 입력 거부,
  동일 version 재시도 멱등, 2회 완전 누락 뒤 비활성화. 원천 기준일 null은 수집일로 덮지 않는다.
- 공개 스위치 `ranking.cafe.nearby-verified` 기본 false. 검증 표본·포함률·운영 로그·부하 증거 뒤 설정한다.
  원천/지역 미준비 또는 90일 초과는 스위치가 true여도 비공개. 45일 초과는 지연 안내.
- 키 `SOHO_API_KEY` (`ranking-ingest-secrets/soho-api-key`), 로컬 `DATA_GO_KR_KEY` 대체 가능.
  활용신청 https://www.data.go.kr/data/15012005/openapi.do . 키 없으면 정상 '아직 안 켬' 종료.
- 실행: `cd ranking/ingest && python3 -m src.cafe_stores`. fixture→live fallback은 없다.
  지역 중심점은 `src/data/cafe_areas.json`/provenance의 공식 KMA 대표 위경도, 상위 시군구 코드만 사용.
- 사용자 좌표 로그·URL·React Query 캐시·storage 금지. Google 지도는 공개 매장 위치만 전달한다.
  매장마다 메뉴 판매 미확인·원천/영양 날짜·공식 레시피 안내와 Google 목적지/Naver 지점명 링크를 제공한다.

## 관리자 교정 (ADR-0114, P1)

- `/api/v1/admin/ranking/**`는 gateway `adminConfig`와 서비스의 ads 동일 신원 검사로 `ROLE_ADMIN`만 허용한다.
- V6 `ranking_admin_record`는 자연키별 교정·브랜드 revision/generation·감사·멱등 operation·preview·적재 이력을 원천 FK 없이 보존한다. `cafe_drink_effective`는 공개 조회 전용 투영이며 source/raw/notes는 `cafe_drink`에 그대로 남는다.
- `RankingAdminService`가 교정·최대 200키/5분 유형 preview·필드별 충돌 해결·브랜드 검증·보상 되돌리기를 소유한다. API는 계획서 §6 전체 경로를 따른다. 자연키·카페인 상태·가격은 수정하지 않는다.
- SET_UNKNOWN 용량은 추론과 모든 100ml 값을 중지하고, SET은 ADMIN_VERIFIED, RESET만 원천 추론을 재개한다. 공개 Querydsl 목록/상세/집계/이름/주변 조회는 동일 투영을 읽는다.
- bulk와 관리자 쓰기는 전용 TM 및 동일 DB 잠금을 사용한다. control 잠금으로 신규 operation/brand 잠금 생성을 직렬화하고 브랜드 잠금은 slug 순으로 취득한다. 완료 멱등 결과는 revision/generation/preview보다 먼저 조회한다.
- bulk 시작/실패 원장은 별도 짧은 트랜잭션, 성공 원장·원천·교정 상태·투영·generation·SYSTEM 감사는 하나의 트랜잭션이다. parentRunId로 브랜드별 부분 성공을 묶고 15분 초과 RUNNING은 INTERRUPTED로 진단한다.
- 관리자 감사와 멱등 결과는 `AUDIT_RETENTION_DAYS=365` 정책으로 기존 content retention CronJob의 `RankingRetentionRunner`가 정리한다. `/privacy` §6과 드리프트 테스트로 대조한다. 회원 ID만 기록하며 이름/이메일을 복제하지 않는다.
- 주유소 보드/스냅샷 API는 읽기 전용이다. 도메인 status와 36시간 지연·미생성·포인터/count/순위 정합 진단을 분리한다. 과거 자료 없음은 30일 보관 경과 또는 없음이다.

### P1 운영 계약 보강

- 원천 bulk는 실제 DB column collation으로 대소문자·accent·유니코드 동등 alias를 삭제 전에 거부하고 DECIMAL 정밀도를 명시 검증한다. 애플리케이션 소문자 변환으로 DB 비교를 흉내 내지 않는다.
- nullable 영양값·운영 메모의 SET_UNKNOWN도 지원한다. ZERO는 caffeineMg=0만, UNDISCLOSED 수치 교정은 금지다.
- 교정 근거 URL/확인일/사유·원천 스냅샷·구조화 의존 baseline은 교정 자체에 보존한다. 1년 감사 정리로 미해결 교정의 근거가 사라지지 않는다. 반복 미해결 충돌은 최초 검출 시각/run을 유지한다.
- 공개 응답은 원래 공식 출처와 교정 근거를 구분하고 rawNutrition은 직렬화하지 않는다. 관리자 source/raw 왕복은 유지한다.
- `/operations/{operationId}/revert-preview`는 대상별 현재/복구 상태와 전체 가능 여부를 읽는다. 한 대상의 후속 수정/세대 차이도 전체 실행을 잠근다.
- 적재 이력은 job/actor·잠금 시점 전후 generation·확인일 범위·소요 시간·안전한 오류 요약을 제공하며, PARTIAL은 성공 브랜드가 실제로 있는 경우만 사용한다. orphanedKeys는 필드 수가 아닌 자연키 수다.
