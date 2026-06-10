-- Portfolio dummy seed (4 cards: 3 PUBLIC + 1 PRIVATE)
--
-- 사용 가이드:
-- 1) 적재 전 V5 migration 이 적용돼 있어야 함:
--    SELECT version FROM flyway_schema_history WHERE version = '5';
--    → row 없으면 새 code-dictionary 이미지 배포해서 Flyway 가 V5 적용하게 만들 것
-- 2) charset 강제 — 한국어 깨짐 방지:
--    mysql --default-character-set=utf8mb4 ... < portfolio-dummy-seed.sql
--    또는 세션에서 SET NAMES utf8mb4 (아래 첫 줄로 포함됨)
-- 3) 중복 적재 방지 — title 기준 idempotent. 동일 title 이 이미 있으면 skip.

SET NAMES utf8mb4;

START TRANSACTION;

INSERT INTO portfolio_card
    (title, summary, body, period_start, period_end, role, impact, visibility, tags, keywords)
SELECT * FROM (SELECT
    'Kafka 기반 주문-결제 Saga 도입' AS title,
    '결제 이탈 1.4% → 0.2% 감축. Outbox + DLQ 안전 망 구성.' AS summary,
    '## 배경\n결제 동기 호출이 PG 응답 지연에 그대로 노출되어 이탈률 1.4%.\n\n## 접근\n- Saga(orchestration) 전환\n- Transactional Outbox + Kafka\n- 멱등 consumer + DLQ\n\n## 결과\n- 이탈률 1.4% → 0.2%\n- P95 1.8s → 320ms\n- 결제 중복 발생 0건' AS body,
    DATE '2025-09-01' AS period_start,
    DATE '2026-02-28' AS period_end,
    'Backend Lead' AS role,
    9 AS impact,
    'PUBLIC' AS visibility,
    JSON_ARRAY('Kotlin', 'Spring', 'Kafka', 'MySQL') AS tags,
    JSON_ARRAY('saga-pattern', 'outbox', 'dlq') AS keywords
) AS t
WHERE NOT EXISTS (SELECT 1 FROM portfolio_card WHERE title = 'Kafka 기반 주문-결제 Saga 도입');

INSERT INTO portfolio_card
    (title, summary, body, period_start, period_end, role, impact, visibility, tags, keywords)
SELECT * FROM (SELECT
    'Elasticsearch 색인 alias 스왑' AS title,
    '무중단 재색인 파이프라인 구축' AS summary,
    '## 핵심\n2단계 alias 스왑으로 인덱싱 중 트래픽 무영향.\n\n## 결과\n재색인 30분 → 7분, 트래픽 영향 0.' AS body,
    DATE '2025-05-01' AS period_start,
    DATE '2025-08-15' AS period_end,
    'Backend Engineer' AS role,
    7 AS impact,
    'PUBLIC' AS visibility,
    JSON_ARRAY('Kotlin', 'Elasticsearch') AS tags,
    JSON_ARRAY('alias-swap', 'bulk-indexing') AS keywords
) AS t
WHERE NOT EXISTS (SELECT 1 FROM portfolio_card WHERE title = 'Elasticsearch 색인 alias 스왑');

INSERT INTO portfolio_card
    (title, summary, body, period_start, period_end, role, impact, visibility, tags, keywords)
SELECT * FROM (SELECT
    'Redis 분산락 기반 재고 예약' AS title,
    '동시성 race condition 제거' AS summary,
    '## 문제\n인기 SKU 매진 임박 시 oversell 발생.\n\n## 해결\nRedlock 으로 SKU 단위 분산락 + TTL 기반 자동 해제.\n\n## 결과\noversell 0건' AS body,
    DATE '2024-11-01' AS period_start,
    DATE '2025-02-01' AS period_end,
    'Backend Engineer' AS role,
    6 AS impact,
    'PUBLIC' AS visibility,
    JSON_ARRAY('Kotlin', 'Redis', 'Spring') AS tags,
    JSON_ARRAY('distributed-lock', 'redlock') AS keywords
) AS t
WHERE NOT EXISTS (SELECT 1 FROM portfolio_card WHERE title = 'Redis 분산락 기반 재고 예약');

INSERT INTO portfolio_card
    (title, summary, body, period_start, period_end, role, impact, visibility, tags, keywords)
SELECT * FROM (SELECT
    '사내 wiki 마이그레이션 (private)' AS title,
    'Confluence → Notion 이전' AS summary,
    '## 결과\n검색 가능 페이지 1.8K 이전, 노션 백링크 80% 보존' AS body,
    DATE '2024-07-01' AS period_start,
    DATE '2024-08-01' AS period_end,
    'IC' AS role,
    4 AS impact,
    'PRIVATE' AS visibility,
    JSON_ARRAY('Python') AS tags,
    JSON_ARRAY('migration') AS keywords
) AS t
WHERE NOT EXISTS (SELECT 1 FROM portfolio_card WHERE title = '사내 wiki 마이그레이션 (private)');

COMMIT;

-- 적재 확인
SELECT id, title, impact, visibility, created_at FROM portfolio_card ORDER BY id;
