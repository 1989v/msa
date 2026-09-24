-- 글 ↔ 개념 매핑. 개념은 code-dictionary(atlas) 소유라 concept_id 는 값으로만 든다 —
-- 서비스 간 FK 를 만들지 않는다. 글을 쓰는 쪽이 고르고, /tech 개념 화면이 ?concept= 로 읽는다.
CREATE TABLE blog_post_concept (
    post_id BIGINT NOT NULL,
    concept_id VARCHAR(100) NOT NULL,
    ordinal INT NOT NULL,
    PRIMARY KEY (post_id, concept_id),
    INDEX idx_blog_post_concept_concept (concept_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
