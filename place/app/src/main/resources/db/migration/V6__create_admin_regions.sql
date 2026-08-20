-- ADR-0071 — 한국 행정구역(법정동 코드 기준). 출처: 행정안전부 법정동코드 전체자료(공공누리 제1유형).
--
-- `regions`(GeoNames)를 고치지 않고 따로 두는 이유: GeoNames 의 KR 자료는 행정구역 체계가 아니라
-- 지명 데이터셋이다. CITY 296행에 흥해읍·왜관읍이 섞여 있고 admin2_code 는 전부 NULL 이다.
-- 지명 계층에 행정구역을 끼워 넣으면 두 체계가 한 테이블에서 섞인다 — attractions.sigungu_code 에
-- 이미 일어난 일이다(법정동 3자리 25,030행 + TourAPI 구코드 19,874행 = 시군구가 486개로 보였다).
CREATE TABLE admin_regions (
    code        VARCHAR(5)  NOT NULL,            -- 시도 2자리(11) / 시군구 5자리(11110)
    parent_code VARCHAR(5)  NULL,                -- 시군구 → 시도
    level       VARCHAR(10) NOT NULL,            -- SIDO / SIGUNGU
    name        VARCHAR(60) NOT NULL,            -- 서울특별시 / 종로구
    name_en     VARCHAR(80) NULL,                -- 법정동 자료에 없다. 비면 화면이 name 을 쓴다
    latitude    DOUBLE      NULL,                -- 지도 중심. 자료에 없어 관광지 좌표로 채운다
    longitude   DOUBLE      NULL,
    created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (code),
    KEY idx_admin_regions_parent (parent_code),
    KEY idx_admin_regions_level (level)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- 관광지를 행정구역에 붙이는 축. TourAPI 신체계가 주는 값을 **그대로** 담는다.
--
-- 기존 area_code / sigungu_code 는 지우지 않는다 — 신규 축으로 완전히 넘어가기 전에 지우면
-- 롤백 경로가 사라진다. 다만 화면·API 의 지역 축으로는 쓰지 않는다.
ALTER TABLE attractions
    ADD COLUMN ldong_regn_cd   VARCHAR(2) NULL COMMENT '법정동 시도코드 (TourAPI lDongRegnCd)' AFTER sigungu_code,
    ADD COLUMN ldong_signgu_cd VARCHAR(3) NULL COMMENT '법정동 시군구코드 (TourAPI lDongSignguCd)' AFTER ldong_regn_cd,
    ADD KEY idx_attractions_ldong (ldong_regn_cd, ldong_signgu_cd);
