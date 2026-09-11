-- ADR-0069 — 혜택 링크 허브 (deal.1989v.com).
--
-- code-dictionary 스키마를 공유한다. game 처럼 전용 datasource 를 두지 않는 이유는
-- 테이블 3개에 독립 쓰기 경로가 없고 라이프사이클이 display_service 와 같기 때문이다.
-- 스키마 주인이 마이그레이션도 소유하므로 여기(호스트의 db/migration)에 둔다 —
-- Flyway 히스토리가 하나이므로 버전 수열도 하나여야 한다.

CREATE TABLE deal_category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    tagline VARCHAR(200),
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_deal_category_code (code),
    INDEX idx_deal_category_status_order (status, order_no),
    CONSTRAINT chk_deal_category_status CHECK (status IN ('OPEN', 'PREOPEN', 'HOLD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- revenue_type 이 이 테이블의 축이다 (ADR-0069).
--   AFFILIATE  제휴 프로그램 발급 트래킹 URL — 수수료 발생, 공정위 고지 대상
--   PLAIN      제휴 없는 곳의 공개 혜택 페이지 — 수익 없음, 고지 불요
--
-- target_url 은 **원본 그대로** 저장한다. 파라미터 재조립·서브ID 주입은 네트워크 약관
-- 위반이고 트래킹 쿠키를 깨뜨린다. 리다이렉터도 이 값을 그대로 302 로 넘긴다.
CREATE TABLE deal_offer (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(60) NOT NULL,
    category_id BIGINT NOT NULL,
    merchant VARCHAR(60) NOT NULL,
    title VARCHAR(120) NOT NULL,
    benefit VARCHAR(80) NOT NULL,
    summary VARCHAR(300),
    target_url VARCHAR(1000) NOT NULL,
    revenue_type VARCHAR(16) NOT NULL,
    network VARCHAR(40),
    status VARCHAR(16) NOT NULL DEFAULT 'PREOPEN',
    valid_from DATETIME,
    valid_until DATETIME,
    order_no INT NOT NULL DEFAULT 0,
    click_count BIGINT NOT NULL DEFAULT 0,
    link_status VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
    link_status_code INT,
    link_checked_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_deal_offer_slug (slug),
    INDEX idx_deal_offer_category_status_order (category_id, status, order_no),
    INDEX idx_deal_offer_valid_until (valid_until),
    INDEX idx_deal_offer_link_status (link_status),
    CONSTRAINT chk_deal_offer_revenue_type CHECK (revenue_type IN ('AFFILIATE', 'PLAIN')),
    CONSTRAINT chk_deal_offer_status CHECK (status IN ('OPEN', 'PREOPEN', 'HOLD')),
    CONSTRAINT chk_deal_offer_link_status CHECK (link_status IN ('OK', 'BROKEN', 'UNKNOWN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 클릭 로그. IP·전체 referrer·쿠키는 저장하지 않는다 — 클릭 수를 세는 데 필요 없고,
-- 보관하는 순간 개인정보 처리방침 대상이 된다. 90일 초과분은 헬스체크 CronJob 이 정리한다.
CREATE TABLE deal_offer_click (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    offer_id BIGINT NOT NULL,
    clicked_at DATETIME(3) NOT NULL,
    referrer_host VARCHAR(120),
    ua_family VARCHAR(40),
    INDEX idx_deal_click_offer_time (offer_id, clicked_at),
    INDEX idx_deal_click_time (clicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 규제 업권(의료·금융)은 행을 만들지 않는다 — 의료법 27조(영리 목적 환자 소개·알선·유인),
-- 금융소비자보호법(대출모집인 등록)이 "링크 타고 가서 결제하면 수수료" 구조를 직접 겨눈다.
-- 전시 테이블에 비전시 행을 심지 않는다는 ADR-0066 규칙과 같은 이유이기도 하다.
INSERT INTO deal_category (code, label, tagline, status, order_no) VALUES
    ('travel',       '여행',       '항공 · 숙소 · 투어 예약 혜택',      'OPEN', 10),
    ('commerce',     '커머스',     '쇼핑 적립 · 신규가입 쿠폰',         'OPEN', 20),
    ('subscription', '디지털구독', '스트리밍 · SaaS · 클라우드',        'OPEN', 30),
    ('education',    '교육',       '인강 · 자격증 · 어학',              'OPEN', 40),
    ('living',       '생활·통신',  '알뜰폰 · 인터넷 · 구독형 생활서비스', 'OPEN', 50);

-- 메인 런처 전시 타일 (ADR-0066). href 는 상대 경로 — 절대 URL 을 박으면 apex 의
-- 서브도메인 리다이렉트 로직을 우회하고 로컬 개발에서도 프로덕션으로 튄다.
-- code 가 이미 있으면 건드리지 않는다 (어드민에서 손본 값을 배포가 되돌리면 안 된다).
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no) VALUES
    ('deal', '혜택 링크', '여행 · 커머스 · 구독 혜택 모음', '/deal', 'OPEN', 45);
