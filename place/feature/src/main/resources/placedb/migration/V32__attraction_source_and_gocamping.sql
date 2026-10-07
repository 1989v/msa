-- 고캠핑 — 자기 번호 체계를 가진 첫 원천 (ADR-0104 Q-P2-KEY).
--
-- 관광지 자연키에 원천을 더한다: (content_id, lang) → (source, content_id, lang). 기본값 TOURAPI 라 기존 행·요청 모양은 그대로다.
-- 번호가 같아도 원천이 다르면 다른 곳이다 — 고캠핑 contentId 는 지금 TourAPI 국문 번호와 겹치지 않지만 체계가 달라 보장이 없다.
-- 선행: TourAPI 보강 잡의 pick 이 source=TOURAPI 행만 고르게 먼저 배포했다(다른 원천 번호로 detailCommon2 를 부르지 않게).
ALTER TABLE attractions
    ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'TOURAPI' COMMENT '원천: TOURAPI | GOCAMPING' AFTER lang,
    DROP INDEX uk_attractions_content_lang,
    ADD UNIQUE KEY uk_attractions_source_content_lang (source, content_id, lang);

-- 고캠핑 원천 표 — basedList 행 원문(82키)은 전부 남긴다(외부 데이터 연동 3규칙 ①).
-- 기존 TourAPI 캠핑장(야영장 AC05)과 300m 안 + 이름이 겹치는 곳은 새 관광지 행을 만들지 않고 matched_attraction_id 만 남긴다.
CREATE TABLE gocamping_site (
    content_id            VARCHAR(32)  NOT NULL COMMENT '고캠핑 contentId',
    facility_name         VARCHAR(200) NOT NULL COMMENT 'facltNm',
    manage_status         VARCHAR(20)  NULL     COMMENT 'manageSttus 운영|휴장',
    latitude              DOUBLE       NULL     COMMENT 'mapY',
    longitude             DOUBLE       NULL     COMMENT 'mapX',
    source_modified_at    DATETIME     NULL     COMMENT 'modifiedtime',
    item_raw              JSON         NOT NULL COMMENT 'basedList 행 원문 (82키)',
    matched_attraction_id BIGINT       NULL     COMMENT '파생: 같은 곳인 기존 TourAPI 캠핑장',
    match_method          VARCHAR(16)  NULL     COMMENT '파생: NEAR_NAME | NONE',
    attraction_id         BIGINT       NULL     COMMENT '이 원천으로 만든 attractions 행 (겹치지 않을 때만)',
    synced_at             DATETIME     NOT NULL,
    PRIMARY KEY (content_id),
    KEY ix_gocamping_matched (matched_attraction_id),
    KEY ix_gocamping_attraction (attraction_id)
);
