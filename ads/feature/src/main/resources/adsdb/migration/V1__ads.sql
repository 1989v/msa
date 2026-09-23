-- ADR-0098 — 광고 네트워크 전용 스키마 `ads_db`.
--
-- 모든 시각 컬럼은 KST 벽시계 값이다. 「하루」와 「시각」이 KST 달력 기준이라 저장도 같은 기준으로
-- 두어야 일 합계·시각 키를 변환 없이 비교할 수 있다. `*_hour_kst`·`hour_kst` 는 그 시각의 시작(분·초 0).
-- 금액은 전부 정수 마이크로 크레딧(1 크레딧 = 1,000,000)이다.
-- 다른 서비스의 id(회원 등)는 값으로만 들고 외래키를 두지 않는다.

-- 광고주. MEMBER 는 회원 1명당 1행, SYSTEM 은 「1989v 하우스」 하나.
CREATE TABLE ad_advertiser (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(16) NOT NULL,
    member_id BIGINT NULL,
    display_name VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL,
    suspend_reason VARCHAR(255) NULL,
    suspended_by BIGINT NULL,
    suspended_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_ad_advertiser_member (member_id),
    CONSTRAINT chk_ad_advertiser_kind CHECK (kind IN ('MEMBER', 'SYSTEM')),
    CONSTRAINT chk_ad_advertiser_member CHECK ((kind = 'MEMBER') = (member_id IS NOT NULL)),
    CONSTRAINT chk_ad_advertiser_status CHECK (status IN ('ACTIVE', 'SUSPENDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캠페인. 우선순위 컬럼은 없다 — 소유 광고주가 SYSTEM 이면 HOUSE, 아니면 PAID 로 파생한다.
-- 입찰·예산·빈도 컬럼이 NULL 인 것은 HOUSE 뿐이고, PAID 의 필수 여부는 도메인이 강제한다.
-- 「기간 밖」·「예산 소진」은 상태가 아니라 게재 자격에서 파생한다.
CREATE TABLE ad_campaign (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    advertiser_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL,
    bid_type VARCHAR(8) NULL,
    bid_micros BIGINT NULL,
    daily_budget_micros BIGINT NULL,
    total_budget_micros BIGINT NULL,
    start_at DATETIME(6) NOT NULL,
    end_at DATETIME(6) NULL,
    frequency_cap_per_day INT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    KEY idx_ad_campaign_advertiser (advertiser_id),
    KEY idx_ad_campaign_status (status),
    CONSTRAINT chk_ad_campaign_status CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED')),
    CONSTRAINT chk_ad_campaign_bid_type CHECK (bid_type IN ('CPM', 'CPC')),
    CONSTRAINT chk_ad_campaign_bid CHECK (bid_micros > 0),
    CONSTRAINT chk_ad_campaign_daily_budget CHECK (daily_budget_micros > 0),
    CONSTRAINT chk_ad_campaign_total_budget CHECK (total_budget_micros > 0),
    CONSTRAINT chk_ad_campaign_frequency CHECK (frequency_cap_per_day > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 캠페인 타기팅 — 지면(1개 이상, 도메인이 강제)과 문맥 카테고리(비면 전체).
CREATE TABLE ad_campaign_placement (
    campaign_id BIGINT NOT NULL,
    placement_key VARCHAR(64) NOT NULL,
    PRIMARY KEY (campaign_id, placement_key),
    KEY idx_ad_campaign_placement_key (placement_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ad_campaign_category (
    campaign_id BIGINT NOT NULL,
    category_code VARCHAR(32) NOT NULL,
    PRIMARY KEY (campaign_id, category_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 소재. PAID 는 제목·문구·랜딩 URL(https)·이미지, HOUSE 는 제목·문구·링크(앱 안 경로 또는 https)·이모지와
-- 선택 이미지. 링크는 한 컬럼이고 허용 형식은 소유 캠페인의 종류로 도메인이 가른다.
-- advertiser_id 는 소유 캠페인의 광고주 사본이다 — 광고주 API 가 (id, 요청자 광고주 id) 로 조회한다.
CREATE TABLE ad_creative (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campaign_id BIGINT NOT NULL,
    advertiser_id BIGINT NOT NULL,
    title VARCHAR(40) NOT NULL,
    body VARCHAR(90) NOT NULL,
    link_url VARCHAR(2048) NOT NULL,
    emoji VARCHAR(16) NULL,
    image_hash CHAR(64) NULL,
    status VARCHAR(16) NOT NULL,
    reject_reason VARCHAR(32) NULL,
    reviewed_by BIGINT NULL,
    reviewed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    KEY idx_ad_creative_campaign (campaign_id),
    KEY idx_ad_creative_advertiser (advertiser_id),
    KEY idx_ad_creative_status (status),
    CONSTRAINT chk_ad_creative_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 소재 이미지 — 다시 인코딩한 바이트를 내용 해시(SHA-256 hex)로 저장한다. 300KB 상한이라 MEDIUMBLOB.
CREATE TABLE ad_creative_asset (
    hash CHAR(64) NOT NULL PRIMARY KEY,
    content_type VARCHAR(32) NOT NULL,
    bytes MEDIUMBLOB NOT NULL,
    byte_size INT NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT chk_ad_creative_asset_type CHECK (content_type IN ('image/png', 'image/jpeg'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 지면 등록부 — 지면의 단일 원본. 키는 kebab-case 이고 FE 의 지면 키와 같다.
-- aspect_ratios 는 허용 비율 목록("W:H" 쉼표 구분). paid_allowed=0 인 지면은 HOUSE 만 받는다.
-- 노출하지 않을 지면을 비활성 행으로 두지 않는다 — 등록부에 없는 키는 광고 없음이다.
CREATE TABLE ad_placement (
    placement_key VARCHAR(64) NOT NULL PRIMARY KEY,
    host VARCHAR(128) NOT NULL,
    format VARCHAR(32) NOT NULL,
    aspect_ratios VARCHAR(64) NOT NULL,
    floor_micros BIGINT NOT NULL,
    active BOOLEAN NOT NULL,
    paid_allowed BOOLEAN NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT chk_ad_placement_key CHECK (REGEXP_LIKE(placement_key, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')),
    -- CPM 1회 과금액 = floor(입찰 / 1000) 이 1 마이크로 이상이 되도록
    CONSTRAINT chk_ad_placement_floor CHECK (floor_micros >= 1000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 등록부에 없는 지면 키로 들어온 요청 수 — 운영자가 등록할지 판단하는 목록.
CREATE TABLE ad_unregistered_placement (
    placement_key VARCHAR(64) NOT NULL PRIMARY KEY,
    requests BIGINT NOT NULL DEFAULT 0,
    first_seen_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 문맥 카테고리 — ads 가 소유하는 고정 목록.
CREATE TABLE ad_context_category (
    code VARCHAR(32) NOT NULL PRIMARY KEY,
    label VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- FE 가 보내는 문맥 키(blog:{slug} · game:{genre} · place:{광역 코드}) → 카테고리. 어드민이 관리한다.
CREATE TABLE ad_context_mapping (
    context_key VARCHAR(128) NOT NULL PRIMARY KEY,
    category_code VARCHAR(32) NOT NULL,
    updated_by BIGINT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 매핑이 없는 문맥 키(또는 빈 키)는 호스트 기본 카테고리로 간다.
CREATE TABLE ad_host_category (
    host VARCHAR(128) NOT NULL PRIMARY KEY,
    category_code VARCHAR(32) NOT NULL,
    updated_by BIGINT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 소재×지면 시간별 집계. Redis 카운터를 절대값으로 덮어쓴다(재실행해도 값이 같다).
-- closed_at 이 찬 시각만 정산 대상이다.
CREATE TABLE ad_creative_hourly (
    creative_id BIGINT NOT NULL,
    placement_key VARCHAR(64) NOT NULL,
    hour_kst DATETIME NOT NULL,
    campaign_id BIGINT NOT NULL,
    advertiser_id BIGINT NOT NULL,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    spend_micros BIGINT NOT NULL DEFAULT 0,
    closed_at DATETIME(6) NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (creative_id, placement_key, hour_kst),
    KEY idx_ad_creative_hourly_campaign (campaign_id, hour_kst),
    KEY idx_ad_creative_hourly_advertiser (advertiser_id, hour_kst),
    KEY idx_ad_creative_hourly_hour (hour_kst)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 지면 시간별 집계. requests·paid_filled 는 서버가 센 값, reported_* 는 FE 가 보고한 최종 채움 출처(참고치).
CREATE TABLE ad_placement_hourly (
    placement_key VARCHAR(64) NOT NULL,
    hour_kst DATETIME NOT NULL,
    requests BIGINT NOT NULL DEFAULT 0,
    paid_filled BIGINT NOT NULL DEFAULT 0,
    reported_paid BIGINT NOT NULL DEFAULT 0,
    reported_adsense BIGINT NOT NULL DEFAULT 0,
    reported_house BIGINT NOT NULL DEFAULT 0,
    reported_empty BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (placement_key, hour_kst),
    KEY idx_ad_placement_hourly_hour (hour_kst)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 원장 계정. 잔액은 이 행이 갖고, 분개와 같은 트랜잭션에서 id 순으로 행을 잠가 갱신한다.
-- 지갑(advertiser_id 있음)은 음수가 될 수 없다. 충전 원천은 가상 발행이라 음수로 내려간다.
CREATE TABLE ad_ledger_account (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    advertiser_id BIGINT NULL,
    balance_micros BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_ad_ledger_account_advertiser (advertiser_id),
    KEY idx_ad_ledger_account_type (type),
    CONSTRAINT chk_ad_ledger_account_type
        CHECK (type IN ('ADVERTISER_WALLET', 'NETWORK_REVENUE', 'PUBLISHER_PAYABLE', 'TOPUP_SOURCE')),
    CONSTRAINT chk_ad_ledger_account_owner CHECK ((type = 'ADVERTISER_WALLET') = (advertiser_id IS NOT NULL)),
    CONSTRAINT chk_ad_ledger_account_wallet_balance CHECK (type <> 'ADVERTISER_WALLET' OR balance_micros >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 원장 거래. 멱등 키가 유일하다(정산은 SETTLE:{캠페인}:{시각}).
-- REVERSAL 만 원 거래를 참조하고, 한 거래는 한 번만 역분개된다.
CREATE TABLE ad_ledger_transaction (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(16) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    reversed_transaction_id BIGINT NULL,
    actor_member_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_ad_ledger_transaction_idem (idempotency_key),
    UNIQUE KEY uk_ad_ledger_transaction_reversed (reversed_transaction_id),
    KEY idx_ad_ledger_transaction_type_created (type, created_at),
    CONSTRAINT chk_ad_ledger_transaction_type CHECK (type IN ('TOPUP', 'SETTLEMENT', 'REVERSAL')),
    CONSTRAINT chk_ad_ledger_transaction_reversal
        CHECK ((type = 'REVERSAL') = (reversed_transaction_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 분개. 한 거래의 분개 합은 0 이다(도메인 팩토리가 강제, 매일 검사).
CREATE TABLE ad_ledger_entry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    account_id BIGINT NOT NULL,
    amount_micros BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY idx_ad_ledger_entry_transaction (transaction_id),
    KEY idx_ad_ledger_entry_account (account_id, created_at),
    CONSTRAINT chk_ad_ledger_entry_amount CHECK (amount_micros <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 정산 기록 — (캠페인, 시각)당 한 행. 청구액이 0 이면 원장 거래가 없어 transaction_id 가 NULL 이다.
CREATE TABLE ad_settlement (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    campaign_id BIGINT NOT NULL,
    advertiser_id BIGINT NOT NULL,
    hour_kst DATETIME NOT NULL,
    spend_micros BIGINT NOT NULL,
    charged_micros BIGINT NOT NULL,
    transaction_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_ad_settlement_campaign_hour (campaign_id, hour_kst),
    KEY idx_ad_settlement_advertiser (advertiser_id, hour_kst),
    CONSTRAINT chk_ad_settlement_charged CHECK (charged_micros >= 0 AND charged_micros <= spend_micros)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 광고주별 「정산 완료 시각」 — 이 시각까지의 지출이 원장에 반영됐다. 결정의 지갑 여유 계산이 쓴다.
CREATE TABLE ad_advertiser_settled_through (
    advertiser_id BIGINT NOT NULL PRIMARY KEY,
    settled_through_hour_kst DATETIME NOT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── 시드 ────────────────────────────────────────────────────────────────

INSERT INTO ad_context_category (code, label, sort_order) VALUES
    ('TECH', '기술', 1),
    ('GAME', '게임', 2),
    ('TRAVEL', '여행', 3),
    ('SHOPPING', '쇼핑', 4),
    ('LIFESTYLE', '라이프스타일', 5);

INSERT INTO ad_host_category (host, category_code, updated_by, updated_at) VALUES
    ('blog.1989v.com', 'TECH', NULL, '2026-09-23 00:00:00'),
    ('game.1989v.com', 'GAME', NULL, '2026-09-23 00:00:00'),
    ('place.1989v.com', 'TRAVEL', NULL, '2026-09-23 00:00:00');

-- 1단계 지면. deal-hub-end 는 등록하지 않는다 — 제휴 고지 곁에서 광고와 제휴가 흐려진다.
INSERT INTO ad_placement
    (placement_key, host, format, aspect_ratios, floor_micros, active, paid_allowed, description, created_at, updated_at)
VALUES
    ('blog-post-end', 'blog.1989v.com', 'CARD', '1.91:1', 100000, TRUE, TRUE,
        '블로그 글 본문이 끝난 지점', '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    ('game-hub-end', 'game.1989v.com', 'CARD', '1.91:1', 100000, TRUE, TRUE,
        '게임 목록 끝 (게임 화면 안에는 두지 않는다)', '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    ('attraction-end', 'place.1989v.com', 'CARD', '1.91:1', 100000, TRUE, TRUE,
        '관광지 상세 끝 — 지도와 주변 목록 다음', '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    ('game-list-banner', 'game.1989v.com', 'BANNER', '1.91:1', 100000, TRUE, FALSE,
        '게임 목록 위 자체 홍보 배너 (HOUSE 전용)', '2026-09-23 00:00:00', '2026-09-23 00:00:00');

-- SYSTEM 광고주 — HOUSE 캠페인의 소유자. 회원·지갑이 없다.
INSERT INTO ad_advertiser (kind, member_id, display_name, status, created_at, updated_at)
VALUES ('SYSTEM', NULL, '1989v 하우스', 'ACTIVE', '2026-09-23 00:00:00', '2026-09-23 00:00:00');
SET @house_advertiser_id = LAST_INSERT_ID();

-- 네트워크 원장 계정 셋. 퍼블리셔는 1989v 하나라 퍼블리셔 미지급도 하나다.
INSERT INTO ad_ledger_account (type, advertiser_id, balance_micros, version, created_at, updated_at) VALUES
    ('NETWORK_REVENUE', NULL, 0, 0, '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    ('PUBLISHER_PAYABLE', NULL, 0, 0, '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    ('TOPUP_SOURCE', NULL, 0, 0, '2026-09-23 00:00:00', '2026-09-23 00:00:00');

-- 게임 목록 HOUSE 배너 — game 스키마의 game-list-banner 소재 3종을 그대로 옮긴다.
INSERT INTO ad_campaign (advertiser_id, name, status, start_at, created_at, updated_at)
VALUES (@house_advertiser_id, '게임 목록 자체 홍보', 'ACTIVE',
        '2026-09-23 00:00:00', '2026-09-23 00:00:00', '2026-09-23 00:00:00');
SET @house_campaign_id = LAST_INSERT_ID();

INSERT INTO ad_campaign_placement (campaign_id, placement_key) VALUES (@house_campaign_id, 'game-list-banner');

INSERT INTO ad_creative
    (campaign_id, advertiser_id, title, body, link_url, emoji, image_hash, status,
     reject_reason, reviewed_by, reviewed_at, created_at, updated_at)
VALUES
    (@house_campaign_id, @house_advertiser_id, 'IT 개념 사전', '트리맵으로 한눈에 보는 개발 개념 지도', '/', '📚', NULL,
        'APPROVED', NULL, NULL, '2026-09-23 00:00:00', '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    (@house_campaign_id, @house_advertiser_id, '커머스 쇼핑', '플랫폼 데모 상점에서 주문 플로우 체험', '/shop', '🛒', NULL,
        'APPROVED', NULL, NULL, '2026-09-23 00:00:00', '2026-09-23 00:00:00', '2026-09-23 00:00:00'),
    (@house_campaign_id, @house_advertiser_id, '포트폴리오', '이 플랫폼이 어떻게 만들어졌는지 보기', '/portfolio', '🗂️', NULL,
        'APPROVED', NULL, NULL, '2026-09-23 00:00:00', '2026-09-23 00:00:00', '2026-09-23 00:00:00');
