-- ADR-0065/0071 — 원천(TourAPI)이 주는 필드를 **전부** 적재한다.
--
-- 지금까지 신 분류체계(lclsSystm1~3)를 적재 시점에 `category` 한 글자로 태워버리고 버렸다.
-- 그래서 분류 규칙을 고치려면 6만 건 재호출이 필요했다 — 원천 호출은 일일 한도가 있는
-- 자원이라 이 낭비가 그대로 비용이다.
--
-- 원칙: **원천 값은 원본 그대로 저장하고, 화면용 그루핑은 파생 컬럼(`category`)으로 따로 둔다.**
-- 그래야 그루핑 규칙 변경이 UPDATE 한 번으로 끝나고 누락된 원천 데이터가 생기지 않는다.
ALTER TABLE attractions
    -- TourAPI 4.0 신 분류체계. 구 cat1~3 을 대체하며 **영문 서비스는 cat1~3 이 비어 이쪽만 온다**
    ADD COLUMN lcls_systm1     VARCHAR(4)  NULL COMMENT '신 분류 대분류 (NA/HS/EX/VE/LS/SH/FD/AC/EV)' AFTER cat3,
    ADD COLUMN lcls_systm2     VARCHAR(8)  NULL COMMENT '신 분류 중분류 (EX05 등)' AFTER lcls_systm1,
    ADD COLUMN lcls_systm3     VARCHAR(16) NULL COMMENT '신 분류 소분류 (EX050800=의료관광 등)' AFTER lcls_systm2,
    -- 원천이 이 레코드를 어느 관광 타입으로 분류했는지 (12/76=관광지, 39/82=음식점 …)
    ADD COLUMN content_type_id VARCHAR(8)  NULL COMMENT 'TourAPI contenttypeid' AFTER lcls_systm3,
    -- 이미지 저작권 구분. 재사용 가능 범위가 여기 달려 있어 화면에 쓰려면 반드시 필요하다
    ADD COLUMN copyright_div_cd VARCHAR(8) NULL COMMENT 'TourAPI cpyrhtDivCd (이미지 저작권 구분)' AFTER content_type_id,
    ADD COLUMN thumbnail_url   VARCHAR(500) NULL COMMENT 'TourAPI firstimage2 (썸네일)' AFTER image_url,
    ADD COLUMN map_level       INT         NULL COMMENT 'TourAPI mlevel — 원천이 권장하는 지도 확대 레벨' AFTER longitude,
    ADD COLUMN zipcode         VARCHAR(16) NULL COMMENT 'TourAPI zipcode' AFTER address,
    ADD COLUMN source_created_at DATETIME  NULL COMMENT 'TourAPI createdtime' AFTER source_modified_at,
    ADD KEY idx_attractions_lcls (lcls_systm1, lcls_systm2);
