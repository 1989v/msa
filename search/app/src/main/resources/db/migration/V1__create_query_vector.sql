-- 질의 벡터 원천 (ADR-0090 개정 2026-09-08)
--
-- 사이드카가 만든 질의 벡터를 여기 남긴다. 캐시가 아니라 원천이라 파드가 재기동해도
-- 같은 질의를 다시 인코딩하지 않는다.
--
-- 벡터는 float32 little-endian 을 그대로 담는 VARBINARY 다. 문자열(JSON/base64)로 담으면
-- 640차원이 약 3배가 되고, DB 는 이 값을 계산에 쓰지 않으므로 바이트 그대로가 맞다.
CREATE TABLE query_vector (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    model_ref       VARCHAR(120) NOT NULL COMMENT '벡터 공간 식별자 hf_id@rev7#d{dim}',
    normalized      VARCHAR(255) NOT NULL COMMENT 'QueryNormalizer 결과 — 조회 키',
    query_text      VARCHAR(255) NOT NULL COMMENT '사람이 친 원문. 정규화 규칙이 바뀌어도 이것으로 다시 만든다',
    dim             INT          NOT NULL,
    vector          VARBINARY(16384) NOT NULL COMMENT 'float32 LE 원시 바이트',
    source          VARCHAR(16)  NOT NULL COMMENT 'INTENT | VOCAB | TITLE | LOG',
    hit_count       BIGINT       NOT NULL DEFAULT 0,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    -- 스탬프가 키에 들어가 전환 창에서 두 벡터 공간이 서로를 덮지 않는다
    UNIQUE KEY uk_query_vector_ref_normalized (model_ref, normalized),
    KEY idx_query_vector_model_updated (model_ref, updated_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = '질의 벡터 원천 — 사이드카 인코딩 결과의 영속 사본';
