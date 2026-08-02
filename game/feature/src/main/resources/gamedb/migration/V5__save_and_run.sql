-- 클라우드 세이브 + 로그라이크 런 (설계 §4.2 — 로그라이크/몬스터 RPG 공통 기반)

CREATE TABLE game_save_data (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id    BIGINT      NOT NULL,
    member_id  BIGINT      NOT NULL,
    data       JSON        NOT NULL,
    version    BIGINT      NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_save_game_member (game_id, member_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_run (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    run_key     VARCHAR(64) NOT NULL,
    game_id     BIGINT      NOT NULL,
    member_id   BIGINT      NULL,
    seed        BIGINT      NOT NULL,
    status      VARCHAR(16) NOT NULL,
    outcome     VARCHAR(32) NULL,
    created_at  DATETIME(6) NOT NULL,
    consumed_at DATETIME(6) NULL,
    UNIQUE KEY uk_run_key (run_key),
    KEY idx_run_game_member (game_id, member_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
