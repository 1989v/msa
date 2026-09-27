-- ADR-0102: legacy score tables remain unchanged and are never claimed by nickname.
CREATE TABLE game_player_profile (
    player_id VARCHAR(36) NOT NULL PRIMARY KEY,
    member_id BIGINT NULL,
    guest_token_hash VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    nickname VARCHAR(32) NOT NULL,
    nickname_key VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL,
    UNIQUE KEY uk_player_member (member_id),
    UNIQUE KEY uk_player_guest (guest_token_hash),
    UNIQUE KEY uk_player_nickname (nickname_key),
    CONSTRAINT ck_player_owner CHECK ((member_id IS NOT NULL) <> (guest_token_hash IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_player_score (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT NOT NULL,
    player_id VARCHAR(36) NOT NULL,
    track VARCHAR(8) NOT NULL,
    board VARCHAR(24) NOT NULL,
    score BIGINT NOT NULL,
    detail VARCHAR(64) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_player_score_game_track_board (game_id, track, board, player_id),
    KEY idx_player_score_board (game_id, track, board, score DESC),
    KEY idx_player_score_owner (player_id, game_id),
    CONSTRAINT fk_player_score_profile FOREIGN KEY (player_id) REFERENCES game_player_profile(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE game_player_score_daily (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT NOT NULL,
    player_id VARCHAR(36) NOT NULL,
    track VARCHAR(8) NOT NULL,
    board VARCHAR(24) NOT NULL,
    play_date DATE NOT NULL,
    score BIGINT NOT NULL,
    detail VARCHAR(64) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY uk_player_daily_game_track_board_date (game_id, track, board, play_date, player_id),
    KEY idx_player_daily_board (game_id, track, board, play_date, score DESC),
    CONSTRAINT fk_player_daily_profile FOREIGN KEY (player_id) REFERENCES game_player_profile(player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
