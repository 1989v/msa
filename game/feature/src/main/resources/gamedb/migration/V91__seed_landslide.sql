-- 사태(沙汰) — 흐르는 지형 위의 턴제 포격 대전. BETA 로 올린다 (수직 슬라이스: 노템전 · 궁수 1v1 vs 봇 · 화산).
--
-- 별도 서버 파드가 없다. 정적 클라이언트는 games 서브모듈 `landslide/` 에서 나간다. 온라인 대전은 이 플랫폼의
-- 릴레이(`/ws/games/landslide`, ADR-0088 N석) 위 결정론 락스텝으로 설계돼 있고(PRD §7) 슬라이스에는 아직 없다 —
-- 그래서 보드는 `practice`(봇 연습) 하나만 선언한다. 온라인이 들어오면 UPDATE 마이그레이션으로 `online` 보드를 더한다.
-- 규칙·아트의 원본: docs/specs/2026-09-13-landslide-prd.md · docs/specs/2026-09-13-landslide/design/art/.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 폴드 호스트가 통째로 기동하지 못한다(여러 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('landslide', '사태',
     '쏘면 파이고, 파인 것은 흘러내리고, 뜨거우면 바람이 솟는다. 흐르는 지형 위에서 삼국~조선의 무장이 순서대로 활을 쏘는 턴제 포격 대전. 화산재는 안식각까지 흘러내리고 용암은 굳으며, 용암 위로 솟는 기류가 화살을 밀어 올린다. 산사태로 상대를 파묻고, 파묻히면 파내야 한다. 드래그로 조준해 놓으면 날아가고, 직전 궤적이 점선으로 남는다. 지금은 궁수 1대1 봇 연습(화산) — 병과 다섯·템전·8인·온라인은 다음 단계.',
     'Landslide',
     'Turn-based artillery duel on terrain that flows. Every shot digs, what it digs slides down to its angle of repose, and heat over lava lifts your arrows. Bury opponents under landslides — and dig yourself out when buried. Drag to aim, release to fire; your last trajectory stays as a dotted line. Currently archer 1v1 vs bot on the volcano map — five classes, items, 8 players and online come next.',
     '/games/thumbs/shots/landslide.jpg', NULL, 'HTML5',
     'IFRAME', '/games/landslide/index.html', 'LANDSCAPE', 1, 'kgd', 1, 'BETA',
     'VERSUS', '["versus","artillery","turn-based","physics","bot"]',
     JSON_ARRAY(JSON_OBJECT('key', 'practice', 'name', '연습', 'nameEn', 'Practice')),
     NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    sdk_integrated = VALUES(sdk_integrated), score_boards = VALUES(score_boards),
    status = VALUES(status), content_updated_at = NOW(6);

-- released_at=NOW(6) — BETA 부터는 공개 상태라 체크 제약(chk_game_released_when_visible)이 출시 시각을 요구한다.
-- orientation='LANDSCAPE' — 가로 전용. 세로 터치 기기에서는 게임이 스스로 화면을 90° 돌린다.
-- supports_mobile=1 근거: 세로 390×844(회전)·가로 844×390 CDP 실측 — 탭만으로 부팅·조준·발사, 누름 대상 ≥44px, 콘솔 0
--   (docs/specs/2026-09-13-landslide/verifications/slice-report.md §3.3). 실기 프레임·발열은 미측정.
-- sdk_integrated=1 — 판이 끝나면 `PlatformAdapter.runEnd({score, detail, board:'practice'})` 로 순위표에 올린다.
--   점수 = 승 100 · 격파 30 · 피해 1. 서버 세이브는 없다(판 단위 게임).

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         -- game_tag 에 실재하는 슬러그만 넣는다. 없는 것은 EXISTS 에 걸러지고 자유 문자열은 위 tags JSON 이 갖는다
         CROSS JOIN (SELECT 'versus' AS slug UNION ALL SELECT 'strategy' UNION ALL SELECT 'physics') t
WHERE g.slug = 'landslide'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'landslide'
ON DUPLICATE KEY UPDATE play_count = play_count;
