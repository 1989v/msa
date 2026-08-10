-- 랭킹 보드를 트랙으로 나눈다 — 무강화(BASE) / 영구 강화(MODDED).
--
-- 다회차 강화(로그라이트 메타 진행)를 런 기반 게임들에 넣기로 하면서 생긴 문제:
-- 강화가 붙으면 점수가 실력이 아니라 **누적 플레이타임**을 재게 된다. 한 게임일 때는
-- 로그라이트 통상 동작으로 넘겼지만 여러 게임에 퍼지면 랭킹 시스템 전체의 의미가 바뀐다.
--
-- 그래서 같은 게임 안에서 보드를 둘로 나눈다. 닉네임당 최고 기록이라는 규칙은 트랙 단위로
-- 유지되므로 유니크 키에 track 을 넣는다.
-- 기존 기록은 전부 강화 이전에 세워진 것이라 BASE 로 남는다.
ALTER TABLE game_score
    ADD COLUMN track VARCHAR(8) NOT NULL DEFAULT 'BASE' AFTER nickname,
    DROP INDEX uk_score_game_nick,
    ADD UNIQUE KEY uk_score_game_track_nick (game_id, track, nickname),
    DROP INDEX idx_score_game_score,
    ADD KEY idx_score_game_track_score (game_id, track, score DESC);
