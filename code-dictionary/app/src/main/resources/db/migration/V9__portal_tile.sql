-- ADR-0066 — 1989v.com 메인의 도메인 타일.
--
-- 기존 service 테이블과 다른 축이다. 그쪽은 배포 단위(마이크로서비스) 목록이라
-- common(공유 라이브러리)·gateway 처럼 방문자가 들어갈 수 없는 항목이 섞여 있다.
-- 여기 있는 건 사용자가 실제로 클릭해 들어가는 진입점이다.
--
-- status:
--   LIVE   노출 + 진입 가능
--   SOON   노출하되 딤드. 실제 로드맵만 — 준비중이 많으면 "끝맺은 게 없다"로 읽힌다
--   HIDDEN 비노출. 존재하지만 공개하지 않는 프라이빗 서비스 (지웠다 넣는 것보다 상태 전환이 명확)

CREATE TABLE portal_tile (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    tagline VARCHAR(200),
    href VARCHAR(300),
    status VARCHAR(16) NOT NULL DEFAULT 'SOON',
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_portal_tile_code (code),
    INDEX idx_portal_tile_status_order (status, order_no),
    CONSTRAINT chk_portal_tile_status CHECK (status IN ('LIVE', 'SOON', 'HIDDEN'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- href 는 상대 경로로 둔다. apex 프로덕션에서 place/game 을 서브도메인으로 보내는 리다이렉트가
-- 이미 App.tsx 에 있어서, 절대 URL 을 박으면 그 로직을 우회하고 로컬 개발에서도 프로덕션으로 튄다.
--
-- code 가 이미 있으면 건드리지 않는다 — 어드민에서 손본 값을 배포가 되돌리면 안 된다 (V8 과 같은 규칙).
INSERT IGNORE INTO portal_tile (code, label, tagline, href, status, order_no) VALUES
    ('place',        '한국 관광 검색', '관광지 · 지도 · 근처 검색',              '/place',         'LIVE',   10),
    ('game',         '게임',           '웹 게임 카탈로그 · 바로 플레이',          '/games',         'LIVE',   20),
    ('tech',         'IT',             '코드에서 뽑은 개념 사전 · 그래프 · 트리맵', '/tech',          'LIVE',   30),
    ('commerce',     '커머스',         '상품 검색 → 주문 → 주문내역 (데모)',      '/shop',          'LIVE',   40),
    ('portfolio',    '포트폴리오',     '만든 것들과 그때의 판단',                 '/portfolio',     'LIVE',   50),
    ('fulfillment',  '풀필먼트',       '재고 · 창고 · 출고',                     NULL,             'SOON',   60),
    ('quant',        '퀀트',           '전략 백테스트 · 실매매',                  '/quant/',        'HIDDEN', 70),
    ('gifticon',     '기프티콘',       '기프티콘 관리 · 공유 그룹',               '/gifticon/',     'HIDDEN', 80),
    ('agent-viewer', '에이전트 뷰어',  'AI 에이전트 실행 기록 열람',              '/agent-viewer/', 'HIDDEN', 90);
