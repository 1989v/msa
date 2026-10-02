-- 대기 — 에어코리아 측정소정보 MsrstnInfoInqireSvc (getMsrstnList) · 대기오염정보 ArpltnInforInqireSvc (getCtprvnRltmMesureDnsty).
--
-- 이용허락이 공공누리 제3유형(출처표시 · 변경금지)이다. 측정소 하나의 값·등급을 원문 그대로 두고, 여러 측정소를 평균한 값을 만들지 않는다.
-- 측정소 이름이 키다 — 전국 672곳 이름이 겹치지 않는다(2026-10-02). 수집기가 겹침을 보면 보내지 않고 멈춘다.
-- 원천 행은 원문 JSON 으로 통째로 남기고(data-sources.md §0 ①), 좌표·측정 시각·최근접 매핑만 파생 컬럼이다(§0 ②).
-- 화면 요청은 레디스(placeAir::{시군구})에서 나가고, 캐시를 놓칠 때만 아래 표의 PK 행을 읽는다 (ADR-0071 §10).

CREATE TABLE air_station (
    station_name VARCHAR(40) NOT NULL COMMENT '원천 stationName (전국 유일)',
    latitude     DOUBLE      NOT NULL COMMENT '파생: 원천 dmX — 필드 이름과 반대로 위도다',
    longitude    DOUBLE      NOT NULL COMMENT '파생: 원천 dmY — 경도',
    item_raw     JSON        NOT NULL COMMENT 'getMsrstnList 행 원문 (7키)',
    synced_at    DATETIME    NOT NULL COMMENT '마지막으로 받은 시각',
    PRIMARY KEY (station_name)
) COMMENT='대기 측정소 — 주 1회 목록 전량';

CREATE TABLE air_measurement (
    station_name VARCHAR(40) NOT NULL,
    sido_name    VARCHAR(20) NOT NULL COMMENT '원천 sidoName (전남광주 등 원천 표기 그대로)',
    data_time    DATETIME    NULL     COMMENT '파생: 원천 dataTime (KST, 24:00 은 다음 날 00:00). 측정 없음이면 NULL',
    item_raw     JSON        NOT NULL COMMENT 'getCtprvnRltmMesureDnsty 행 원문 (ver=1.0, 23키)',
    fetched_at   DATETIME    NOT NULL,
    PRIMARY KEY (station_name)
) COMMENT='대기 실시간 측정 — 측정소마다 최신 한 행';

-- 시군구마다 측정소 후보 = 그 시군구 관광지 각각의 최근접 측정소 + 대표점의 최근접 측정소. 화면은 후보 가운데 그 관광지에서
-- 가장 가까운 측정소를 고른다 — 대표점 하나로 측정소 하나만 이으면 관광지 → 측정소 중앙값 5.1km · 20km 초과 8.2%,
-- 관광지별 최근접이면 2.2km · 1.7% 다(2026-10-02 운영 국문 관광지 48,725곳). 후보는 시군구당 중앙값 6 · 최대 21.
CREATE TABLE air_station_sigungu (
    sigungu_code VARCHAR(5)  NOT NULL COMMENT 'administrative_regions.code (시군구)',
    station_name VARCHAR(40) NOT NULL COMMENT '측정소 후보 (air_station)',
    distance_m   INT         NULL     COMMENT '파생: 시군구 대표점 → 측정소 거리(m), 대표점이 없으면 NULL',
    attractions  INT         NOT NULL COMMENT '파생: 이 측정소가 최근접인 그 시군구 관광지 좌표 수 (대표점의 최근접일 뿐이면 0)',
    synced_at    DATETIME    NOT NULL,
    PRIMARY KEY (sigungu_code, station_name),
    KEY idx_air_station_sigungu_station (station_name)
) COMMENT='시군구 → 대기 측정소 후보 (측정소 좌표 기준, 받은 시군구는 통째로 교체)';
