-- 관광지 임베딩 벡터 원본 (ADR-0090).
--
-- 벡터는 서버가 만들지 않는다 — `tools/embed` 가 로컬 GPU 에서 계산해 /internal 로 밀어 넣고,
-- search-batch 가 재색인 때 lookup 으로 읽어 OpenSearch 를 채운다. 인덱스는 매일 새로 지어지므로
-- **원본은 여기**다.
CREATE TABLE attraction_embedding (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    attraction_id  BIGINT       NOT NULL COMMENT 'attractions.id — 경계 안이지만 객체 연관 대신 plain ID',
    -- 벡터 공간 식별자. 모델·리비전·차원 중 하나라도 다르면 비교 불가라 행 단위로 박는다.
    model_ref      VARCHAR(160) NOT NULL COMMENT 'hf_id@rev7#d{dim}',
    dim            SMALLINT     NOT NULL,
    -- 모델에 넣은 원문. 규칙을 바꿨을 때 무엇이 달라졌는지 diff 가 되고, 해시 검증의 근거가 된다.
    embedding_text TEXT         NOT NULL,
    text_hash      CHAR(64)     NOT NULL COMMENT 'sha256(model_ref + LF + embedding_text)',
    vector         BLOB         NOT NULL COMMENT 'float32 little-endian, dim*4 bytes, L2 정규화',
    embedded_at    DATETIME     NOT NULL,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_embedding (attraction_id, model_ref),
    KEY idx_attraction_embedding_model (model_ref, embedded_at)
) COMMENT='관광지 임베딩 벡터 원본 — tools/embed 가 쓰고 search-batch 가 읽는다 (ADR-0090)';
