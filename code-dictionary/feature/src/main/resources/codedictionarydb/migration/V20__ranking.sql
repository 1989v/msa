-- ADR-0081 — 랭킹 리더보드 플랫폼 (rank.1989v.com).
--
-- deal/blog 과 같이 code-dictionary 스키마를 공유한다. 스키마 주인이 마이그레이션도
-- 소유하므로 여기(호스트의 db/migration)에 둔다 — Flyway 히스토리가 하나이므로
-- 버전 수열도 하나여야 한다.

-- 랭킹 하나 — "무엇을(domain) 무엇으로(metric) 어느 범위에서(scope_key) 줄세우는가".
-- 보드는 순위를 들고 있지 않다. 순위는 ranking_snapshot 에 시점과 함께 붙는다.
--
-- source_label 이 NOT NULL 인 것은 장식이 아니다. 공공누리·KOGL·CC BY 원천은 출처 표시가
-- 의무이고, 표기를 화면 코드에 흩으면 원천이 늘 때 누락이 생긴다. 보드가 자기 출처를 들고 다닌다.
CREATE TABLE ranking_board (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(100) NOT NULL,
    domain VARCHAR(30) NOT NULL,
    metric VARCHAR(30) NOT NULL,
    direction VARCHAR(4) NOT NULL,
    scope_key VARCHAR(20) NOT NULL,
    scope_name VARCHAR(60) NOT NULL,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(200),
    unit VARCHAR(20) NOT NULL,
    source_label VARCHAR(100) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    latest_snapshot_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_ranking_board_slug (slug),
    INDEX idx_ranking_board_domain_scope (domain, scope_key),
    INDEX idx_ranking_board_status (status),
    CONSTRAINT chk_ranking_board_direction CHECK (direction IN ('ASC', 'DESC')),
    CONSTRAINT chk_ranking_board_status CHECK (status IN ('OPEN', 'PREOPEN', 'HOLD'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 한 시점의 순위 묶음. 순위를 "현재값"으로 덮어쓰지 않는 이유는 등락 때문이다 —
-- "지난주 대비 ↑3" 은 이전 시점이 남아 있어야만 만들 수 있다. 부수로 시계열이 남는다.
CREATE TABLE ranking_snapshot (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    board_id BIGINT NOT NULL,
    captured_at DATETIME(3) NOT NULL,
    entry_count INT NOT NULL DEFAULT 0,
    INDEX idx_ranking_snapshot_board_time (board_id, captured_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 순위 한 줄.
--   rank_no    `rank` 는 MySQL 8 예약어라 쓸 수 없다
--   prev_rank  NULL 은 **신규 진입**이지 0 이나 최하위가 아니다
--   payload    도메인 이질성(브랜드·셀프여부 / kcal / 인허가일자)을 흡수한다.
--              정규 컬럼으로 펴면 nullable 이 끝없이 늘고 도메인마다 마이그레이션이 붙는다.
CREATE TABLE ranking_entry (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    snapshot_id BIGINT NOT NULL,
    rank_no INT NOT NULL,
    subject_key VARCHAR(120) NOT NULL,
    subject_name VARCHAR(200) NOT NULL,
    score DECIMAL(18,4) NOT NULL,
    prev_rank INT,
    payload JSON,
    INDEX idx_ranking_entry_snapshot_rank (snapshot_id, rank_no),
    INDEX idx_ranking_entry_subject (subject_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 주유소 — 오피넷 수집분 (ADR-0081 §3).
--
-- 좌표가 두 벌인 것이 중요하다. 원천의 GIS_X_COOR/GIS_Y_COOR 는 **KATEC(TM128)** 이고,
-- 위경도로 착각해 그대로 저장하면 값이 십만 단위라 그럴듯한 채로 지도 핀만 전부 어긋난다.
-- 수집기가 WGS84 로 변환해 latitude/longitude 에 넣고, 원천 좌표는 katec_x/katec_y 에
-- 그대로 남긴다 (data-sources.md §0 ① — 원천 필드는 버리지 않는다).
CREATE TABLE gas_station (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    opinet_id VARCHAR(30) NOT NULL,
    name VARCHAR(200) NOT NULL,
    brand_code VARCHAR(10),
    brand_name VARCHAR(50),
    is_self BOOLEAN NOT NULL DEFAULT FALSE,
    katec_x DECIMAL(14,4),
    katec_y DECIMAL(14,4),
    latitude DECIMAL(10,7),
    longitude DECIMAL(10,7),
    area_code VARCHAR(10),
    area_name VARCHAR(60),
    road_address VARCHAR(300),
    jibun_address VARCHAR(300),
    tel VARCHAR(30),
    has_car_wash BOOLEAN,
    has_maintenance BOOLEAN,
    has_cvs BOOLEAN,
    is_24h BOOLEAN,
    synced_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_gas_station_opinet (opinet_id),
    INDEX idx_gas_station_area (area_code),
    INDEX idx_gas_station_geo (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 유종별 판매가. 한 주유소가 여러 유종을 팔고 원천도 유종별 배열로 준다.
-- 가격을 gas_station 의 컬럼으로 펴면 유종이 늘 때마다 마이그레이션이 붙는다.
CREATE TABLE gas_station_price (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    station_id BIGINT NOT NULL,
    product_code VARCHAR(10) NOT NULL,
    price INT NOT NULL,
    traded_at DATE,
    updated_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_gas_price_station_product (station_id, product_code),
    INDEX idx_gas_price_product_price (product_code, price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 메인 런처 전시 타일 (ADR-0066). href 는 상대 경로 — 절대 URL 을 박으면 apex 의
-- 서브도메인 리다이렉트를 우회하고 로컬 개발에서도 프로덕션으로 튄다.
-- 실데이터(오피넷 키)가 붙기 전이라 PREOPEN 으로 연다.
INSERT IGNORE INTO display_service (code, label, tagline, href, status, order_no) VALUES
    ('rank', '랭킹', '지역별 최저가 주유소 · 경로 위 주유소 찾기', '/rank', 'PREOPEN', 55);
