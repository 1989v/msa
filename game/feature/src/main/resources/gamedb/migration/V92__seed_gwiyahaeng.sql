-- 귀야행 척준경 — 고려 무장 척준경이 귀굴 아홉 층을 내려가며 혼백을 모아 귀장을 봉인하는 2D 픽셀 탐험 액션 (클린룸, 클로드 디자인 아트).
-- BETA 로 올린다: 1~6층 아트·층주 공략 대조 통과, 7~9층 아트는 배치 3 대기 (도착하면 게임 파일만 갱신되고 이 행은 그대로다).
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 여러 도메인이 함께 죽는다).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, score_boards, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('gwiyahaeng', '귀야행 척준경',
     '고려 무장 척준경이 산성 아래 귀굴 아홉 층을 내려가며 흩어진 혼백을 모아 귀장(鬼將)을 봉인하는 2D 픽셀 탐험 액션. 층마다 발판·밧줄·구덩이·달리기 점프 틈으로 짜인 지하 미로를 오르내리고, 도깨비·원귀·물귀신·어둑시니 같은 옛 귀신 27종은 저마다 예고 뒤 공격해 정답 대응이 따로 있다. 층주 열은 패턴마다 다른 예고(낮은 띠·수축 고리·바닥 표식)로 공략을 가르치고, 이기면 이단 점프·갈고리 밧줄·벽 차기 같은 능력을 준다. 혼백 22와 부적 조각 3을 모아야 봉인문이 열리며, 장승에서 기록한다.',
     'Gwiyahaeng: Cheok Jun-gyeong',
     'A 2D pixel-art exploration action game. Goryeo general Cheok Jun-gyeong descends nine floors of a ghost cave beneath a mountain fortress, gathering scattered souls to seal the Ghost General. Each floor is a vertical maze of ledges, ropes, pits and run-jump gaps; 27 spirits from Korean folklore — dokkaebi, wraiths, water ghosts, shadow eaters — each telegraph before striking and have their own counter. Ten floor bosses teach their patterns through distinct tells (low band, shrinking ring, floor mark) and grant abilities such as double jump, grappling rope and wall kick. Collect 22 souls and 3 talisman shards to open the sealed gate; save at the jangseung totems.',
     '/games/thumbs/shots/gwiyahaeng.png', NULL, 'HTML5',
     'IFRAME', '/games/gwiyahaeng/index.html', 'BOTH', 1, 'kgd', 1, 'BETA',
     'ACTION', '["action","platformer","exploration","pixel","korean-folklore","cleanroom"]', NULL, NOW(6), NOW(6), NOW(6), NOW(6))
ON DUPLICATE KEY UPDATE
    title = VALUES(title), description = VALUES(description),
    title_en = VALUES(title_en), description_en = VALUES(description_en),
    thumbnail_url = VALUES(thumbnail_url), engine_type = VALUES(engine_type),
    entry_url = VALUES(entry_url), genre = VALUES(genre), tags = VALUES(tags),
    orientation = VALUES(orientation), supports_mobile = VALUES(supports_mobile),
    status = VALUES(status), content_updated_at = NOW(6);

-- orientation='BOTH' — 세로 360×(360~720) · 가로 (480~800)×360 뷰포트를 방향에 따라 바꾼다. 짧은 변이 항상 360 이라 축척이 같다.
-- supports_mobile=1 근거: 390×844·844×390 CDP 실측 — 주인공 28.2 CSS px, 가상패드(lib/touch.js) 액션 4 라벨 3부, 회전 왕복 복구, 콘솔 에러 0.
-- sdk_integrated=1 — PlatformAdapter.runEnd 점수(층주 처치·엔딩) + 세이브 2키(gwiyahaeng.save / gwiyahaeng.meta) 동기화.

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'action' AS slug UNION ALL SELECT 'platformer' UNION ALL SELECT 'pixel') t
WHERE g.slug = 'gwiyahaeng'
  AND EXISTS (SELECT 1 FROM game_tag gt WHERE gt.slug = t.slug)
ON DUPLICATE KEY UPDATE tag_slug = VALUES(tag_slug);

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'gwiyahaeng'
ON DUPLICATE KEY UPDATE play_count = play_count;
