-- 「사태」가 온라인 대전을 연다 (2026-09-15, 라운드 3). V92 는 다른 세션(귀야행 시드)이 먼저 썼다.
--
-- 릴레이(`/ws/games/landslide`, ADR-0088) 위 **결정론 락스텝** — 좌석마다 같은 시뮬을 돌리고 턴 레코드만
-- 방송한다. 방·대기실·공유는 온라인 대전 공통 로비 표준(`docs/standards/online-versus-lobby.md`)을 따른다.
-- 게임이 판 끝에 보내는 `board` 키와 **글자 그대로** 같아야 상세 페이지 탭에 보인다:
--   online   사람과 붙은 판 (빠른 대전 · 코드 방)
--   practice 봇 연습
-- 둘을 한 보드에 섞으면 봇 연습 점수가 온라인 순위를 덮는다 (V59 가 보드 축을 둔 이유).
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 폴드 호스트가 통째로 기동하지 못한다.

UPDATE game
SET score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'online', 'name', '온라인', 'nameEn', 'Online'),
        JSON_OBJECT('key', 'practice', 'name', '연습', 'nameEn', 'Practice')
    ),
    description = '쏘면 파이고, 파인 것은 흘러내리고, 뜨거우면 바람이 솟는다. 흐르는 지형 위에서 삼국~조선의 무장이 순서대로 겨루는 턴제 포격 대전. 궁수는 기류를 읽고, 포수는 지형을 무너뜨리고, 검사는 검기로 땅을 갈라 산사태를 낸다. 화산재는 안식각까지 흘러내리고 용암은 굳으며, 산사태에 파묻히면 파내야 한다. 드래그로 조준해 놓으면 날아가고 직전 궤적이 점선으로 남는다. 봇과 연습하거나, 빠른 대전·코드 방·초대 링크로 사람과 1대1. 창병·방패병·팀전·아이템은 다음 단계.',
    description_en = 'Turn-based artillery duel on terrain that flows. Archers read the wind, gunners collapse the ground, swordsmen cut the slope open and let it slide. Volcanic ash slides to its angle of repose, lava hardens, and anyone buried must dig out. Drag to aim, release to fire; your last trajectory stays as a dotted line. Practice against bots or face someone 1v1 through quick match, a code room, or an invite link. Spearmen, shieldmen, team play and items come next.',
    content_updated_at = NOW(6),
    updated_at = NOW(6)
WHERE slug = 'landslide';
