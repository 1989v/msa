-- EPOCH OF NATIONS — 헥스 대륙 위 턴제 4X 전략(탐험·확장·개발·정복). game-forge 클린 세션 제작, 클로드 디자인 아트.
-- BETA 로 올린다: forge 게이트 17/17 · 온라인 E2E(개발 릴레이) 통과. 실기기 발열·운영 릴레이 대전은 배포 뒤 확인.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 여러 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('epoch-of-nations', 'EPOCH OF NATIONS',
     '최대 128×80칸 헥스 대륙에서 문명 12개와 도시국가 24개가 석기 시대부터 우주 시대까지 겨루는 턴제 4X 전략. 개척자로 도시를 세우고 특수 지구 12종을 올리며, 기술 84개와 사회 제도 64개를 연구해 정부와 정책 카드를 고른다. 종교를 창시해 전도하고, 교역로를 깔고, 외교로 동맹과 세계 의회 표를 모으거나 전쟁으로 수도를 빼앗는다. 승리는 과학·문화·정복·종교·외교 다섯 갈래. AI 는 첫 판부터 선점 확장과 초반 러시를 하고, 공격 한 턴 전에 목표 칸을 예고한다. 판은 매 턴 자동 저장되고 슬롯 셋에 이어 둘 수 있다. 빠른 대전·코드 방·초대 링크로 사람과 동시 턴 대전도 된다(빈 자리는 AI).',
     'EPOCH OF NATIONS',
     'A turn-based 4X strategy game on a hex continent of up to 128×80 tiles, where 12 nations and 24 city-states compete from the stone age to the space age. Found cities with settlers, raise twelve kinds of districts, research 84 technologies and 64 civics, and pick governments and policy cards. Found a religion and spread it, lay trade routes, win allies and world-congress votes through diplomacy, or take capitals by war. Five paths to victory: science, culture, domination, religion and diplomacy. The AI expands and rushes from the first game and marks its target tile one turn before it attacks. Every turn autosaves, with three save slots. Play simultaneous-turn matches against people through quick match, code rooms or invite links; empty seats are taken by the AI.',
     '/games/thumbs/shots/epoch-of-nations.jpg', NULL, 'HTML5',
     'IFRAME', '/games/epoch-of-nations/index.html', 'BOTH', 1, 'kgd', 1, 'BETA',
     'STRATEGY', '["strategy","4x","turn-based","hex","empire-building","multiplayer","online"]',
     JSON_ARRAY(
         JSON_OBJECT('key', 'online', 'name', '온라인', 'nameEn', 'Online'),
         JSON_OBJECT('key', 'practice', 'name', 'AI 대전', 'nameEn', 'vs AI')
     ),
     NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    score_boards = VALUES(score_boards),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='BOTH' — 세로는 하단 명령 시트, 가로는 좌하단 패널로 배치를 바꾼다. 조작은 네이티브 터치(칸 탭·이웃 칸 탭 이동), 가상패드 없음.
-- supports_mobile=1 근거: forge 게이트 390×844·844×390 실측 — 선택 유닛 46 CSS px, 넘침 없음, 터치 12곳 죽은 입력 0, 콘솔 에러 0.
--   통합본(플랫폼 스크립트 포함) 재측정: 순위표 버튼(🏆)과 조작 겹침 0, 콘솔 에러 0. 실기기 발열은 미측정.
-- sdk_integrated=1 — PlatformAdapter.runEnd 점수(판 끝 한 번, board online/practice). 세이브는 기기 로컬만 —
--   한 판 직렬화가 수백 KB 라 서버 세이브 64KB 상한을 넘는다.
-- score_boards 의 key 는 게임이 판 끝에 보내는 board 와 글자 그대로 같아야 상세 페이지 탭에 보인다.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         -- game_tag 에 실재하는 슬러그만 넣는다. 없는 것은 EXISTS 에 걸러지고 자유 문자열은 위 tags JSON 이 갖는다
         CROSS JOIN (SELECT 'strategy' AS slug UNION ALL SELECT 'turn-based' UNION ALL SELECT 'multiplayer' UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'epoch-of-nations'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'epoch-of-nations'
ON DUPLICATE KEY UPDATE play_count = play_count;
