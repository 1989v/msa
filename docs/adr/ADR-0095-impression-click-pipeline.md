# ADR-0095 — 노출·클릭 원장: 대상 × 동작 두 축과 계층 위치

- 상태: 제안 (2026-09-14)
- 관련: ADR-0017(analytics 스코어링), ADR-0044(recommendation), ADR-0050(검색 평가·밴딧),
  ADR-0070(place 수집 배치), ADR-0074(wishlist 다형 대상), ADR-0077(원장 보존기간),
  ADR-0081(ranking — payload 로 이질성 흡수), ADR-0031(NetworkPolicy)

## 맥락

「노출은 됐는데 클릭이 안 된 것」을 알고 싶다. 이 수치가 없으면 목록 순서·지면 구성을
바꿔도 나아졌는지 알 수 없다.

지금 실측 상태는 이렇다 (2026-09-14).

| 무엇 | 상태 |
|---|---|
| ClickHouse `analytics` DB | 있음. **테이블 없음** — 디스크 70MiB 는 전부 system |
| `analytics` 파드 | 120일째 `Processed 0 total records` |
| Kafka `analytics.event.collected` | 소비자 2(analytics·recommendation). **발행자 0** |
| `search.impression.logged` / `search.click.logged` | 소비자 있음(밴딧). **발행자 0** |
| FE → 서버 이벤트 전송 | 없음 |

조각은 대부분 있는데 **양끝이 비어 있다.** 스키마가 비어 있는 이유는 마이그레이션이
「수동 적용」 전제였기 때문이다 (V004 주석: `clickhouse-client < V004__events.sql`).
사람이 하게 둔 절차는 하지 않은 절차가 된다.

그리고 지금 모델에는 두 가지 구조 문제가 있다.

**① `event_type` 이 대상 × 동작을 한 축으로 눌러 놨다.**

```
SEARCH_KEYWORD · PAGE_VIEW · PRODUCT_VIEW · PRODUCT_CLICK · ADD_TO_CART · ORDER_COMPLETE …
        └ 대상 ┘ └ 동작 ┘
```

대상이 늘면 enum 이 **대상 수 × 동작 수**로 자란다. 질의도 어색해진다 — 「전 서비스 노출」을
세려면 `event_type IN (…)` 목록을 손으로 유지해야 하고, 빠뜨리면 조용히 적게 센다.

**② 대상 식별자가 `product_id` 하나로 박혀 있다.** 관광지를 넣으면 `attraction_id`,
블로그면 `post_id` — 대상마다 nullable 컬럼이 는다. ADR-0081 이 ranking 에서 같은 함정을
만나 「정규 컬럼으로 펴면 nullable 30개가 된다」고 판단한 것과 같은 모양이다.

**지금 원장에 한 행도 없다.** 스키마를 바로잡을 수 있는 유일한 시점이다.

## 결정

### 1) 대상과 동작을 두 축으로 가른다

```
entity_type  ATTRACTION · PRODUCT · POST · GAME …     무엇이
action       IMPRESSION · CLICK                        어떻게 되었나
entity_id    String                                    체계가 대상마다 달라 문자열
```

「전 서비스 노출」은 `WHERE action='IMPRESSION'` 이면 된다. 대상이 늘어도 **행만 늘고
스키마는 그대로**다. 다형 대상을 문자열 키로 두는 것은 wishlist 의 `targetKey`(ADR-0074)와
같은 선택이다.

### 2) 노출 위치는 계층으로 남긴다 — 한 축으로 누르면 원인을 못 가린다

```
screen_type    화면 종류 (상수)        PLACE_HUB · ATTRACTION_DETAIL · PLACE_REGION
screen_ref     그 화면의 주체          상세면 그 관광지 id. 목록 화면이면 NULL
section_id     섹션 고유 id            NEARBY_ATTRACTIONS · AMENITY_CAROUSEL · POPULAR_LIST
section_index  화면 안 섹션 순서       섹션 배치는 바뀐다 — 그때 값으로 남아 있어야 비교가 된다
item_index     섹션 안 순서            캐로셀 내 위치를 포함한다
```

`position` 하나로 두면 **「캐로셀 3번째」와 「3번째 섹션」이 구분되지 않는다.**
CTR 은 지면마다·순서마다 다른 수치라, 섞으면 「노출은 많은데 클릭이 없다」의 원인을 못 가린다.

`section_index` 를 값으로 남기는 이유는 배치가 가변이기 때문이다 — 나중에 섹션을 옮기면
과거 데이터의 위치를 복원할 수 없다.

`screen_ref` 가 필요한 이유: 「관광지 A 상세에서 관광지 B 가 노출됐다」를 알아야
주변 명소 추천이 쓸모 있는지 판정할 수 있다.

### 3) 노출↔클릭은 `view_id` 로 잇는다

같은 화면 한 벌을 식별하는 키다. 밴딧이 쓰던 `searchId` 를 검색 밖으로 일반화한 것이다
(관광지는 검색이 아닌 경로로도 노출된다 — 허브·주변 명소·지역 드릴다운).

같은 `view_id` + `entity_id` 는 **노출 1회로 센다.** 스크롤로 오갔다고 노출이 늘면 CTR 이
분모부터 틀린다.

### 4) 스키마는 기동 시 멱등 적용한다

`analytics` 가 뜰 때 `clickhouse/analytics/*.sql` 을 순서대로 적용한다. 전부
`CREATE TABLE IF NOT EXISTS` 라 여러 번 돌아도 안전하다. **소유한 서비스가 자기 스키마를
책임진다** — 사람 손을 전제하면 120일 빈 채로 도는 일이 또 생긴다.

### 5) 역할 경계 — analytics 는 사실, recommendation 은 판단

| | analytics | recommendation |
|---|---|---|
| 다루는 값 | **모두에게 같은 값** (집계된 사실) | **맥락마다 다른 값** (개인화) |
| 소유 | 원장·ClickHouse 스키마·집계 산출물 | 추천 결과(Redis 서빙) |
| 의존 | 없음 | analytics 산출물을 읽는다 |

집계를 recommendation 으로 모으지 않는다. 소비자가 추천만이 아니고(링크 수집 배치·검색
랭킹·실험 지표), 그러면 추천을 안 쓰는 경로가 추천 서비스에 의존하게 되며, 의존 방향이
`recommendation → analytics` 에서 뒤집혀 순환이 생긴다. `:recommendation:feature` 가
`engagement:app` 에 폴드된 상태(ADR-0093)라 무거운 집계가 사용자 서빙과 자원을 다투게 되는
문제도 있다.

### 6) 소비 — 전용 집계 표로 노출한다

```
analytics.events  (원장)
  └→ 집계 → analytics.attraction_popularity_daily   (analytics 소유)
       └→ place-ingest --job=links 가 이 표만 읽는다
```

`recommendation` 이 `analytics` DB 안의 `recommendation_*` 전용 표를 읽는 것과 같은 형태다.
**공용 원장(`events`)에 직접 붙이지 않는다** — 원장 스키마가 바뀌어도 집계 표 계약만 지키면
소비자가 안 깨진다.

place-ingest 가 이 표를 읽는 이유는 `links` 잡 하나 때문이다. YouTube search.list 는
하루 100건(10,000 units ÷ 건당 100)이라 **관광지 59,735곳 전량에 약 1.6년**이 걸린다.
어디에 그 100건을 쓸지가 이 잡의 핵심 결정이고, 그 근거가 인기 집계다.
TourAPI 운영계정 승인은 여기에 영향이 없다 — 링크는 data.go.kr 이 아니다.

### 7) 밴딧 토픽을 원장으로 흡수한다

`search.impression.logged`·`search.click.logged` 는 발행자가 없어 사실상 죽어 있다.
같은 개념(노출/클릭)이 두 경로로 갈리면 수치가 어긋나므로, 밴딧 컨슈머가 공통 원장 토픽을
구독하도록 바꾸고 두 토픽은 없앤다.

## FE 노출 감지

```
IntersectionObserver
  ├ 면적 50% 이상 · 연속 1초 이상          스쳐 지나간 것은 노출이 아니다
  ├ (view_id, entity_id) 로 1회만          되돌아와도 다시 세지 않는다
  └ 모아서 전송
       ├ 5초마다 또는 20건
       └ pagehide / visibilitychange 에 sendBeacon   이탈 직전 노출을 잃지 않게
```

카드 20장에 요청 20개를 보내지 않는다. 클릭은 같은 `view_id` 로 보내 조인한다.

## 결과

- 대상이 늘어도 스키마가 안 자란다. enum 곱셈이 사라진다.
- 「어느 화면 · 어느 섹션 · 그 안 몇 번째」가 남아 CTR 을 지면별·순서별로 가를 수 있다.
- 관광지 인기 신호가 `/links` 조회 부수효과에서 떨어져 나온다 — 사용자 요청 경로에서
  DB 쓰기가 사라지고, 링크 수집은 더 정확한 신호로 예산을 쓴다.

## 하지 않는 것

- 실시간 집계. 링크 배치는 하루 단위면 충분하고, 밴딧은 기존 Redis 경로를 쓴다.
- 개인 식별. `visitor_id`/`session_id` 는 익명 키다 (ADR-0078 최소 식별 원칙).
- 보존기간 신설. ADR-0077 의 조회 90일을 그대로 따른다 (`TTL 90 DAY`).

## 남은 위험

- **노출 이벤트는 조회보다 수가 많다.** 목록 한 화면이 20건을 만든다. 무료 단일 노드라
  배치 전송·중복 제거로 눌러야 하고, 실제 유입에서 한 번 재야 한다.
- 기존 `EventType` 을 쓰는 코드(스트림 토폴로지·약지도 판정·recommendation fan-out)를 같이
  고쳐야 한다. 지금 실데이터가 0이라 위험은 낮지만 범위는 있다.
