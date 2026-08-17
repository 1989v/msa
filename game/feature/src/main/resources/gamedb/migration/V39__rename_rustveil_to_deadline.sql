-- '녹빛 봉쇄구역' → '데드라인' 개명. 슬러그까지 바꾼다.
-- 등록 다음 날이라 플레이 1회 · 색인 직후여서 지금이 가장 싸다 (URL·세이브 의존이 아직 없다).
-- 슬러그가 바뀌면 정적 자산 경로(entry_url, thumbnail_url)도 같이 바뀐다 — 셋은 한 몸이다.
-- 서버 세이브(GameSaveData)는 슬러그로 묶이므로 구 슬러그 기록은 고아가 된다.
-- 하루치 1회 플레이뿐이라 이관 대신 버린다. 클라이언트 localStorage 는 게임이 구 키를 흡수한다.

UPDATE game
SET slug           = 'deadline',
    title          = '데드라인',
    title_en       = 'Deadline',
    entry_url      = '/games/deadline/index.html',
    thumbnail_url  = '/games/thumbs/shots/deadline.png',
    description    = '방역제가 유출된 항만도시에서 구조 신호까지 100시간을 버티는 쿼터뷰 좀비 생존·건설·디펜스. 11×11 = 121구역짜리 도시를 돌며 파밍하고, 낮에 방어선을 세워 밤의 습격을 막는다. 감염체 23종은 행동 축이 전부 다르고, 총을 쏘고 도망치고 창고를 터는 강도 7종이 제3세력으로 끼어든다. 무전 중계탑을 켜면 지도가 열리고 그 사이를 오갈 수 있다. 2인 로컬 협동 지원. 그래픽·사운드 전부 절차 생성.',
    description_en = 'Hold out for 100 hours in a quarantined port city — a quarter-view zombie survival, base-building and defense game. Scavenge a 121-district city across five quarantine rings, raise your walls by day and hold the line at night. Twenty-three infected types each behave differently, while seven bandit classes shoot, flee and loot your storage as a third faction. Power up radio masts to unlock fast travel across the map. Two-player local co-op. All art and audio generated in code.',
    content_updated_at = NOW(6)
WHERE slug = 'rustveil-holdout';

-- 태그 매핑은 game_id 기준이라 슬러그 변경의 영향을 받지 않는다. 확인만 남긴다.
