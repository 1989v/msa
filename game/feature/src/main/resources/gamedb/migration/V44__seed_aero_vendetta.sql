-- 클린룸 산출물 등록: aero-vendetta (종스크롤 아케이드 슈팅, 랭킹 중심).
-- 통합은 lib/platform.js 어댑터 — 랭킹 제출(runEnd) + av_save 의 서버 동기화.
--
-- supports_mobile=1 근거 (터치 에뮬레이션 390x844 · pointer:coarse 실측):
--   · #vt-root 생성, 액션 버튼 3종(발사/폭탄/저속) 렌더
--   · 조이스틱 드래그 → 방향키 합성 → 플레이어 x 540→40 실제 이동
--   · 발사 버튼 포인터다운 → 자탄 생성 확인
--   · vt-fit 레이아웃에서 캔버스 390×520 상단 정렬 (자체 fit 은 패드 존재 시 양보)

INSERT INTO game (slug, title, description, title_en, description_en, thumbnail_url, cover_url, engine_type,
                  load_type, entry_url, orientation, supports_mobile, developer_name, sdk_integrated, status,
                  genre, tags, released_at, content_updated_at, created_at, updated_at)
VALUES
    ('aero-vendetta', '에어로 벤데타',
     '1949년 가공 전쟁, 반란 편대의 단기 항공 반격전 — 클래식 종스크롤 아케이드 슈팅. 메달을 연속 회수하면 100→10000까지 배율이 치솟는 메달 체인, V편대 격멸·노미스·보스 부위 파괴 보너스로 점수를 쌓아 랭킹에 도전한다. 3개 전장(군도 해역·밀림 협곡·요새 도시)과 다단 페이즈 보스 3기, 기체 3종 해금. 그래픽·사운드 전부 절차 생성(1080×1440).',
     'Aero Vendetta',
     'A classic vertical-scrolling arcade shooter set in a fictional 1949 war. Chain medals to multiply their value from 100 up to 10000, wipe V-formations, destroy boss turrets and finish stages deathless to climb the leaderboard. Three theaters (island sea, jungle canyon, fortress city), three multi-phase bosses, and three unlockable planes. All art and audio are procedurally generated at 1080x1440.',
     '/games/thumbs/shots/aero-vendetta.png', NULL, 'HTML5', 'IFRAME', '/games/aero-vendetta/index.html',
     'PORTRAIT', 1, 'kgd', 1, 'PUBLISHED', 'ARCADE', '["leaderboard"]',
     NOW(6), NOW(6), NOW(6), NOW(6));

INSERT INTO game_tag_map (game_id, tag_slug)
SELECT g.id, 'leaderboard' FROM game g WHERE g.slug = 'aero-vendetta';

INSERT INTO game_stats (game_id, play_count, rating_sum, rating_count, weekly_play_count)
SELECT id, 0, 0, 0, 0 FROM game WHERE slug = 'aero-vendetta';
