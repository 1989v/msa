-- 연관 관광지 — 한국관광공사 빅데이터 TarRlteTarService1 (2단계 공공데이터).
--
-- 원천 단위는 (시군구, 출발 관광지)이고 그 달의 연관 대상이 순위 순으로 최대 50행 온다(관광지·음식·숙박). 한 출발의 행을 원문 그대로 한 행에 둔다.
-- 원천 식별자는 32자 해시라 TourAPI contentId 와 이어지지 않는다 — 출발·대상 모두 이름 + 시군구로 국문 관광지에 잇는다(place-ingest name_match.py).
-- 그 결과가 파생 컬럼이다. 못 이은 출발·대상도 남긴다(원천 전부 적재). 최신 달만 둔다 — 수집기는 받은 시군구의 행을 통째로 바꾼다.
-- attractions 컬럼이 아니라 별도 표다 — 관광지 bulk upsert(전체 동기화)가 닿지 않는다.
CREATE TABLE attraction_related (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    t_ats_cd      VARCHAR(64)  NOT NULL COMMENT '원천 출발 관광지 식별자 tAtsCd (32자 해시)',
    t_ats_nm      VARCHAR(200) NOT NULL COMMENT '원천 출발 관광지 이름 tAtsNm',
    signgu_cd     VARCHAR(5)   NOT NULL COMMENT '원천 signguCd (법정동 시군구 5자리)',
    base_ym       VARCHAR(6)   NOT NULL COMMENT '원천 baseYm (yyyyMM)',
    related_raw   JSON         NOT NULL COMMENT 'areaBasedList1 행 원문 배열(순위 순, 행마다 17키)',
    attraction_id BIGINT       NULL     COMMENT '파생: 출발 이름 매칭으로 이은 attractions.id (국문)',
    match_method  VARCHAR(12)  NULL     COMMENT '파생: EXACT|NORMALIZED|CONTAINS|AMBIGUOUS|NONE',
    targets       JSON         NULL     COMMENT '파생: [{rank,name,lcls,mcls,scls,signguCd,attractionId,matchMethod}] — 대상 시군구 이름 매칭',
    fetched_at    DATETIME     NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_related (signgu_cd, t_ats_cd),
    KEY idx_related_attraction (attraction_id)
) COMMENT='연관 관광지(월) — place-ingest 가 시군구 단위로 바꾸고 search-batch 가 읽는다';
