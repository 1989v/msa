-- ADR-0095 — 노출·클릭 원장을 **대상 × 동작 두 축**으로 다시 세운다.
--
-- V004 의 `event_type` 은 대상과 동작을 한 축에 눌러 놨다(PRODUCT_VIEW·PRODUCT_CLICK…).
-- 대상이 늘면 enum 이 대상 수 × 동작 수로 자라고, 「전 서비스 노출」을 세려면
-- `event_type IN (…)` 목록을 손으로 유지해야 한다 — 빠뜨리면 조용히 적게 센다.
--
-- **DROP 하는 이유**: 이 표는 한 번도 만들어진 적이 없다. 2026-09-14 운영 ClickHouse 확인
-- 결과 `analytics` DB 는 있고 그 안에 테이블이 없다(디스크 70MiB 는 전부 system). V004 가
-- 「수동 적용」 전제였고 아무도 적용하지 않았다. 지울 데이터가 없는 지금이 바로잡을 유일한
-- 시점이다. IF EXISTS 라 적용된 적 없는 환경에서도 안전하다.
DROP TABLE IF EXISTS analytics.events;

CREATE TABLE IF NOT EXISTS analytics.events
(
    event_id      String,

    -- ── 무엇이 / 어떻게 되었나 — 두 축 ──
    entity_type   LowCardinality(String),   -- ATTRACTION · PRODUCT · POST · GAME
    entity_id     String,                   -- 체계가 대상마다 달라 문자열 (wishlist targetKey 와 같은 선택)
    action        LowCardinality(String),   -- IMPRESSION · CLICK

    -- ── 어디에 보였나 — 계층으로 남긴다 ──
    -- 한 축으로 누르면 「캐로셀 3번째」와 「3번째 섹션」이 구분되지 않는다.
    screen_type   LowCardinality(String),   -- PLACE_HUB · ATTRACTION_DETAIL · PLACE_REGION
    screen_ref    String,                   -- 그 화면의 주체(상세면 그 관광지 id). 없으면 ''
    section_id    LowCardinality(String),   -- NEARBY_ATTRACTIONS · AMENITY_CAROUSEL
    section_index Nullable(Int32),          -- 화면 안 섹션 순서 — 배치가 가변이라 그때 값으로 남긴다
    item_index    Nullable(Int32),          -- 섹션 안 순서 (캐로셀 내 위치 포함)

    -- ── 누가 / 언제 ──
    -- view_id: 같은 화면 한 벌. 노출↔클릭을 잇고, 같은 (view_id, entity_id) 는 1회로 센다.
    -- 스크롤로 오갔다고 노출이 늘면 CTR 이 분모부터 틀린다.
    view_id       String,
    visitor_id    String,                   -- 익명 키 (ADR-0078 최소 식별)
    session_id    String,
    user_id       Nullable(Int64),
    timestamp     DateTime64(3),

    -- 대상별로 다른 부가 정보. 정규 컬럼으로 펴면 nullable 이 계속 는다 (ADR-0081 과 같은 판단).
    payload       String,

    experiment_ids      Array(Int64),
    experiment_variants Array(String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(timestamp)
-- 질의는 거의 「어느 대상의 어느 동작」으로 시작한다 — 정렬 키 앞에 둔다.
ORDER BY (entity_type, action, timestamp)
-- ADR-0077 — 조회 원장 90일. `/privacy` §6 에 적힌 숫자와 같아야 한다.
TTL toDateTime(timestamp) + INTERVAL 90 DAY;
