-- 좀비 행군 — 영지를 넓히는 좀비 전략. 캔버스 라인.
--
-- 이 게임의 축: **죽인 사람이 몇 초 뒤 일어나 내 편이 된다.** 그래서 「이겼다」가
-- 「군단이 늘었다」와 같은 말이고, 사제(시체를 태운다)가 전투의 우선 표적이 된다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
-- 카피를 바꿔야 하면 새 버전으로 UPDATE 를 낸다.

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('zombie-march', '좀비 행군',
     '좀비 군단을 손가락으로 몰아 왕국을 삼킨다. 화면을 끌면 해골 표식이 움직이고 군단이 그리로 몰려가 닿는 사람을 문다. 쓰러진 사람은 몇 초 뒤 일어나 내 편이 되고, 기사는 갑옷을 두른 좀비 기사가 된다 — 그래서 크게 이길수록 다음 판이 쉬워진다. 창병은 앞을 찌르니 옆으로 돌고, 궁수는 뒷걸음질하니 뛰는 좀비로 파고들고, 사제는 시체를 태우니 가장 먼저 잡는다. 성채의 기사 대장은 광역 휘두르기와 돌진을 쓰고 절반에서 종을 쳐 민병을 부르는데, 돌진 뒤 2초 남짓 생기는 빈틈이 유일한 기회다. 싸움에서 돌아오면 안개가 걷힌 땅에 무덤·뼈 채굴장·역병 우물·제단을 세운다. 무덤은 모아 온 시체를 좀비로 일으키고, 묘지성을 올려야 출정 상한과 건물 자리와 영웅 자리가 는다. 자리를 비운 동안에도 여덟 시간까지 생산이 쌓인다.',
     'Zombie March',
     'Drive a zombie horde across a kingdom with one finger. Drag the screen to move the skull banner and the horde follows, biting whoever it reaches. Everyone they kill rises a few seconds later on your side, and knights come back wearing their armour — so the bigger the win, the easier the next fight. Pikemen skewer whatever stands in front of them, so go around; archers back away, so send runners; priests burn corpses before they can rise, so kill them first. The captain guarding each keep sweeps and charges, and at half health rings a bell for reinforcements, leaving one opening: the two seconds of recovery after a charge. Between battles you claim the land you took and build crypts, bone pits, plague wells and an altar on it. The crypt raises the corpses you carried home, and only a higher keep lifts your army cap, building slots and hero slots. Production keeps running for up to eight hours while you are away.',
     '/games/thumbs/shots/zombie-march.png', NULL, 'HTML5',
     'IFRAME', '/games/zombie-march/index.html', 'BOTH', 1, 'kgd', 1, 'PUBLISHED',
     'STRATEGY', '["strategy","survival","leaderboard"]', NULL, NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='BOTH' · supports_mobile=1 — 두 방향 CDP 실측을 통과한 뒤에 켠다(약속이다).
--   세로 390×844 · 가로 844×390 에서 부팅→지도→타일 시트→출정→전투까지 탭·드래그만으로 도달.
--   세로는 전장 폭 1080, 가로는 1560 으로 넓혀 화면을 채운다 — 실측값은
--   portal-fe/public/games/zombie-march/DESIGN.md §2.
--
-- 조작은 **네이티브 터치**다(가상패드 없음). 끌기로 집결 지점을 옮기고 나머지는 탭이라
--   패드를 깔면 전장 아래를 가린다 (DESIGN.md §3).
--
-- 보드를 나누지 않는다 — 모드가 하나뿐이고, 점수는 먹은 땅의 적 전력 누적이라 한 표에 쌓인다.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'survival' AS slug UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'zombie-march'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'zombie-march'
ON DUPLICATE KEY UPDATE play_count = play_count;
