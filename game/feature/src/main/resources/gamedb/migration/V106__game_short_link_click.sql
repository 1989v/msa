-- ADR-0106 — 게임 단축 주소(1989v.com/g/{code}) 클릭 원장 + 게임별 누적 수.
--
-- 코드는 game.id 에서 계산하므로(ShortCode) 코드 컬럼이 없다.
-- 원장 필드는 deal_offer_click 과 같다 — 대상 id·시각·리퍼러 호스트·UA 계열. IP 는 저장하지 않는다.
-- 보존 90일(ADR-0077). 크롤러·미리보기 봇은 기록하지 않는다.
CREATE TABLE game_short_link_click (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    game_id BIGINT NOT NULL,
    clicked_at DATETIME(3) NOT NULL,
    referrer_host VARCHAR(120),
    ua_family VARCHAR(40),
    INDEX idx_game_short_link_click_game_time (game_id, clicked_at),
    INDEX idx_game_short_link_click_time (clicked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 게임별 누적 클릭 수. 원장을 보존기간으로 지워도 남는다.
-- game 행에 컬럼을 두지 않는다 — 게임 행에 실시간 카운터를 두지 않는 규칙(game/CLAUDE.md).
-- INSERT … ON DUPLICATE KEY UPDATE 로 원자적으로 올린다.
CREATE TABLE game_short_link_stat (
    game_id BIGINT PRIMARY KEY,
    click_count BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
