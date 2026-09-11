CREATE TABLE service (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NOT NULL,
    port INT,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_service_private (is_private),
    INDEX idx_service_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_concept (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    service_id BIGINT NOT NULL,
    concept_id VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (service_id) REFERENCES service(id) ON DELETE CASCADE,
    UNIQUE KEY uk_service_concept (service_id, concept_id),
    INDEX idx_service_concept_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO service (code, name, description, port, is_private, display_order) VALUES
    ('product',         'Product',         '상품 관리 서비스 (SSOT)',         8081, FALSE, 10),
    ('order',           'Order',           '주문/결제 서비스',                8082, FALSE, 20),
    ('search',          'Search',          'Elasticsearch 기반 검색',         8083, FALSE, 30),
    ('auth',            'Auth',            '인증/인가 서비스',                8087, TRUE,  40),
    ('gateway',         'Gateway',         'API Gateway + Rate Limiting',     8080, FALSE, 50),
    ('gifticon',        'Gifticon',        '기프티콘 관리 서비스',            8086, TRUE,  60),
    ('code-dictionary', 'Code Dictionary', 'IT 개념 사전 + 시각화',           8089, FALSE, 70),
    ('common',          'Common',          '공유 라이브러리',                 NULL, FALSE, 80),
    ('discovery',       'Discovery',       'Eureka Service Discovery',        8761, FALSE, 90);

INSERT INTO service_concept (service_id, concept_id, display_order)
SELECT s.id, c.concept_id, c.ord FROM service s JOIN (
    SELECT 'product' AS code, 'aggregate' AS concept_id, 1 AS ord UNION ALL
    SELECT 'product', 'event-driven-architecture', 2 UNION ALL
    SELECT 'product', 'saga-pattern', 3 UNION ALL
    SELECT 'order', 'saga-pattern', 1 UNION ALL
    SELECT 'order', 'idempotency', 2 UNION ALL
    SELECT 'order', 'circuit-breaker', 3 UNION ALL
    SELECT 'search', 'inverse-index', 1 UNION ALL
    SELECT 'search', 'bulk-indexing', 2 UNION ALL
    SELECT 'search', 'alias-swap', 3 UNION ALL
    SELECT 'auth', 'jwt', 1 UNION ALL
    SELECT 'auth', 'oauth', 2 UNION ALL
    SELECT 'auth', 'coroutine', 3 UNION ALL
    SELECT 'gateway', 'api-gateway', 1 UNION ALL
    SELECT 'gateway', 'rate-limiting', 2 UNION ALL
    SELECT 'gateway', 'jwt', 3 UNION ALL
    SELECT 'gifticon', 'aggregate', 1 UNION ALL
    SELECT 'gifticon', 'sealed-class', 2 UNION ALL
    SELECT 'gifticon', 'cqrs', 3 UNION ALL
    SELECT 'code-dictionary', 'bulk-indexing', 1 UNION ALL
    SELECT 'code-dictionary', 'inverse-index', 2 UNION ALL
    SELECT 'code-dictionary', 'port-adapter', 3 UNION ALL
    SELECT 'common', 'circuit-breaker', 1 UNION ALL
    SELECT 'common', 'jwt', 2 UNION ALL
    SELECT 'common', 'event-driven-architecture', 3 UNION ALL
    SELECT 'discovery', 'service-discovery', 1 UNION ALL
    SELECT 'discovery', 'health-check', 2
) c ON s.code = c.code;
