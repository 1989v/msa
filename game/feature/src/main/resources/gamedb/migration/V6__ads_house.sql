-- ads 페이즈 (설계 §4.3, ADR-0059 §3) — HOUSE 배너로 슬롯→정책→보상 파이프라인 검증

CREATE TABLE ad_placement (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    placement_key    VARCHAR(64) NOT NULL,
    ad_type          VARCHAR(16) NOT NULL,
    provider         VARCHAR(16) NOT NULL,
    provider_slot_id VARCHAR(100) NULL,
    creatives        JSON        NULL,
    active           TINYINT(1)  NOT NULL DEFAULT 1,
    UNIQUE KEY uk_placement_key (placement_key)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE ad_policy (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    ad_type          VARCHAR(16) NOT NULL,
    min_interval_sec INT         NOT NULL,
    max_per_session  INT         NOT NULL,
    UNIQUE KEY uk_policy_type (ad_type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE reward_grant (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    idempotency_key VARCHAR(64) NOT NULL,
    placement_key   VARCHAR(64) NOT NULL,
    game_id         BIGINT      NOT NULL,
    session_key     VARCHAR(64) NULL,
    member_id       BIGINT      NULL,
    status          VARCHAR(16) NOT NULL,
    issued_at       DATETIME(6) NOT NULL,
    settled_at      DATETIME(6) NULL,
    UNIQUE KEY uk_reward_idem (idempotency_key),
    KEY idx_reward_member (member_id, issued_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

-- frequency cap SSOT (판정은 Redis TTL) — BANNER 60s 는 CrazyGames 동일
INSERT INTO ad_policy (ad_type, min_interval_sec, max_per_session) VALUES
    ('BANNER', 60, 20),
    ('PREROLL', 300, 3),
    ('MIDGAME', 180, 10),
    ('REWARDED', 120, 10);

-- HOUSE 배너 슬롯 — 플랫폼 서비스 자체 홍보
INSERT INTO ad_placement (placement_key, ad_type, provider, provider_slot_id, creatives, active) VALUES
    ('game-list-banner', 'BANNER', 'HOUSE', NULL, JSON_ARRAY(
        JSON_OBJECT('title', 'IT 개념 사전', 'body', '트리맵으로 한눈에 보는 개발 개념 지도', 'href', '/', 'emoji', '📚'),
        JSON_OBJECT('title', '커머스 쇼핑', 'body', '플랫폼 데모 상점에서 주문 플로우 체험', 'href', '/shop', 'emoji', '🛒'),
        JSON_OBJECT('title', '포트폴리오', 'body', '이 플랫폼이 어떻게 만들어졌는지 보기', 'href', '/portfolio', 'emoji', '🗂️')
    ), 1),
    ('game-detail-banner', 'BANNER', 'HOUSE', NULL, JSON_ARRAY(
        JSON_OBJECT('title', '다른 게임도 있어요', 'body', '아케이드 홈에서 전체 게임 보기', 'href', '/games', 'emoji', '🎮')
    ), 1);

-- snake 는 아케이드 API(세션/리플레이/리더보드)와 통합돼 있어 SDK 통합 게임으로 승격 → rewarded 게이트 대상
UPDATE game SET sdk_integrated = 1 WHERE slug = 'snake';
