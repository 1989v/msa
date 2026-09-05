-- 인피니티 스탭 재테마(2026-09-05) — 카탈로그 문구를 화면과 맞춘다.
--
-- 자연 지형(지상·숲·폐허·구름·설산)에서 **도시를 타고 오르는 것**으로 바꿨는데(PRD §11),
-- 설명은 「우주까지 오르는 탑」과 일곱 구간 이름을 그대로 말하고 있었다 — 카드를 보고 들어온
-- 사람이 첫 화면(밤 골목)에서 다른 게임을 본다.
--
-- 보드 이름도 함께 고친다: 「우주 등정」 → 「블랙홀 도달」. 보드 키(summit)는 그대로다 —
-- 키를 바꾸면 이미 쌓인 기록이 다른 보드로 갈라진다.
UPDATE game
SET description = '밤 뒷골목에서 시작해 도시를 타고 오른다. 쓰레기더미를 밟고 외벽 창틀에 붙어 옥상으로, 마천루 사이를 건너 공사장 비계와 크레인을 지나, 끝에는 블랙홀로 들어간다. 점프를 누르는 시간이 힘이고 다섯 칸으로 차오른다 — 놓는 순간 그 칸의 힘으로 뛰고, 공중에서는 방향을 바꿀 수 없다. 떨어지면 받아 주는 발판이 나올 때까지 떨어진다. 상한이 없어서 공사장에서 미끄러지면 옥상까지, 운이 나쁘면 골목까지 간다. 붙잡아 주는 손은 없다 — 발이 윗면에 걸리지 않으면 그대로 떨어진다. 낡은 차양은 밟으면 무너지고, 곤돌라는 움직이고, 젖은 유리는 미끄럽다. 배수관이 붙은 외벽은 스태미나가 다할 때까지 오를 수 있다. 같은 날은 모두 같은 도시이고, 탭을 닫아도 그 자리에서 이어진다. 되돌림은 없다. 블랙홀 너머는 다음 편에서.',
    description_en = 'It starts in a dark alley at night and climbs the city. Step on the rubbish, catch a window ledge, reach the rooftops, cross between skyscrapers, pass the scaffolding and cranes of a construction site, and finally enter a black hole. Holding jump charges five notches; release and you leap with exactly that much force, and nothing changes direction in the air. When you fall, you fall until something catches you — there is no floor under the fall, so a slip at the construction site can drop you to the rooftops, or all the way to the alley. No hand hauls you up: if your feet miss the top, you drop. Old awnings crumble when stepped on, gondolas drift, wet glass slides, and a drainpipe wall can be climbed until your stamina runs out. Everyone climbs the same city on the same day, and closing the tab keeps your place. Nothing rewinds. What lies beyond the black hole is the next chapter.',
    score_boards = JSON_ARRAY(
        JSON_OBJECT('key', 'height', 'name', '최고 고도', 'nameEn', 'Altitude'),
        JSON_OBJECT('key', 'summit', 'name', '블랙홀 도달', 'nameEn', 'Black Hole')
    ),
    content_updated_at = NOW(6),
    updated_at = NOW(6)
WHERE slug = 'infinity-step';
