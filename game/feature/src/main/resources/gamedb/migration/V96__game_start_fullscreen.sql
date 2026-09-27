-- ▶ 플레이 때 무대를 전체화면으로 연다 — 가로 잠금 없이.
--
-- 가로 전용 게임(orientation = 'LANDSCAPE')은 이미 시작할 때 전체화면 + 가로 잠금으로 연다.
-- 세로·가로를 둘 다 받는 게임 중에도 화면이 넓어야 판이 읽히는 게임이 있다 — 헥스 4X 인
-- EPOCH OF NATIONS 가 그렇다. 방향을 LANDSCAPE 로 바꾸면 세로 배치를 버리고 폰을 돌리게 하므로,
-- 방향과 따로 「시작할 때 전체화면」 한 칸을 둔다. 기본값 0 — 다른 게임은 동작이 바뀌지 않는다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 폴드 호스트가 통째로 기동하지 못한다.

ALTER TABLE game ADD COLUMN start_fullscreen TINYINT(1) NOT NULL DEFAULT 0 AFTER supports_mobile;

UPDATE game SET start_fullscreen = 1, updated_at = NOW(6) WHERE slug = 'epoch-of-nations';
