-- ADR-0066 — 1989v.com 메인에 전시하는 서비스.
--
-- 기존 service 테이블과 다른 축이다. 그쪽은 배포 단위(마이크로서비스) 목록이라
-- common(공유 라이브러리)·gateway 처럼 방문자가 들어갈 수 없는 항목이 섞여 있다.
-- 여기 있는 건 전시 대상 — 사용자가 클릭해 들어가는 진입점이다.
--
-- status (커머스 전시 상태 관례):
--   OPEN    전시 O, 진입 O
--   PREOPEN 전시 O, 진입 X — 오픈 예정. 화면에서는 딤드로 그린다.
--           DRAFT 를 쓰지 않는 이유: DRAFT 는 전시되지 않는 작성 중 상태라 성격이 반대다.
--   HOLD    전시 X. 운영 중 잠시 내릴 때 쓴다 — 행을 지우면 문구·링크·순서를 다시 입력해야 한다.
--           애초에 전시할 생각이 없는 서비스(퀀트·기프티콘 등 프라이빗)는 여기에 넣지 않는다.

CREATE TABLE display_service (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(40) NOT NULL,
    label VARCHAR(80) NOT NULL,
    tagline VARCHAR(200),
    href VARCHAR(300),
    status VARCHAR(16) NOT NULL DEFAULT 'PREOPEN',
    order_no INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_display_service_code (code),
    INDEX idx_display_service_status_order (status, order_no),
    CONSTRAINT chk_display_service_status CHECK (status IN ('OPEN', 'PREOPEN', 'HOLD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- href 는 상대 경로로 둔다. apex 프로덕션에서 place/game 을 서브도메인으로 보내는 리다이렉트가
-- 이미 App.tsx 에 있어서, 절대 URL 을 박으면 그 로직을 우회하고 로컬 개발에서도 프로덕션으로 튄다.
--
-- code 가 이미 있으면 건드리지 않는다 — 어드민에서 손본 값을 배포가 되돌리면 안 된다 (V8 과 같은 규칙).
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no) VALUES
    ('place',        '한국 관광 검색', '관광지 · 지도 · 근처 검색',              '/place',         'OPEN',    10),
    ('game',         '게임',           '웹 게임 카탈로그 · 바로 플레이',          '/games',         'OPEN',    20),
    ('tech',         'IT',             '코드에서 뽑은 개념 사전 · 그래프 · 트리맵', '/tech',          'OPEN',    30),
    ('commerce',     '커머스',         '상품 검색 → 주문 → 주문내역 (데모)',      '/shop',          'OPEN',    40),
    ('portfolio',    '포트폴리오',     '만든 것들과 그때의 판단',                 '/portfolio',     'OPEN',    50),
    ('fulfillment',  '풀필먼트',       '재고 · 창고 · 출고',                     NULL,             'PREOPEN', 60);
