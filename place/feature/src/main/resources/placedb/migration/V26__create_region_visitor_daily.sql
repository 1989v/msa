-- 지역 방문자 — 한국관광공사 빅데이터 DataLabService (기초 locgoRegnVisitrDDList · 광역 metcoRegnVisitrDDList).
--
-- 과거 실적이라 교체하지 않고 일자별로 쌓는다. 하루 약 855행(시군구 269 × 3 + 시도 16 × 3), 연 약 31만 행.
-- 키가 곧 조회 경로다 — 허브는 (수준, 지역) 하나의 최근 13개월을 읽으므로 PK 앞부분 범위 읽기로 끝난다. 보조 인덱스는 없다.
-- 원천 필드는 전부 컬럼으로 둔다(data-sources.md §0 ①). touNum 은 원천이 부동소수 표기(24814.549999999996)로 주므로
-- 원문 문자열(tou_num)을 그대로 두고, 합산용 수치는 파생 컬럼(tou_num_value)이다(§0 ②).
CREATE TABLE region_visitor_daily (
    region_level  VARCHAR(8)     NOT NULL COMMENT 'SIDO | SIGUNGU',
    region_code   VARCHAR(5)     NOT NULL COMMENT '원천 areaCode(시도) | signguCode(시군구) — administrative_regions.code 와 같은 체계',
    base_ymd      DATE           NOT NULL COMMENT '원천 baseYmd',
    tou_div_cd    VARCHAR(2)     NOT NULL COMMENT '원천 touDivCd — 1 현지인 2 외지인 3 외국인',
    tou_num       VARCHAR(32)    NOT NULL COMMENT '원천 touNum 원문 (부동소수 표기 그대로)',
    tou_num_value DECIMAL(16, 3) NOT NULL COMMENT '파생: touNum 을 소수 셋째 자리로 반올림 — 합산용',
    region_nm     VARCHAR(40)    NULL     COMMENT '원천 areaNm | signguNm',
    tou_div_nm    VARCHAR(20)    NULL     COMMENT '원천 touDivNm',
    daywk_div_cd  VARCHAR(2)     NULL     COMMENT '원천 daywkDivCd',
    daywk_div_nm  VARCHAR(10)    NULL     COMMENT '원천 daywkDivNm',
    synced_at     DATETIME       NOT NULL COMMENT '마지막으로 받은 시각',
    PRIMARY KEY (region_level, region_code, base_ymd, tou_div_cd)
) COMMENT='지역 방문자 일자별 — place-ingest 가 쌓고 지역 허브가 레디스 캐시로 읽는다';
