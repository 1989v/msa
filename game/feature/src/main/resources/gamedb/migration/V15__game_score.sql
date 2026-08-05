-- 게임별 랭킹 — 닉네임당 최고 기록 1행 (게스트 친화, 인증 불요)
CREATE TABLE game_score (
    id         BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id    BIGINT       NOT NULL,
    nickname   VARCHAR(24)  NOT NULL,
    score      BIGINT       NOT NULL,
    detail     VARCHAR(64)  NULL,
    created_at DATETIME(6)  NOT NULL,
    updated_at DATETIME(6)  NOT NULL,
    UNIQUE KEY uk_score_game_nick (game_id, nickname),
    KEY idx_score_game_score (game_id, score DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;
