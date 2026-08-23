-- /tech 도메인 맵의 루트를 기술 분류가 아니라 **직접 만들어본 업무 도메인**으로 바꾼다.
--
-- 개념의 소속 업무 도메인은 concept.category 로 유도할 수 없다 — 'saga-pattern' 은
-- DESIGN_PATTERN 이지만 주문·결제에 속하고, 'rate-limiting' 은 SECURITY 지만 파트너 연동과
-- 데이터 수집 양쪽에 걸친다. 유도 불가능한 지식이므로 FE 스위치가 아니라 데이터로 둔다.
--
-- concept_id 에 FK 를 걸지 않는 것은 service_concept(V4) 와 같은 이유다 — 개념 행은
-- reindex 가 통째로 다시 심으므로, FK 를 걸면 재색인이 매핑을 지우거나 막는다.

CREATE TABLE tech_domain (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    label VARCHAR(80) NOT NULL,
    tagline VARCHAR(200),
    order_no INT NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tech_domain_active_order (active, order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tech_domain_concept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    domain_id BIGINT NOT NULL,
    concept_id VARCHAR(100) NOT NULL,
    order_no INT NOT NULL DEFAULT 0,
    FOREIGN KEY (domain_id) REFERENCES tech_domain(id) ON DELETE CASCADE,
    UNIQUE KEY uk_tech_domain_concept (domain_id, concept_id),
    INDEX idx_tech_domain_concept_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- tagline 은 도메인 노드 아래 한 줄로 그려진다. 링 위에서 이웃 노드와 겹치지 않도록
-- 30자 안쪽의 짧은 구절로 쓴다 (긴 설명은 잘려서 오히려 덜 읽힌다).
INSERT INTO tech_domain (code, label, tagline, order_no, active) VALUES
    ('search',   '검색',        '색인·랭킹·자동완성',        10, 1),
    ('catalog',  '전시·상품',   '상품 SSOT 와 큐레이션·진열', 20, 1),
    ('order',    '주문·결제',   '상태 전이·보상 트랜잭션',    30, 1),
    ('partner',  '파트너 연동', '외부 공급사 상품·재고 연동', 40, 1),
    ('member',   '회원·인증',   '최소 개인정보 · OAuth·RBAC', 50, 1),
    ('ingest',   '데이터 수집', '공개 데이터 인제스트·쿼터',  60, 1),
    ('reco',     '추천·개인화', '후보 생성부터 랭킹까지',     70, 1),
    ('platform', '플랫폼·배포', 'K8s·GitOps 무중단 롤아웃',   80, 1);

-- 도메인당 핵심 개념만 큐레이션한다 (전량 투입 아님) — 나머지는 검색·트리맵으로 닿는다.
-- 한 개념이 여러 도메인에 속할 수 있고, 어느 도메인에도 안 속하는 개념도 있다.
INSERT INTO tech_domain_concept (domain_id, concept_id, order_no)
SELECT d.id, c.concept_id, c.ord FROM tech_domain d JOIN (
    SELECT 'search' AS code, 'inverse-index' AS concept_id, 1 AS ord UNION ALL
    SELECT 'search', 'bulk-indexing', 2 UNION ALL
    SELECT 'search', 'alias-swap', 3 UNION ALL
    SELECT 'search', 'trie', 4 UNION ALL
    SELECT 'search', 'b-tree', 5 UNION ALL
    SELECT 'search', 'bloom-filter', 6 UNION ALL
    SELECT 'search', 'sorting', 7 UNION ALL
    SELECT 'search', 'binary-search', 8 UNION ALL
    SELECT 'search', 'hash-map', 9 UNION ALL
    SELECT 'search', 'caching', 10 UNION ALL
    SELECT 'search', 'cqrs', 11 UNION ALL
    SELECT 'search', 'eventual-consistency', 12 UNION ALL

    SELECT 'catalog', 'aggregate', 1 UNION ALL
    SELECT 'catalog', 'bounded-context', 2 UNION ALL
    SELECT 'catalog', 'ddd', 3 UNION ALL
    SELECT 'catalog', 'value-object', 4 UNION ALL
    SELECT 'catalog', 'event-driven-architecture', 5 UNION ALL
    SELECT 'catalog', 'outbox-pattern', 6 UNION ALL
    SELECT 'catalog', 'fan-out', 7 UNION ALL
    SELECT 'catalog', 'specification-pattern', 8 UNION ALL
    SELECT 'catalog', 'orm', 9 UNION ALL
    SELECT 'catalog', 'n-plus-one', 10 UNION ALL
    SELECT 'catalog', 'caching', 11 UNION ALL
    SELECT 'catalog', 'eventual-consistency', 12 UNION ALL

    SELECT 'order', 'saga-pattern', 1 UNION ALL
    SELECT 'order', 'idempotency', 2 UNION ALL
    SELECT 'order', 'outbox-pattern', 3 UNION ALL
    SELECT 'order', 'two-phase-commit', 4 UNION ALL
    SELECT 'order', 'event-sourcing', 5 UNION ALL
    SELECT 'order', 'retry-pattern', 6 UNION ALL
    SELECT 'order', 'optimistic-lock', 7 UNION ALL
    SELECT 'order', 'pessimistic-lock', 8 UNION ALL
    SELECT 'order', 'distributed-lock', 9 UNION ALL
    SELECT 'order', 'acid', 10 UNION ALL
    SELECT 'order', 'circuit-breaker', 11 UNION ALL
    SELECT 'order', 'sealed-class', 12 UNION ALL
    SELECT 'order', 'cqrs', 13 UNION ALL

    SELECT 'partner', 'adapter-pattern', 1 UNION ALL
    SELECT 'partner', 'port-adapter', 2 UNION ALL
    SELECT 'partner', 'circuit-breaker', 3 UNION ALL
    SELECT 'partner', 'retry-pattern', 4 UNION ALL
    SELECT 'partner', 'bulkhead-pattern', 5 UNION ALL
    SELECT 'partner', 'rate-limiting', 6 UNION ALL
    SELECT 'partner', 'idempotency', 7 UNION ALL
    SELECT 'partner', 'optimistic-lock', 8 UNION ALL
    SELECT 'partner', 'distributed-lock', 9 UNION ALL
    SELECT 'partner', 'eventual-consistency', 10 UNION ALL
    SELECT 'partner', 'connection-pool', 11 UNION ALL
    SELECT 'partner', 'backpressure', 12 UNION ALL
    SELECT 'partner', 'rest', 13 UNION ALL

    SELECT 'member', 'oauth', 1 UNION ALL
    SELECT 'member', 'jwt', 2 UNION ALL
    SELECT 'member', 'rbac', 3 UNION ALL
    SELECT 'member', 'hashing', 4 UNION ALL
    SELECT 'member', 'encryption', 5 UNION ALL
    SELECT 'member', 'cors', 6 UNION ALL
    SELECT 'member', 'csrf', 7 UNION ALL
    SELECT 'member', 'xss', 8 UNION ALL
    SELECT 'member', 'sql-injection', 9 UNION ALL
    SELECT 'member', 'ssl-tls', 10 UNION ALL
    SELECT 'member', 'api-gateway', 11 UNION ALL
    SELECT 'member', 'rate-limiting', 12 UNION ALL

    SELECT 'ingest', 'rate-limiting', 1 UNION ALL
    SELECT 'ingest', 'retry-pattern', 2 UNION ALL
    SELECT 'ingest', 'idempotency', 3 UNION ALL
    SELECT 'ingest', 'bulk-indexing', 4 UNION ALL
    SELECT 'ingest', 'backpressure', 5 UNION ALL
    SELECT 'ingest', 'circuit-breaker', 6 UNION ALL
    SELECT 'ingest', 'serialization', 7 UNION ALL
    SELECT 'ingest', 'http', 8 UNION ALL
    SELECT 'ingest', 'rest', 9 UNION ALL
    SELECT 'ingest', 'coroutine', 10 UNION ALL
    SELECT 'ingest', 'thread-pool', 11 UNION ALL
    SELECT 'ingest', 'caching', 12 UNION ALL

    SELECT 'reco', 'heap', 1 UNION ALL
    SELECT 'reco', 'sorting', 2 UNION ALL
    SELECT 'reco', 'hash-map', 3 UNION ALL
    SELECT 'reco', 'greedy', 4 UNION ALL
    SELECT 'reco', 'dynamic-programming', 5 UNION ALL
    SELECT 'reco', 'graph', 6 UNION ALL
    SELECT 'reco', 'bfs', 7 UNION ALL
    SELECT 'reco', 'consistent-hashing', 8 UNION ALL
    SELECT 'reco', 'caching', 9 UNION ALL
    SELECT 'reco', 'fan-out', 10 UNION ALL
    SELECT 'reco', 'event-driven-architecture', 11 UNION ALL
    SELECT 'reco', 'cqrs', 12 UNION ALL

    SELECT 'platform', 'kubernetes', 1 UNION ALL
    SELECT 'platform', 'docker', 2 UNION ALL
    SELECT 'platform', 'container', 3 UNION ALL
    SELECT 'platform', 'ci-cd', 4 UNION ALL
    SELECT 'platform', 'infrastructure-as-code', 5 UNION ALL
    SELECT 'platform', 'blue-green-deployment', 6 UNION ALL
    SELECT 'platform', 'canary-deployment', 7 UNION ALL
    SELECT 'platform', 'health-check', 8 UNION ALL
    SELECT 'platform', 'auto-scaler', 9 UNION ALL
    SELECT 'platform', 'load-balancer', 10 UNION ALL
    SELECT 'platform', 'reverse-proxy', 11 UNION ALL
    SELECT 'platform', 'api-gateway', 12 UNION ALL
    SELECT 'platform', 'service-discovery', 13 UNION ALL
    SELECT 'platform', 'dns', 14
) c ON d.code = c.code;
