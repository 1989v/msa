-- ADR-0081 / ADR-0093 ②b — 랭킹 리더보드 (rank.1989v.com) 전용 스키마 `ranking_db`.
--
-- 원래는 code-dictionary 스키마를 공유했다. ADR-0093 이 ranking 을 content 파드로 옮기면서
-- 스키마 공유는 「서비스 간 DB 공유 금지」 위반이 되므로 자기 스키마로 뗀다.
--
-- 정의는 code-dictionary 의 V20__ranking.sql 에서 **그대로** 옮겼다(컬럼·인덱스·제약 동일).
-- 이전할 행은 없다 — 다섯 테이블 모두 0행이다(가스 수집이 OPINET_API_KEY 부재로 한 번도
-- 성공한 적이 없다). 그래서 일회성 복사도 필요 없다.

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

-- display_service 시드는 가져오지 않는다. 그 테이블은 code-dictionary 것이고
-- 이미 그쪽 V20 이 넣어 뒀다(INSERT IGNORE 라 재실행해도 무해하지만, 남의 스키마다).
