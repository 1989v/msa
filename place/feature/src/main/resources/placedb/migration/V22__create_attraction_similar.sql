-- 관광지 「비슷한 곳」 목록 — 같은 언어·같은 유형·다른 시도에서 문서 벡터 코사인 상위 5.
--
-- 서버는 계산하지 않는다. `tools/embed` 의 `similar` 명령이 attraction_embedding 을 읽어 계산하고
-- /internal 로 문서 단위로 통째로 바꿔 넣는다. search-batch 가 재색인 때 lookup 으로 읽어 상세에 싣는다.
-- 벡터와 같은 이유로 model_ref 를 행마다 박는다 — 다른 벡터 공간에서 계산한 목록은 섞이지 않는다.
CREATE TABLE attraction_similar (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    attraction_id BIGINT       NOT NULL COMMENT 'attractions.id — 객체 연관 대신 plain ID',
    model_ref     VARCHAR(160) NOT NULL COMMENT '목록을 계산한 벡터의 스탬프 hf_id@rev7#d{dim}',
    -- RANK 는 MySQL 8 예약어라 rank_no 로 둔다. 0 이 가장 비슷하다.
    rank_no       SMALLINT     NOT NULL,
    similar_id    BIGINT       NOT NULL COMMENT 'attractions.id — 비슷한 곳',
    score         DOUBLE       NOT NULL COMMENT '코사인 유사도',
    computed_at   DATETIME     NOT NULL,
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_attraction_similar (attraction_id, model_ref, rank_no)
) COMMENT='관광지 비슷한 곳(다른 시도) — tools/embed 가 쓰고 search-batch 가 읽는다';
