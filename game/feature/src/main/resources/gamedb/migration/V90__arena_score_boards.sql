-- AMP ARENA 가 플랫폼 순위표를 쓰기 시작한다 (2026-09-12).
--
-- 게임은 판이 끝나면 `POST /api/v1/games/arena/scores` 에 `board` 를 실어 보낸다 — 키는 게임 코드
-- (amp-arena/client/src/platform/score.ts)가 보내는 것과 **글자 그대로** 같아야 상세 페이지 탭에 보인다.
--   online   사람과 붙은 판 (빠른 대전·코드 방)
--   practice 봇 연습
-- 둘을 한 보드에 섞으면 봇 연습 점수가 온라인 순위를 덮는다 — V59 가 보드 축을 둔 이유 그대로다.
-- 플레이 세션은 카탈로그 상세 페이지가 열고 닫으므로(IFRAME 호스트) 게임은 세션 API 를 부르지 않는다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다.

UPDATE game
SET sdk_integrated = 1,
    score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'online', 'name', '온라인', 'nameEn', 'Online'),
        JSON_OBJECT('key', 'practice', 'name', '연습', 'nameEn', 'Practice')
    ),
    content_updated_at = NOW(6),
    updated_at = NOW(6)
WHERE slug = 'arena';
