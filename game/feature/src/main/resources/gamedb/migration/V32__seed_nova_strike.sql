-- 클린룸 3호: 노바 스트라이크 — 32비트 세대 런앤건 액션 플랫포머.
-- 통합은 lib/platform.js 어댑터 (랭킹 제출 + localStorage 세이브 서버 동기화).

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('nova-strike', '노바 스트라이크',
     '32비트 세대 런앤건 액션 플랫포머 — 건슬링거 「더스크」(리볼버 연사+차지 매그넘)와 검객 「레이븐」(3연 콤보+회전참) 중 헌터를 골라, 대시·월점프로 궤도 도시의 가디언 3기를 격파하고 보스 무기 약점 순환을 완성하라. 상승 용암·빙판·상승기류·낙뢰 기믹의 4개 지역, 페이즈 전환 보스 5전(최종 2형태), 숨김 요소와 코어 칩 영구 강화 상점. 스프라이트·배경·BGM 전부 코드 생성(640×360 정수 배율).',
     'NOVA STRIKE',
     'A 32-bit-era run-and-gun action platformer. Pick your hunter — Dusk the gunslinger (revolver volleys and charged magnum rounds) or Raven the swordfighter (three-hit combos and spin slashes) — then dash and wall-jump through four themed zones, defeat three guardians and steal their weapons to complete the weakness cycle before a two-form final boss. Hidden upgrades and a permanent chip shop. Every sprite, backdrop and BGM is generated in code at 640x360 integer scaling.',
     '/games/thumbs/shots/nova-strike.png', NULL, 'HTML5', 'IFRAME', '/games/nova-strike/index.html',
     'LANDSCAPE', 0, 'kgd', 1, 'PUBLISHED', 'ACTION', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

-- V25 통합 이후 살아있는 태그만 매핑 (장르 축은 genre 컬럼 담당)
INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'nova-strike';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'nova-strike';
