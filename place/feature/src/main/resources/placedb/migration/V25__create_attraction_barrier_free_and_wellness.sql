-- 관광지에 붙는 2단계 공공데이터 — 무장애 여행(KorWithService2) · 웰니스관광(WellnessTursmService).
--
-- 둘 다 TourAPI contentId 로 기존 관광지에 붙는다(무장애 목록 9,630 중 9,623 · 웰니스 국 168/170 · 영 92/92, 2026-10-02 실측).
-- attractions 컬럼이 아니라 별도 표다 — 관광지 bulk upsert 는 전체 동기화라 컬럼을 늘리면 그 경로 왕복을 전부 고쳐야 하고,
-- 한 곳을 빠뜨리면 매일 밤 값이 지워진다. 별도 표는 그 경로가 닿지 않는다.
-- 원천 행은 원문 JSON 으로 통째로 두고, 화면·필터 값은 파생 컬럼이다 (data-sources.md §0 ①②).
CREATE TABLE attraction_barrier_free (
    attraction_id    BIGINT       NOT NULL COMMENT 'attractions.id (국문 행)',
    content_id       VARCHAR(32)  NOT NULL COMMENT '원천 contentid (국문)',
    list_raw         JSON         NULL     COMMENT 'KorWithService2 areaBasedList2 행 원문',
    detail_raw       JSON         NULL     COMMENT 'detailWithTour2 응답 원문 (29키)',
    list_modified_at DATETIME     NULL     COMMENT '목록 modifiedtime — 상세 재수집 판정',
    detail_synced_at DATETIME     NULL     COMMENT 'NULL 이면 상세 백필 대상',
    flags            VARCHAR(255) NULL     COMMENT '파생: 긍정 값만 코드 목록(WHEELCHAIR,ELEVATOR,RESTROOM,PARKING,STROLLER,LACTATION_ROOM,…)',
    flags_rule_ver   SMALLINT     NULL     COMMENT '파생 규칙 판 — 규칙을 바꾸면 원문에서 다시 만든다',
    PRIMARY KEY (attraction_id),
    UNIQUE KEY uk_barrier_free_content (content_id),
    KEY idx_barrier_free_backfill (detail_synced_at)
) COMMENT='관광지 무장애 여행 정보 — place-ingest 가 쓰고 search-batch 가 읽는다';

CREATE TABLE attraction_wellness (
    attraction_id BIGINT      NOT NULL COMMENT 'attractions.id',
    content_id    VARCHAR(32) NOT NULL COMMENT '원천 contentId',
    lang          VARCHAR(8)  NOT NULL COMMENT 'langDivCd KOR→ko, ENG→en',
    thema_cd      VARCHAR(16) NOT NULL COMMENT 'wellnessThemaCd (EX05xxxx, 신분류 소분류와 같은 체계)',
    list_raw      JSON        NOT NULL COMMENT 'areaBasedList 행 원문 (19키)',
    synced_at     DATETIME    NOT NULL,
    PRIMARY KEY (attraction_id),
    KEY idx_wellness_lang (lang)
) COMMENT='관광지 웰니스관광 테마 — place-ingest 가 언어별로 통째로 바꾸고 search-batch 가 읽는다';
