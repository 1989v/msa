-- 날씨 — 기상청 단기예보 VilageFcstInfoService_2.0 (getVilageFcst) · 중기예보 MidFcstInfoService (getMidLandFcst · getMidTa).
--
-- 화면 단위는 시군구다. 관광지 좌표 그대로면 고유 격자가 3,671개라 한 회차가 하루 한도를 넘는다 — 시군구 대표점
-- 269(좌표 있는 267) → 고유 격자 243. 매핑은 수집기(place-ingest weather_grid)가 계산해 보낸다.
-- 예보는 새 발표본이 옛 발표본을 바꾼다 — 격자·구역마다 한 행이고 지난 발표본을 쌓지 않는다.
-- 원천 행은 원문 JSON 으로 통째로 남기고(data-sources.md §0 ①), 화면의 일별 값은 읽을 때 원문에서 만든다(§0 ②).
-- 화면 요청은 레디스(placeWeather::{시군구})에서 나가고, 캐시를 놓칠 때만 아래 표의 PK 행을 읽는다 (ADR-0071 §10).

CREATE TABLE weather_sigungu_grid (
    sigungu_code VARCHAR(5)  NOT NULL COMMENT 'administrative_regions.code (시군구)',
    nx           SMALLINT    NOT NULL COMMENT '파생: 대표점 → 기상청 격자 X',
    ny           SMALLINT    NOT NULL COMMENT '파생: 대표점 → 기상청 격자 Y',
    land_reg_id  VARCHAR(8)  NULL     COMMENT '중기 육상 권역 regId (weather_mid_region)',
    ta_reg_id    VARCHAR(8)  NULL     COMMENT '중기 기온 regId (weather_mid_region)',
    ta_match     VARCHAR(16) NULL     COMMENT '파생: 기온 regId 를 고른 근거 NAME|METRO|NEAREST',
    synced_at    DATETIME    NOT NULL COMMENT '마지막으로 받은 시각',
    PRIMARY KEY (sigungu_code),
    KEY idx_weather_grid (nx, ny),
    KEY idx_weather_land (land_reg_id),
    KEY idx_weather_ta (ta_reg_id)
) COMMENT='시군구 → 기상청 단기 격자 · 중기 구역';

CREATE TABLE weather_short_forecast (
    nx         SMALLINT NOT NULL,
    ny         SMALLINT NOT NULL,
    base_at    DATETIME NOT NULL COMMENT '원천 baseDate+baseTime (KST)',
    items_raw  JSON     NOT NULL COMMENT 'getVilageFcst item 전부 원문 (05시 발표 약 900행 · 17시 발표 약 1,050행)',
    fetched_at DATETIME NOT NULL,
    PRIMARY KEY (nx, ny)
) COMMENT='단기예보 — 격자마다 최신 발표본 하나';

CREATE TABLE weather_mid_region (
    reg_id VARCHAR(8)  NOT NULL,
    kind   VARCHAR(8)  NOT NULL COMMENT 'LAND|TA',
    name   VARCHAR(40) NOT NULL COMMENT '기상청 구역코드표 이름 그대로',
    PRIMARY KEY (reg_id)
) COMMENT='중기예보 구역 — 활용가이드 육상 권역 표 + 첨부 중기기온예보구역코드(2025.12) 남한 도시';

CREATE TABLE weather_mid_forecast (
    reg_id     VARCHAR(8) NOT NULL,
    kind       VARCHAR(8) NOT NULL COMMENT 'LAND|TA',
    tm_fc      DATETIME   NOT NULL COMMENT '원천 발표 시각 tmFc (KST)',
    item_raw   JSON       NOT NULL COMMENT 'getMidLandFcst(23키) 또는 getMidTa(43키) 항목 원문',
    fetched_at DATETIME   NOT NULL,
    PRIMARY KEY (reg_id, kind)
) COMMENT='중기예보 — 구역·종류마다 최신 발표본 하나';
