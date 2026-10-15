CREATE TABLE market_geometry_request (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    market_id BIGINT NOT NULL,
    steward_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    kind VARCHAR(20) NOT NULL,
    geometry JSON NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    decided_by_member_id BIGINT NULL,
    decided_at DATETIME(6) NULL,
    decision_reason TEXT NULL,
    applied_change_log_id BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_geometry_request_market (market_id, id),
    INDEX idx_geometry_request_status (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
