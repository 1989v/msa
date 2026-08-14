-- 카탈로그 소개문에서 타사 게임 명칭 제거 (IP 전수 점검, 2026-08-15).
-- 장르 서술은 유지하되 특정 상표를 부르지 않는다 — "하데스류" → "로그라이크 액션",
-- "킹오브파이터식/KOF-style" → "대전격투식/fighting-game". 원문 시드(V29·V30)는 적용된
-- 마이그레이션이라 손대지 않고(체크섬) 데이터만 갱신한다.

UPDATE game
SET description        = REPLACE(description, '하데스류 로그라이크', '로그라이크 액션'),
    content_updated_at = NOW(6)
WHERE slug = 'nether-return';

UPDATE game
SET description        = REPLACE(description, '하데스류 로그라이크 액션', '로그라이크 액션'),
    description_en     = REPLACE(description_en, 'A Hades-like roguelike action game', 'A roguelike action game'),
    content_updated_at = NOW(6)
WHERE slug = 'abyssal-crown';

UPDATE game
SET description        = REPLACE(description, '킹오브파이터식 모션 커맨드', '대전격투식 모션 커맨드'),
    description_en     = REPLACE(description_en, 'KOF-style motion commands', 'fighting-game motion commands'),
    content_updated_at = NOW(6)
WHERE slug = 'raging-fist-saga';
