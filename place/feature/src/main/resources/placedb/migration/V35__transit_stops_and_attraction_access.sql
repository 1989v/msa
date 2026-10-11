-- 역·정류장 원천 + 관광지 가는 법(가까운 역·정류장 사전 계산).
--
-- 원천 둘 — 국가철도공단 도시철도 역사정보(KRIC XLSX) · 국토교통부 전국 버스정류장 위치정보(data.go.kr 15067528 CSV).
-- 이용허락범위 제한 없음. 원천 컬럼은 전부 원문 문자열 그대로 두고(data-sources.md §0 ①), 좌표 검사값·날짜만 파생 컬럼이다(§0 ②).
-- 원천 교체는 적재 회차(load_run_id) 단위다 — 수집기가 새 회차로 2,000행 묶음을 쌓고, 다 들어가면 활성화 한 번으로
-- transit_source_run 의 활성 회차를 바꾸고 옛 회차 행을 지운다. 중간 묶음이 실패하면 활성 회차가 그대로다.
-- 원천 표는 화면 요청이 읽지 않는다 — 화면은 attraction_access 사본을 재색인 문서로 받는다 (ADR-0071 §10).

CREATE TABLE transit_rail_station (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    load_run_id        VARCHAR(32)  NOT NULL COMMENT '적재 회차',
    source_key         VARCHAR(300) NOT NULL COMMENT '파생: 자연 키 역번호|노선번호|역사명|노선명 (역번호만으로는 노선별 행이 겹친다)',
    station_no         VARCHAR(20)  NOT NULL COMMENT '원천 역번호',
    station_name       VARCHAR(100) NOT NULL COMMENT '원천 역사명 (「서울역」처럼 「역」으로 끝나는 행이 있다)',
    line_no            VARCHAR(20)  NOT NULL COMMENT '원천 노선번호',
    line_name          VARCHAR(100) NOT NULL COMMENT '원천 노선명',
    station_name_en    VARCHAR(200) NOT NULL COMMENT '원천 영문역사명',
    station_name_hanja VARCHAR(100) NOT NULL COMMENT '원천 한자역사명',
    transfer_type      VARCHAR(40)  NOT NULL COMMENT '원천 환승역구분',
    transfer_line_no   VARCHAR(200) NOT NULL COMMENT '원천 환승노선번호',
    transfer_line_name VARCHAR(500) NOT NULL COMMENT '원천 환승노선명',
    lat_raw            VARCHAR(40)  NOT NULL COMMENT '원천 역위도',
    lng_raw            VARCHAR(40)  NOT NULL COMMENT '원천 역경도',
    operator_name      VARCHAR(100) NOT NULL COMMENT '원천 운영기관명',
    road_address       VARCHAR(300) NOT NULL COMMENT '원천 역사도로명주소',
    phone              VARCHAR(60)  NOT NULL COMMENT '원천 역사전화번호',
    base_date_raw      VARCHAR(40)  NOT NULL COMMENT '원천 데이터기준일자 — ISO · 엑셀 일련번호 · 빈 값이 섞인다',
    lat_value          DOUBLE       NULL     COMMENT '파생: 위도 (숫자가 아니면 NULL)',
    lng_value          DOUBLE       NULL     COMMENT '파생: 경도',
    valid_coord        BOOLEAN      NOT NULL COMMENT '파생: 위도 33–39 · 경도 124–132 안 (밖·뒤바뀜이면 계산에서 뺀다)',
    base_date          DATE         NULL     COMMENT '파생: 기준일 (일련번호는 1899-12-30 기준 일수, 빈 값은 파일 최빈 기준일)',
    loaded_at          DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_transit_rail_station_run_key (load_run_id, source_key)
) COMMENT='도시철도 역사정보 원천 — 회차 단위 전체 교체';

CREATE TABLE transit_bus_stop (
    id                 BIGINT       NOT NULL AUTO_INCREMENT,
    load_run_id        VARCHAR(32)  NOT NULL COMMENT '적재 회차',
    source_key         VARCHAR(80)  NOT NULL COMMENT '파생: 자연 키 도시코드:정류장번호',
    stop_no            VARCHAR(40)  NOT NULL COMMENT '원천 정류장번호',
    stop_name          VARCHAR(100) NOT NULL COMMENT '원천 정류장명',
    lat_raw            VARCHAR(40)  NOT NULL COMMENT '원천 위도',
    lng_raw            VARCHAR(40)  NOT NULL COMMENT '원천 경도',
    collected_date_raw VARCHAR(40)  NOT NULL COMMENT '원천 정보수집일',
    mobile_short_no    VARCHAR(40)  NOT NULL COMMENT '원천 모바일단축번호 (빈 값·0 은 미집계)',
    city_code          VARCHAR(20)  NOT NULL COMMENT '원천 도시코드 (TAGO 도시 코드 — 시군구 코드가 아니다)',
    city_name          VARCHAR(60)  NOT NULL COMMENT '원천 도시명 (옛 이름이 남아 있다)',
    manage_city_name   VARCHAR(40)  NOT NULL COMMENT '원천 관리도시명 (BIS 이름)',
    lat_value          DOUBLE       NULL     COMMENT '파생: 위도',
    lng_value          DOUBLE       NULL     COMMENT '파생: 경도',
    valid_coord        BOOLEAN      NOT NULL COMMENT '파생: 위도 33–39 · 경도 124–132 안',
    collected_date     DATE         NULL     COMMENT '파생: 정보수집일',
    loaded_at          DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_transit_bus_stop_run_key (load_run_id, source_key)
) COMMENT='전국 버스정류장 위치정보 원천 — 회차 단위 전체 교체';

CREATE TABLE transit_source_run (
    source       VARCHAR(8)  NOT NULL COMMENT 'RAIL | BUS',
    run_id       VARCHAR(32) NOT NULL COMMENT '활성 적재 회차',
    row_count    INT         NOT NULL COMMENT '활성 회차 행 수 — 다음 회차의 ±20% 검사 기준',
    activated_at DATETIME    NOT NULL,
    PRIMARY KEY (source)
) COMMENT='원천마다 활성 적재 회차';

-- 버스 원천은 BIS 연계 지자체만 담는다 — 빠진 시군구는 「주변에 정류장 없음」이 아니라 「자료 없음」이다.
-- 수집기가 원천 도시명을 시군구로 이어 시군구마다 정류장 수를 세고, 100개 이상이면 연계 지역으로 본다.
CREATE TABLE transit_bus_coverage (
    sigungu_code VARCHAR(5) NOT NULL COMMENT 'administrative_regions.code (시군구)',
    stops        INT        NOT NULL COMMENT '파생: 이 시군구로 이어진 원천 정류장 수 (광역 도시 행은 그 시도 시군구 전부에 센다)',
    covered      BOOLEAN    NOT NULL COMMENT '파생: 연계 지역 (stops ≥ 100)',
    synced_at    DATETIME   NOT NULL,
    PRIMARY KEY (sigungu_code)
) COMMENT='시군구별 버스 원천 연계 판정 — 버스 회차 활성화 때 통째로 교체';

-- 관광지마다 가까운 역(직선 2,000m 안) 2곳 · 정류장(500m 안) 2곳. 원천 행을 대리 키로 참조하지 않는다 — 자연 키와 이름·노선
-- 사본을 둔다. 그래서 조회에 조인이 없고, 원천 회차가 바뀌는 사이에도 결과가 그대로 읽힌다.
-- 보낸 관광지의 행은 통째로 바뀌고, 계산 회차(computed_at)가 끝나면 그보다 앞선 행(이번 회차에 없는 관광지)을 지운다.
CREATE TABLE attraction_access (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    attraction_id BIGINT       NOT NULL,
    kind          VARCHAR(4)   NOT NULL COMMENT 'RAIL | BUS',
    stop_rank     INT          NOT NULL COMMENT '종류 안 가까운 순 1·2 (rank 는 MySQL 예약어라 피했다)',
    source_key    VARCHAR(300) NOT NULL COMMENT '원천 자연 키 — 철도 source_key · 버스 도시코드:정류장번호',
    name          VARCHAR(100) NOT NULL COMMENT '계산 시점 원천 이름 사본',
    name_en       VARCHAR(200) NULL     COMMENT '계산 시점 영문 이름 사본 (버스는 원천에 없다)',
    line_names    VARCHAR(300) NULL     COMMENT '노선 사본 — 노선별 행을 묶은 역은 「1·4호선」 (LINES 는 MySQL 예약어)',
    distance_m    INT          NOT NULL COMMENT '하버사인 직선거리(m, 반올림)',
    base_date     DATE         NULL     COMMENT '원천 기준일 (철도 데이터기준일자 · 버스 정보수집일)',
    computed_at   DATETIME     NOT NULL COMMENT '계산 회차',
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_access (attraction_id, kind, stop_rank),
    KEY idx_attraction_access_computed (computed_at)
) COMMENT='관광지 가까운 역·정류장 — 주 1회 사전 계산';
