-- 장르 카테고리 — 게임당 단일 대표 분류 (tags 는 다중 성격 유지)
ALTER TABLE game
    ADD COLUMN genre VARCHAR(16) NOT NULL DEFAULT 'CASUAL' AFTER status;

CREATE INDEX idx_game_genre ON game (genre, status);

UPDATE game SET genre = 'PUZZLE'    WHERE slug = 'concept-memory';
UPDATE game SET genre = 'EDUCATION' WHERE slug IN ('fill-blank-quiz', 'code-magnifier');
UPDATE game SET genre = 'ARCADE'    WHERE slug IN ('concept-cascade', 'snake');
UPDATE game SET genre = 'RPG'       WHERE slug = 'overworld-quest';
