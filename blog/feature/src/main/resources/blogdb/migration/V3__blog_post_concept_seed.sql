-- 이미 발행된 글의 개념 매핑 — 사람이 고른 목록이다.
-- 글은 slug 로 찾는다: 그 글이 없는 DB(로컬 · 테스트)에서는 아무 행도 들지 않는다.
-- 개념 id 는 code-dictionary 온톨로지 파일(revision 2)에 있는 것만 쓴다. 이후 매핑은 글 편집기가 원본이다.
-- 매핑할 개념이 없는 두 글(Claude Code 상태줄 · fencesvg)은 넣지 않는다.

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'container' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'kubernetes', 2 UNION ALL
    SELECT 'conc-resource-exhaustion', 3
) c
WHERE p.slug = 'jvm-native-memory-glibc-malloc-arena';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'embedding-model' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'serialization', 2
) c
WHERE p.slug = 'self-hosted-model-loading-path-risk';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'query-understanding' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'morphological-analysis', 2 UNION ALL
    SELECT 'analyzer-tokenizer', 3 UNION ALL
    SELECT 'nori', 4 UNION ALL
    SELECT 'bm25', 5 UNION ALL
    SELECT 'ann-search', 6 UNION ALL
    SELECT 'rrf', 7
) c
WHERE p.slug = 'opensearch-hybrid-query-understanding';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'analyzer-tokenizer' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'synonym-dictionary', 2 UNION ALL
    SELECT 'opensearch', 3 UNION ALL
    SELECT 'replication', 4
) c
WHERE p.slug = 'elasticsearch-opensearch-diagnosis-playbook';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'search-system' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'search-ingest', 2 UNION ALL
    SELECT 'search-query', 3 UNION ALL
    SELECT 'search-evaluation', 4
) c
WHERE p.slug = 'search-architecture-keyword-layers';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'search-node-memory' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'sharding', 2 UNION ALL
    SELECT 'replication', 3 UNION ALL
    SELECT 'dist-quorum', 4 UNION ALL
    SELECT 'opensearch', 5
) c
WHERE p.slug = 'search-cluster-capacity-sizing';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'search-node-memory' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'sharding', 2 UNION ALL
    SELECT 'opensearch', 3 UNION ALL
    SELECT 'latency-percentile', 4
) c
WHERE p.slug = 'opensearch-cluster-sizing-prompt';

INSERT INTO blog_post_concept (post_id, concept_id, ordinal)
SELECT p.id, c.concept_id, c.ordinal FROM blog_post p
JOIN (
    SELECT 'search-system' AS concept_id, 1 AS ordinal UNION ALL
    SELECT 'inverse-index', 2 UNION ALL
    SELECT 'query-understanding', 3 UNION ALL
    SELECT 'bm25', 4 UNION ALL
    SELECT 'ann-search', 5 UNION ALL
    SELECT 'rrf', 6 UNION ALL
    SELECT 'ndcg', 7
) c
WHERE p.slug = 'search-system-concept-map';
