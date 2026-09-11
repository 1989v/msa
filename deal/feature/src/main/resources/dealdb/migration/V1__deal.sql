-- ADR-0069 / ADR-0093 — 혜택 링크 허브 (deal.1989v.com) 전용 스키마 `deal_db`.
--
-- 원래는 code-dictionary 스키마를 공유했다("테이블 3개에 독립 쓰기 경로가 없다"는 판단).
-- 그 판단은 틀렸다 — `/go/{slug}` 리다이렉터가 click_count 를 올리고 deal_offer_click 에
-- 행을 넣는다. 상시 쓰기 경로가 있고, ADR-0093 이 deal 을 commerce 파드로 옮기면서
-- 스키마 공유는 「서비스 간 DB 공유 금지」 위반이 된다. 그래서 자기 스키마로 뗀다.
--
-- 정의는 code-dictionary 의 V13__deal.sql 에서 **그대로** 옮겼다(컬럼·인덱스·제약 동일).
-- 기존 행은 마이그레이션이 아니라 전환 시점의 일회성 복사로 옮긴다 — 원본 스키마가
-- 없는 새 환경에서도 이 파일이 그대로 돌아야 하기 때문이다.
-- display_service 시드는 가져오지 않는다. 그 테이블은 code-dictionary 것이다.

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
