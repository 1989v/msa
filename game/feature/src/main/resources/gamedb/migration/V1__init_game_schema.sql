-- ADR-0059 — game_db 스키마 초기화 (설계: docs/specs/2026-07-06-game-platform-entities-design.md §4)

CREATE TABLE game (
    id                 BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug               VARCHAR(100) NOT NULL,
    title              VARCHAR(200) NOT NULL,
    description        TEXT         NOT NULL,
    thumbnail_url      VARCHAR(500) NOT NULL,
    cover_url          VARCHAR(500) NULL,
    engine_type        VARCHAR(20)  NOT NULL,
    load_type          VARCHAR(20)  NOT NULL,
    entry_url          VARCHAR(500) NOT NULL,
    orientation        VARCHAR(16)  NOT NULL,
    supports_mobile    TINYINT(1)   NOT NULL DEFAULT 1,
    developer_name     VARCHAR(100) NOT NULL,
    sdk_integrated     TINYINT(1)   NOT NULL DEFAULT 0,
    status             VARCHAR(16)  NOT NULL,
    tags               JSON         NULL,
    released_at        DATETIME(6)  NULL,
    content_updated_at DATETIME(6)  NULL,
    created_at         DATETIME(6)  NOT NULL,
    updated_at         DATETIME(6)  NOT NULL,
    UNIQUE KEY uk_game_slug (slug),
    KEY idx_game_status (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_tag (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug          VARCHAR(50) NOT NULL,
    name          VARCHAR(50) NOT NULL,
    display_order INT         NOT NULL DEFAULT 0,
    UNIQUE KEY uk_game_tag_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_tag_map (
    id       BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id  BIGINT      NOT NULL,
    tag_slug VARCHAR(50) NOT NULL,
    UNIQUE KEY uk_game_tag (game_id, tag_slug),
    KEY idx_tag_map_slug (tag_slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_stats (
    game_id           BIGINT PRIMARY KEY,
    play_count        BIGINT NOT NULL DEFAULT 0,
    rating_sum        BIGINT NOT NULL DEFAULT 0,
    rating_count      BIGINT NOT NULL DEFAULT 0,
    weekly_play_count BIGINT NOT NULL DEFAULT 0
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_collection (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    slug          VARCHAR(100) NOT NULL,
    title         VARCHAR(100) NOT NULL,
    type          VARCHAR(16)  NOT NULL,
    tag_slug      VARCHAR(50)  NULL,
    display_order INT          NOT NULL DEFAULT 0,
    active        TINYINT(1)   NOT NULL DEFAULT 1,
    game_ids      JSON         NULL,
    UNIQUE KEY uk_game_collection_slug (slug)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_play_session (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_key  VARCHAR(64) NOT NULL,
    game_id      BIGINT      NOT NULL,
    member_id    BIGINT      NULL,
    device_type  VARCHAR(16) NOT NULL,
    started_at   DATETIME(6) NOT NULL,
    ended_at     DATETIME(6) NULL,
    duration_sec BIGINT      NULL,
    UNIQUE KEY uk_session_key (session_key),
    KEY idx_session_game (game_id, started_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE game_rating (
    id        BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id   BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    score     INT    NOT NULL,
    UNIQUE KEY uk_rating_game_member (game_id, member_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
