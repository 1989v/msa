-- 관광지 집중률 — 한국관광공사 빅데이터 TatsCnctrRateService (2단계 공공데이터).
--
-- 원천 단위는 (시군구, 관광지 이름)이고 오늘부터 앞 30일 예측이 30행으로 온다. 한 이름의 30행을 원문 그대로 한 행에 둔다.
-- 원천에 TourAPI contentId 가 없어 이름 + 시군구로 국문 관광지에 잇는다(place-ingest name_match.py) — 그 결과가 파생 컬럼이다.
-- 못 이은 이름도 남긴다(원천 전부 적재). 수집기는 받은 시군구의 행을 통째로 바꾸고, 받지 못한 시군구는 건드리지 않는다.
-- attractions 컬럼이 아니라 별도 표다 — 관광지 bulk upsert(전체 동기화)가 닿지 않는다.
CREATE TABLE attraction_congestion (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    signgu_cd     VARCHAR(5)   NOT NULL COMMENT '원천 signguCd (법정동 시군구 5자리)',
    t_ats_nm      VARCHAR(200) NOT NULL COMMENT '원천 관광지 이름 tAtsNm',
    area_cd       VARCHAR(2)   NOT NULL COMMENT '원천 areaCd',
    area_nm       VARCHAR(40)  NULL,
    signgu_nm     VARCHAR(40)  NULL,
    rates_raw     JSON         NOT NULL COMMENT 'tatsCnctrRatedList 행 원문 배열(예측일 순, 행마다 7키)',
    first_ymd     DATE         NOT NULL COMMENT '파생: 가장 이른 예측일',
    last_ymd      DATE         NOT NULL COMMENT '파생: 가장 늦은 예측일',
    attraction_id BIGINT       NULL     COMMENT '파생: 이름 매칭으로 이은 attractions.id (국문)',
    match_method  VARCHAR(12)  NULL     COMMENT '파생: EXACT|NORMALIZED|CONTAINS|AMBIGUOUS|NONE',
    fetched_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_congestion (signgu_cd, t_ats_nm),
    KEY idx_congestion_attraction (attraction_id)
) COMMENT='관광지 집중률 앞 30일 — place-ingest 가 시군구 단위로 바꾸고 search-batch 가 읽는다';
