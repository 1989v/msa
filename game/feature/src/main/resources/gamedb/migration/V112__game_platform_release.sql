CREATE TABLE game_platform_release (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT NOT NULL,
    platform VARCHAR(32) NOT NULL,
    platform_ref VARCHAR(64) NULL,
    release_status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    audience VARCHAR(16) NOT NULL DEFAULT 'INVITE_ONLY',
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_game_platform_release (game_id, platform),
    CONSTRAINT ck_game_platform_release_platform CHECK (platform IN ('ROBLOX')),
    CONSTRAINT ck_game_platform_release_status CHECK (release_status IN ('DRAFT', 'BETA', 'RELEASED', 'DISABLED')),
    CONSTRAINT ck_game_platform_release_audience CHECK (audience IN ('PUBLIC', 'INVITE_ONLY')),
    CONSTRAINT ck_game_platform_release_ref CHECK (release_status NOT IN ('BETA', 'RELEASED') OR (platform_ref IS NOT NULL AND CHAR_LENGTH(platform_ref) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
