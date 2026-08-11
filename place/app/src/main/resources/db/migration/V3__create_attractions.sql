-- ADR-0065 — 관광지(TourAPI 4.0). MySQL SSOT, OpenSearch attractions 인덱스는 search-batch 일괄 재색인.
-- 국문(KorService2)/영문(EngService2)은 contentId 체계가 달라 언어별 별도 행 — (content_id, lang) 자연키.
CREATE TABLE attractions (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    content_id         VARCHAR(32)   NOT NULL,             -- TourAPI contentid
    lang               VARCHAR(8)    NOT NULL,             -- ko / en
    title              VARCHAR(300)  NOT NULL,
    address            VARCHAR(300)  NULL,
    area_code          VARCHAR(8)    NULL,                 -- TourAPI 광역 areaCode
    sigungu_code       VARCHAR(8)    NULL,
    category           VARCHAR(50)   NULL,                 -- 자체 카테고리 (자연/역사/문화시설/레포츠/쇼핑/음식)
    cat1               VARCHAR(16)   NULL,                 -- TourAPI 원본 분류 (참조 보존)
    cat2               VARCHAR(16)   NULL,
    cat3               VARCHAR(16)   NULL,
    latitude           DOUBLE        NOT NULL,
    longitude          DOUBLE        NOT NULL,
    image_url          VARCHAR(500)  NULL,
    tel                VARCHAR(100)  NULL,
    overview           TEXT          NULL,
    source_modified_at DATETIME      NULL,                 -- TourAPI modifiedtime
    status             VARCHAR(20)   NOT NULL DEFAULT 'ACTIVE',
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_attractions_content_lang (content_id, lang),
    KEY idx_attractions_area (area_code),
    KEY idx_attractions_category (category)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
