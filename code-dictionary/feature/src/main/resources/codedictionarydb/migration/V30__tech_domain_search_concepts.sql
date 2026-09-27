-- /tech 도메인 맵의 「검색」 칸을 실제로 해 온 검색 작업의 개념으로 다시 채운다.
-- V19 는 검색 온톨로지(search.yaml)가 생기기 전이라 B-트리 · 블룸 필터 · 정렬 같은 일반 자료구조로 채웠다.
-- 그 개념들은 사전에 그대로 남고 이 칸에서만 빠진다. 순서는 파이프라인 순서다 — 색인 → 쿼리 이해 · 재작성 →
-- 리트리벌 · 결합 → 모델 · 평가 → 운영. 트라이는 사전 기반 쿼리 재작성의 자료구조라 남긴다.
UPDATE tech_domain SET tagline = '쿼리 이해·하이브리드 검색·평가' WHERE code = 'search';

DELETE tdc FROM tech_domain_concept tdc
JOIN tech_domain d ON d.id = tdc.domain_id
WHERE d.code = 'search';

INSERT INTO tech_domain_concept (domain_id, concept_id, order_no)
SELECT d.id, c.concept_id, c.ord FROM tech_domain d JOIN (
    SELECT 'inverse-index' AS concept_id, 1 AS ord UNION ALL
    SELECT 'alias-swap', 2 UNION ALL
    SELECT 'query-understanding', 3 UNION ALL
    SELECT 'srch-query-rewriting', 4 UNION ALL
    SELECT 'trie', 5 UNION ALL
    SELECT 'srch-query-log-correction', 6 UNION ALL
    SELECT 'srch-keyboard-layout-correction', 7 UNION ALL
    SELECT 'srch-zero-result-recovery', 8 UNION ALL
    SELECT 'bm25', 9 UNION ALL
    SELECT 'ann-search', 10 UNION ALL
    SELECT 'rrf', 11 UNION ALL
    SELECT 'srch-embedding-model-selection', 12 UNION ALL
    SELECT 'judgment-set', 13 UNION ALL
    SELECT 'ndcg', 14 UNION ALL
    SELECT 'srch-ramp-up', 15
) c
WHERE d.code = 'search';
